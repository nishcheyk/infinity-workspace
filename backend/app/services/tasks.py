import asyncio
import json
import logging
import mimetypes
import os
import uuid

import httpx
from bs4 import BeautifulSoup
from celery import Task
from bson import ObjectId
from playwright.sync_api import sync_playwright
from playwright.async_api import async_playwright
from qdrant_client.models import PointStruct

from app.celery_app import celery_app
from app.core.config import settings
from app.db.mongodb import mongo_db
from app.db.qdrant import qdrant_db
from app.services.document.ingestion_service import get_embedding_model

logger = logging.getLogger(__name__)

# ============ HELPER FUNCTIONS ============


def ensure_connections():
    """Ensure MongoDB and Qdrant connections are established."""
    if mongo_db.db is None:
        mongo_db.connect()
    if qdrant_db.client is None:
        qdrant_db.connect()


def get_event_loop():
    """Get or create event loop for async operations in sync context."""
    try:
        return asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop


async def update_status(doc_id: str, user_id: str, status: str, filename: str = None, progress: int = 0, error: str = None):
    """Update document status in MongoDB and publish notification."""
    db = mongo_db.db
    update_data = {"status": status}
    if progress:
        update_data["progress"] = progress
    if error:
        update_data["error"] = error
        
    await db.documents.update_one({"_id": ObjectId(doc_id)}, {"$set": update_data})
    from app.services.notification_service import notification_service

    await notification_service.publish_status(user_id, doc_id, status, filename, progress, error)


def ensure_qdrant_collection():
    """Ensure Qdrant collection exists with proper indexes (idempotent)."""
    try:
        from qdrant_client import models as qmodels

        qdrant_db.client.create_collection(
            collection_name="documents",
            vectors_config={"size": 384, "distance": "Cosine"},
        )
        qdrant_db.client.create_payload_index(
            collection_name="documents",
            field_name="text",
            field_schema=qmodels.TextIndexParams(
                type="text",
                tokenizer=qmodels.TokenizerType.WORD,
                min_token_len=2,
                max_token_len=15,
                lowercase=True,
            ),
        )
        qdrant_db.client.create_payload_index(
            collection_name="documents",
            field_name="user_id",
            field_schema=qmodels.PayloadSchemaType.KEYWORD,
        )
    except Exception:
        pass  # Collection already exists


def create_chunks(text_content: str, chunk_size: int = 500):
    """Split text into chunks of specified size."""
    chunks = []
    current_chunk = ""

    for line in text_content.split("\n"):
        if len(current_chunk) + len(line) > chunk_size:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = line
        else:
            current_chunk += "\n" + line if current_chunk else line

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def sample_chunks_for_analysis(chunks: list, max_chunks: int = 5):
    """Sample chunks from start, middle, and end for analysis."""
    if len(chunks) <= max_chunks:
        return "\n".join(chunks)

    mid = len(chunks) // 2
    sampled = chunks[:2] + [chunks[mid]] + chunks[-2:]
    return "\n[--SEGMENT--]\n".join(sampled)


async def generate_analysis(text: str, doc_type: str = "document"):
    """Generate summary, tags, and suggestions using LLM."""
    from app.services.ai.llm_client import groq_client

    prompt = f"""Analyze this {doc_type} and provide:
1. A 2-3 bullet point summary
2. Exactly 3-5 keywords/tags (comma separated)
3. 3 suggested questions the user might ask about this

Format as JSON with keys: summary, tags, suggestions

Content:
{text[:6000]}"""

    try:
        raw_analysis = await groq_client.generate_completion(settings.GROQ_MODEL, prompt)
        if "{" in raw_analysis:
            json_str = raw_analysis[raw_analysis.find("{") : raw_analysis.rfind("}") + 1]
            return json.loads(json_str)
        raise Exception("JSON not found in response")
    except Exception as e:
        logger.warning(f"Analysis extraction failed: {e}")
        return {
            "summary": "Analysis completed",
            "tags": f"{doc_type.capitalize()}",
            "suggestions": [f"Tell me more about this {doc_type}"],
        }


def create_vector_points(chunks: list, vectors, doc_id: str, user_id: str, filename: str):
    """Create Qdrant point structures from chunks and vectors."""
    points = []
    for i, (chunk, vector) in enumerate(zip(chunks, vectors, strict=False)):
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{doc_id}_{i}"))
        points.append(
            PointStruct(
                id=point_id,
                vector=vector.tolist(),
                payload={
                    "doc_id": doc_id,
                    "user_id": user_id,
                    "filename": filename,
                    "text": chunk,
                    "chunk_index": i,
                },
            )
        )
    return points


# ============ CELERY TASKS ============


@celery_app.task(bind=True, max_retries=3)
def process_document_task(self, doc_id: str, file_path: str, user_id: str):
    """Celery task to process uploaded documents."""
    ensure_connections()
    loop = get_event_loop()

    async def _process():
        try:
            db = mongo_db.db
            doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
            filename = doc.get("filename", "Unknown Document") if doc else "Unknown Document"

            await update_status(doc_id, user_id, "processing", filename)

            # 1. Parse Document via Unstructured API
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = "application/octet-stream"

            api_url = f"{settings.UNSTRUCTURED_URL}/general/v0/general"
            data = {"strategy": "fast"}

            async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=10.0, read=None)) as client:
                with open(file_path, "rb") as f:
                    files = {"files": (os.path.basename(file_path), f, mime_type)}
                    response = await client.post(api_url, files=files, data=data)

                if response.status_code != 200:
                    raise Exception(f"Unstructured API failed: {response.text}")

                elements = response.json()

            # 2. Chunking
            text_content = "\n".join([el.get("text", "") for el in elements])
            chunks = create_chunks(text_content)

            # 3. Embed & Upsert to Qdrant
            try:
                model = get_embedding_model()
                vectors = model.encode(chunks)
                has_model = True
            except Exception as e:
                logger.warning(f"Embedding failed: {e}")
                has_model = False

            if has_model:
                ensure_qdrant_collection()
                points = create_vector_points(chunks, vectors, doc_id, user_id, filename)
                qdrant_db.client.upsert(collection_name="documents", points=points)

            # 4. Generate Summary, Tags, and Suggested Questions
            await update_status(doc_id, user_id, "analyzing", filename)

            analysis_text = sample_chunks_for_analysis(chunks)
            analysis = await generate_analysis(analysis_text, "document")

            # 5. Update Status and Cleanup
            await db.documents.update_one(
                {"_id": ObjectId(doc_id)},
                {
                    "$set": {
                        "status": "completed",
                        "chunks": len(chunks),
                        "summary": analysis.get("summary", ""),
                        "tags": [t.strip() for t in str(analysis.get("tags", "")).split(",")],
                        "suggestions": analysis.get("suggestions", []),
                    }
                },
            )
            await update_status(doc_id, user_id, "completed", filename)

            # 6. Entity Extraction for Knowledge Graph
            try:
                from app.services.knowledge.graph_service import extract_and_store_graph_data

                await extract_and_store_graph_data(doc_id, analysis_text, user_id)
            except Exception as ge:
                logger.warning(f"Graph extraction failed for {doc_id}: {ge}")

            if os.path.exists(file_path):
                os.remove(file_path)

        except Exception as e:
            await db.documents.update_one({"_id": ObjectId(doc_id)}, {"$set": {"status": "failed", "error": str(e)}})
            await update_status(doc_id, user_id, "failed")
            raise self.retry(exc=e)

    loop.run_until_complete(_process())


@celery_app.task(bind=True, max_retries=3)
def scrape_url_task(self, doc_id: str, url: str, user_id: str):
    """Celery task to scrape a URL using LangGraph pipeline."""
    ensure_connections()
    loop = get_event_loop()

    async def _process():
        try:
            from app.services.scraping.pipeline import scraping_pipeline
            
            # Initialize state
            initial_state = {
                "url": url,
                "doc_id": doc_id,
                "user_id": user_id,
                "html_content": None,
                "text_content": None,
                "chunks": None,
                "vectors": None,
                "analysis": None,
                "status": "initialized",
                "error": None,
                "retry_count": 0,
            }
            
            # Run pipeline
            result = await scraping_pipeline.ainvoke(initial_state)
            
            # Check for errors
            if result.get("error"):
                raise Exception(result["error"])
            
            logger.info(f"Scraping completed for {url}: {len(result.get('chunks', []))} chunks")
            
        except Exception as e:
            db = mongo_db.db
            await db.documents.update_one(
                {"_id": ObjectId(doc_id)}, {"$set": {"status": "failed", "error": str(e)}}
            )
            await update_status(doc_id, user_id, "failed")
            raise self.retry(exc=e)

    loop.run_until_complete(_process())


@celery_app.task(bind=True, max_retries=3)
def transcription_task(self, doc_id: str, file_path: str, user_id: str):
    """Celery task to transcribe audio using faster-whisper."""
    ensure_connections()
    loop = get_event_loop()

    async def _process():
        try:
            await update_status(doc_id, user_id, "transcribing")

            # Transcribe audio
            from faster_whisper import WhisperModel

            def _run():
                model = WhisperModel("base", device="cpu", compute_type="int8")
                segments, _ = model.transcribe(file_path)
                return " ".join([s.text for s in segments])

            transcript = await asyncio.to_thread(_run)

            # Process transcript
            chunks = [transcript[i : i + 1000] for i in range(0, len(transcript), 1000)]
            model = get_embedding_model()
            vectors = model.encode(chunks)

            ensure_qdrant_collection()
            points = create_vector_points(chunks, vectors, doc_id, user_id, "Audio Transcription")
            qdrant_db.client.upsert(collection_name="documents", points=points)

            db = mongo_db.db
            await db.documents.update_one(
                {"_id": ObjectId(doc_id)},
                {"$set": {"status": "completed", "summary": "Transcription complete", "chunks": len(chunks)}},
            )
            await update_status(doc_id, user_id, "completed")

            if os.path.exists(file_path):
                os.remove(file_path)

        except Exception as e:
            db = mongo_db.db
            await db.documents.update_one({"_id": ObjectId(doc_id)}, {"$set": {"status": "failed", "error": str(e)}})
            await update_status(doc_id, user_id, "failed")
            raise self.retry(exc=e)

    loop.run_until_complete(_process())

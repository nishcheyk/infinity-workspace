import os
import shutil
from datetime import datetime

from bson import ObjectId
from fastapi import UploadFile

from app.core.config import settings
from app.db.mongodb import mongo_db
from app.db.qdrant import qdrant_db

import tempfile
# Ensure temp directory exists
UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "ai_doc_uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_timestamp():
    return datetime.utcnow()


async def save_upload_file(upload_file: UploadFile, doc_id: str) -> str:
    destination = os.path.join(UPLOAD_DIR, f"{doc_id}_{upload_file.filename}")
    with open(destination, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    return destination


# Global model instance
_embedding_model = None


def get_embedding_model():
    global _embedding_model
    from sentence_transformers import SentenceTransformer

    if _embedding_model is None:
        _embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _embedding_model


async def process_document(doc_id: str, file_path: str, user_id: str):
    """
    Background task to process the document.
    """
    # Re-acquire DB connection for background task context if needed,
    # but mongo_db singleton should work if event loop is running.
    # Ideally, we dependency inject, but background tasks are tricky.
    # We will use the global mongo_db instance.

    db = mongo_db.db
    if not db:
        # Fallback reconnect if needed (shouldn't happen in same process)
        # In production this might need better handling or celery.
        print("Error: DB not connected in background task")
        return

    try:
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)}, {"$set": {"status": "processing"}}
        )

        # 1. Parse Document via Unstructured API
        import httpx
        import mimetypes

        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"

        api_url = f"{settings.UNSTRUCTURED_URL}/general/v0/general"
        
        # Use 'fast' strategy to bypass slow layout analysis models (detectron2/OCR)
        # This significantly speeds up ingestion for text-based PDFs.
        data = {"strategy": "fast"}
        
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=10.0, read=None)) as client:
            with open(file_path, "rb") as f:
                files = {"files": (file_path.split("/")[-1], f, mime_type)}
                response = await client.post(api_url, files=files, data=data)
            
            if response.status_code != 200:
                raise Exception(f"Unstructured API failed: {response.text}")
            
            elements = response.json()

        # 2. Chunking
        # Elements are list of dicts now, not objects
        chunks = []
        current_chunk = ""
        CHUNK_SIZE = 500

        for element in elements:
            text = element.get("text", "")
            if len(current_chunk) + len(text) > CHUNK_SIZE:
                chunks.append(current_chunk)
                current_chunk = text
            else:
                current_chunk += "\n" + text

        if current_chunk:
            chunks.append(current_chunk)

        # 3. Embed & Upsert to Qdrant
        model = get_embedding_model()

        vectors = model.encode(chunks)

        points = []
        import uuid

        from qdrant_client.models import PointStruct

        # Get filename for metadata
        doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
        filename = doc.get("filename", "Unknown Document") if doc else "Unknown Document"

        for i, chunk in enumerate(chunks):
            vector = vectors[i].tolist()
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "doc_id": doc_id,
                        "user_id": user_id,
                        "filename": filename,
                        "text": chunk,
                        "chunk_index": i,
                    },
                )
            )

        # Ensure collection exists
        try:
            qdrant_db.client.create_collection(
                collection_name="documents",
                vectors_config={
                    "size": 384,
                    "distance": "Cosine",
                },  # all-MiniLM-L6-v2 is 384
            )
        except Exception:
            pass

        qdrant_db.client.upsert(collection_name="documents", points=points)

        # 4. Update Status and Cleanup
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {"status": "completed", "chunks": len(chunks)}},
        )

        # Broadcast success
        from app.websockets.connection_manager import manager

        await manager.broadcast_to_user(
            {"type": "ingestion_status", "doc_id": doc_id, "status": "completed"},
            user_id,
        )

        os.remove(file_path)

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error processing doc {doc_id}: {e}")
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)}, {"$set": {"status": "failed", "error": str(e)}}
        )
        # Broadcast failure
        from app.websockets.connection_manager import manager

        await manager.broadcast_to_user(
            {
                "type": "ingestion_status",
                "doc_id": doc_id,
                "status": "failed",
                "error": str(e),
            },
            user_id,
        )


def scrape_url_sync(url: str) -> str:
    """
    Scrape a URL using Playwright (Sync API) and extract clean text.
    This is used in a thread pool to avoid event loop issues on Windows.
    """
    from playwright.sync_api import sync_playwright
    from bs4 import BeautifulSoup

    with sync_playwright() as p:
        print(f"[*] Launching browser for: {url}")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print(f"[*] Navigating to: {url}")
            # Add a timeout and wait until network is somewhat idle
            page.goto(url, wait_until="networkidle", timeout=60000)
            print(f"[*] Page loaded, extracting content...")
            content = page.content()
            
            soup = BeautifulSoup(content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()

            # Get text
            text = soup.get_text()
            print(f"[*] Extracted {len(text)} characters of raw text")

            # Break into lines and remove leading and trailing whitespace
            lines = (line.strip() for line in text.splitlines())
            # Break multi-headlines into a line each
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            # Drop blank lines
            text = '\n'.join(chunk for chunk in chunks if chunk)
            
            return text
        finally:
            browser.close()


async def process_url(doc_id: str, url: str, user_id: str):
    """
    Background task to process a URL.
    """
    import asyncio
    db = mongo_db.db
    try:
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)}, {"$set": {"status": "processing"}}
        )

        # 1. Scrape (using sync method in thread pool)
        text_content = await asyncio.to_thread(scrape_url_sync, url)
        if not text_content:
            raise Exception("No text content found on the page.")

        # 2. Chunking (Simple character-based for now, similar to process_document)
        chunks = []
        CHUNK_SIZE = 1000
        for i in range(0, len(text_content), CHUNK_SIZE):
            chunks.append(text_content[i : i + CHUNK_SIZE])

        # 3. Embed & Upsert
        model = get_embedding_model()
        vectors = model.encode(chunks)
        
        points = []
        import uuid
        from qdrant_client.models import PointStruct

        for i, chunk in enumerate(chunks):
            vector = vectors[i].tolist()
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "doc_id": doc_id,
                        "user_id": user_id,
                        "filename": url,  # Using URL as filename for reference
                        "text": chunk,
                        "chunk_index": i,
                    },
                )
            )

        # Ensure collection exists
        try:
            qdrant_db.client.create_collection(
                collection_name="documents",
                vectors_config={"size": 384, "distance": "Cosine"},
            )
        except Exception:
            pass

        qdrant_db.client.upsert(collection_name="documents", points=points)

        # 4. Update Status
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {"status": "completed", "chunks": len(chunks)}},
        )

        # Broadcast success
        from app.websockets.connection_manager import manager
        await manager.broadcast_to_user(
            {"type": "ingestion_status", "doc_id": doc_id, "status": "completed"},
            user_id,
        )

    except Exception as e:
        print(f"Error processing URL {url}: {e}")
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)}, {"$set": {"status": "failed", "error": str(e)}}
        )
        from app.websockets.connection_manager import manager
        await manager.broadcast_to_user(
            {
                "type": "ingestion_status",
                "doc_id": doc_id,
                "status": "failed",
                "error": str(e),
            },
            user_id,
        )

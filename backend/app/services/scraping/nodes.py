"""Individual nodes for the scraping pipeline"""
import logging
from typing import Dict, Any
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

from app.db.qdrant import qdrant_db
from app.db.mongodb import mongo_db
from app.services.ai.llm_client import groq_client
from app.core.config import settings
from bson import ObjectId
from qdrant_client.models import PointStruct
import uuid

logger = logging.getLogger(__name__)


# Import update_status from tasks to avoid circular import
async def update_status(doc_id: str, user_id: str, status: str, source: str = "", progress: int = 0, error: str = None):
    """Send status update via Redis pub/sub"""
    from app.services.tasks import update_status as _update_status
    await _update_status(doc_id, user_id, status, source, progress, error)


async def fetch_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch HTML content using Playwright"""
    logger.info(f"Fetching URL: {state['url']}")
    
    # Send progress update
    await update_status(state['doc_id'], state['user_id'], "fetching", state['url'], progress=10)
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            try:
                await page.goto(state['url'], wait_until="networkidle", timeout=60000)
                html_content = await page.content()
                state['html_content'] = html_content
                state['status'] = 'fetched'
                logger.info(f"Successfully fetched {len(html_content)} bytes")
                
                # Update progress
                await update_status(state['doc_id'], state['user_id'], "fetched", state['url'], progress=20)
            finally:
                await browser.close()
    except Exception as e:
        logger.error(f"Fetch failed: {e}")
        state['error'] = f"Fetch error: {str(e)}"
        state['status'] = 'fetch_failed'
        await update_status(state['doc_id'], state['user_id'], "failed", state['url'], error=str(e))
    
    return state


async def parse_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Parse HTML and extract clean text"""
    logger.info("Parsing HTML content")
    await update_status(state['doc_id'], state['user_id'], "parsing", state['url'], progress=30)
    
    if not state.get('html_content'):
        state['error'] = "No HTML content to parse"
        state['status'] = 'parse_failed'
        return state
    
    try:
        soup = BeautifulSoup(state['html_content'], "html.parser")
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text
        text = soup.get_text()
        
        # Clean up text
        lines = (line.strip() for line in text.splitlines())
        chunks_text = (phrase.strip() for line in lines for phrase in line.split("  "))
        text_content = "\n".join(chunk for chunk in chunks_text if chunk)
        
        state['text_content'] = text_content
        state['status'] = 'parsed'
        logger.info(f"Parsed {len(text_content)} characters")
        await update_status(state['doc_id'], state['user_id'], "parsed", state['url'], progress=40)
    except Exception as e:
        logger.error(f"Parse failed: {e}")
        state['error'] = f"Parse error: {str(e)}"
        state['status'] = 'parse_failed'
        await update_status(state['doc_id'], state['user_id'], "failed", state['url'], error=str(e))
    
    return state


async def chunk_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Split text into chunks"""
    logger.info("Chunking text content")
    await update_status(state['doc_id'], state['user_id'], "chunking", state['url'], progress=50)
    
    if not state.get('text_content'):
        state['error'] = "No text content to chunk"
        state['status'] = 'chunk_failed'
        return state
    
    try:
        text = state['text_content']
        chunk_size = 1000
        chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]
        
        state['chunks'] = chunks
        state['status'] = 'chunked'
        logger.info(f"Created {len(chunks)} chunks")
        await update_status(state['doc_id'], state['user_id'], "chunked", state['url'], progress=60)
    except Exception as e:
        logger.error(f"Chunk failed: {e}")
        state['error'] = f"Chunk error: {str(e)}"
        state['status'] = 'chunk_failed'
        await update_status(state['doc_id'], state['user_id'], "failed", state['url'], error=str(e))
    
    return state


async def embed_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Generate embeddings for chunks"""
    logger.info("Generating embeddings")
    await update_status(state['doc_id'], state['user_id'], "embedding", state['url'], progress=70)
    
    if not state.get('chunks'):
        state['error'] = "No chunks to embed"
        state['status'] = 'embed_failed'
        return state
    
    try:
        from app.services.document.ingestion_service import get_embedding_model
        model = get_embedding_model()
        vectors = model.encode(state['chunks'])
        state['vectors'] = vectors.tolist()
        state['status'] = 'embedded'
        logger.info(f"Generated {len(vectors)} embeddings")
        await update_status(state['doc_id'], state['user_id'], "embedded", state['url'], progress=80)
    except Exception as e:
        logger.error(f"Embed failed: {e}")
        state['error'] = f"Embed error: {str(e)}"
        state['status'] = 'embed_failed'
        await update_status(state['doc_id'], state['user_id'], "failed", state['url'], error=str(e))
    
    return state


async def store_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Store chunks and vectors in Qdrant"""
    logger.info("Storing in Qdrant")
    await update_status(state['doc_id'], state['user_id'], "storing", state['url'], progress=85)
    
    if not state.get('chunks') or not state.get('vectors'):
        state['error'] = "Missing chunks or vectors"
        state['status'] = 'store_failed'
        return state
    
    try:
        # Ensure collection exists
        from app.services.tasks import ensure_qdrant_collection
        ensure_qdrant_collection()
        
        # Create points
        points = []
        for i, (chunk, vector) in enumerate(zip(state['chunks'], state['vectors'])):
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "text": chunk,
                        "doc_id": state['doc_id'],
                        "user_id": state['user_id'],
                        "source": state['url'],
                        "chunk_index": i,
                    },
                )
            )
        
        # Upsert to Qdrant
        qdrant_db.client.upsert(collection_name="documents", points=points)
        state['status'] = 'stored'
        logger.info(f"Stored {len(points)} points in Qdrant")
        await update_status(state['doc_id'], state['user_id'], "stored", state['url'], progress=90)
    except Exception as e:
        logger.error(f"Store failed: {e}")
        state['error'] = f"Store error: {str(e)}"
        state['status'] = 'store_failed'
    
    return state


async def analyze_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Generate summary and tags using LLM"""
    logger.info("Analyzing content")
    await update_status(state['doc_id'], state['user_id'], "analyzing", state['url'], progress=95)
    
    if not state.get('chunks'):
        state['error'] = "No chunks to analyze"
        state['status'] = 'analyze_failed'
        return state
    
    try:
        # Sample chunks for analysis
        sample_text = "\n\n".join(state['chunks'][:5])[:5000]
        
        # Generate analysis
        from app.services.tasks import generate_analysis
        analysis = await generate_analysis(sample_text, "website")
        
        state['analysis'] = analysis
        state['status'] = 'analyzed'
        logger.info("Analysis complete")
        
        # Update MongoDB
        db = mongo_db.db
        await db.documents.update_one(
            {"_id": ObjectId(state['doc_id'])},
            {
                "$set": {
                    "status": "completed",
                    "chunks": len(state['chunks']),
                    "summary": analysis.get("summary", ""),
                    "tags": analysis.get("tags", []),
                }
            },
        )
        await update_status(state['doc_id'], state['user_id'], "completed", state['url'], progress=100)
    except Exception as e:
        logger.error(f"Analyze failed: {e}")
        state['error'] = f"Analyze error: {str(e)}"
        state['status'] = 'analyze_failed'
        await update_status(state['doc_id'], state['user_id'], "failed", state['url'], error=str(e))
    
    return state

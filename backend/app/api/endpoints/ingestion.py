from typing import Any

from bson import ObjectId

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase
from sse_starlette.sse import EventSourceResponse

from app.api import deps
from app.db.mongodb import get_db
from app.models.user import UserResponse
from app.services.document import ingestion_service
from app.services.document.clustering_service import clustering_service
from app.services.notification_service import notification_service

router = APIRouter()


@router.get("/clusters", response_model=Any)
async def get_document_clusters(current_user: UserResponse = Depends(deps.get_current_user)) -> Any:
    """
    Get documents organized into semantic clusters.
    """
    return await clustering_service.cluster_user_documents(str(current_user.id))


@router.get("/sync-stream")
async def sync_stream(
    token: str = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> EventSourceResponse:
    """
    SSE endpoint to stream document sync status updates for the current user.
    """
    # Manual token extraction for SSE since EventSource doesn't support headers
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    from jose import jwt

    from app.core.config import settings

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    async def event_generator():
        async for message in notification_service.subscribe_to_user_updates(user_id):
            yield {"event": "update", "data": message}

    return EventSourceResponse(event_generator())


@router.post("/upload", response_model=Any)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(deps.get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Any:
    """
    Upload a document for ingestion.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Create initial document record
    doc_data = {
        "user_id": str(current_user.id),
        "filename": file.filename,
        "content_type": file.content_type,
        "status": "pending",
        "upload_timestamp": ingestion_service.get_timestamp(),
        "chunks": 0,
    }

    result = await db.documents.insert_one(doc_data)
    doc_id = str(result.inserted_id)

    # Save file temporarily (container ephemeral storage or volume)
    file_path = await ingestion_service.save_upload_file(file, doc_id)

    # Trigger background ingestion via Celery
    from app.services.tasks import process_document_task, transcription_task

    if file.content_type and ("audio" in file.content_type or file.filename.lower().endswith((".mp3", ".wav"))):
        transcription_task.delay(doc_id, file_path, str(current_user.id))
    else:
        process_document_task.delay(doc_id, file_path, str(current_user.id))

    return {"id": doc_id, "filename": file.filename, "status": "pending"}


@router.post("/scrape", response_model=Any)
async def scrape_website(
    payload: dict,
    current_user: UserResponse = Depends(deps.get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Any:
    """
    Scrape a website URL for ingestion.
    """
    url = payload.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    # Create initial document record
    doc_data = {
        "user_id": str(current_user.id),
        "filename": url,
        "content_type": "text/html",
        "status": "pending",
        "upload_timestamp": ingestion_service.get_timestamp(),
        "chunks": 0,
    }

    result = await db.documents.insert_one(doc_data)
    doc_id = str(result.inserted_id)

    # Trigger background ingestion via Celery
    from app.services.tasks import scrape_url_task

    scrape_url_task.delay(doc_id, url, str(current_user.id))

    return {"id": doc_id, "filename": url, "status": "pending"}


@router.get("/documents", response_model=Any)
async def list_documents(
    current_user: UserResponse = Depends(deps.get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Any:
    """
    List user documents.
    """
    cursor = db.documents.find({"user_id": str(current_user.id)})
    docs = await cursor.to_list(length=100)
    # Convert ObjectId to str
    for doc in docs:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return docs


@router.delete("/documents/{doc_id}", response_model=Any)
async def delete_document(
    doc_id: str,
    current_user: UserResponse = Depends(deps.get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Any:
    """
    Delete a document and its vectors.
    """
    from bson import ObjectId
    from qdrant_client.http import models

    from app.db.qdrant import qdrant_db

    # 1. Check ownership
    doc = await db.documents.find_one({"_id": ObjectId(doc_id), "user_id": str(current_user.id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 2. Delete from MongoDB
    await db.documents.delete_one({"_id": ObjectId(doc_id)})

    # 3. Delete from Qdrant (vectors)
    try:
        # Robustness: We use the doc_id filter which is reliable.
        # With deterministic IDs, we could also compute all IDs and delete by ID,
        # but filter is more flexible if chunk count changes.
        qdrant_db.client.delete(
            collection_name="documents",
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="doc_id",
                            match=models.MatchValue(value=doc_id),
                        ),
                    ],
                )
            ),
        )
    except Exception as e:
        print(f"Error checking qdrant delete: {e}")

    return {"status": "deleted", "id": doc_id}


@router.get("/{doc_id}/summary", response_model=Any)
async def get_document_summary(
    doc_id: str,
    current_user: UserResponse = Depends(deps.get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Any:
    """
    Get the summary of a document.
    """
    doc = await db.documents.find_one({"_id": ObjectId(doc_id), "user_id": str(current_user.id)})

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return {"summary": doc.get("summary", "Summary not available yet.")}


@router.post("/reprocess-graph", response_model=Any)
async def reprocess_graph_data(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Any:
    """
    Force re-extraction of entities for all documents to fix missing graph nodes.
    """
    from qdrant_client import models as qmodels

    from app.db.qdrant import qdrant_db
    from app.services.knowledge.graph_service import extract_and_store_graph_data

    user_id = user_id
    cursor = db.documents.find({"user_id": user_id, "status": "completed"})
    docs = await cursor.to_list(length=100)

    count = 0
    for doc in docs:
        doc_id = str(doc["_id"])
        # Fetch some text from Qdrant to use for extraction
        try:
            scroll_result, _ = qdrant_db.client.scroll(
                collection_name="documents",
                scroll_filter=qmodels.Filter(
                    must=[qmodels.FieldCondition(key="doc_id", match=qmodels.MatchValue(value=doc_id))]
                ),
                limit=5,
                with_payload=True,
            )
            text = "\n".join([res.payload.get("text", "") for res in scroll_result])
            if text:
                await extract_and_store_graph_data(doc_id, text, user_id)
                count += 1
        except Exception as e:
            print(f"Failed to reprocess {doc_id}: {e}")

    return {"status": "success", "processed_count": count}

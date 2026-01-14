from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api import deps
from app.db.mongodb import get_db
from app.models.user import UserResponse
from app.services import ingestion_service

router = APIRouter()


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

    # Trigger background ingestion
    background_tasks.add_task(
        ingestion_service.process_document, doc_id, file_path, str(current_user.id)
    )

    return {"id": doc_id, "filename": file.filename, "status": "pending"}


@router.post("/scrape", response_model=Any)
async def scrape_website(
    background_tasks: BackgroundTasks,
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

    # Trigger background ingestion
    background_tasks.add_task(
        ingestion_service.process_url, doc_id, url, str(current_user.id)
    )

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
    from app.db.qdrant import qdrant_db
    from qdrant_client.http import models

    # 1. Check ownership
    doc = await db.documents.find_one({"_id": ObjectId(doc_id), "user_id": str(current_user.id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 2. Delete from MongoDB
    await db.documents.delete_one({"_id": ObjectId(doc_id)})

    # 3. Delete from Qdrant (vectors)
    try:
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
        # non-blocking

    return {"status": "deleted", "id": doc_id}

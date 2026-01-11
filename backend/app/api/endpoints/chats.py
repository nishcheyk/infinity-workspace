from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.api import deps
from app.db.mongodb import get_db
from app.models.user import UserResponse
from app.models.chat import ChatSessionResponse, ChatMessage

router = APIRouter()

@router.get("", response_model=List[ChatSessionResponse])
async def list_sessions(
    current_user: UserResponse = Depends(deps.get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Any:
    """List all chat sessions for the current user"""
    cursor = db.chat_sessions.find({"user_id": str(current_user.id)}).sort("updated_at", -1)
    sessions = await cursor.to_list(length=100)
    for s in sessions:
        s["id"] = str(s["_id"])
    return sessions

@router.post("", response_model=ChatSessionResponse)
async def create_session(
    current_user: UserResponse = Depends(deps.get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Any:
    """Create a new chat session"""
    from datetime import datetime
    session_data = {
        "user_id": str(current_user.id),
        "title": "New Chat",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    result = await db.chat_sessions.insert_one(session_data)
    session_data["id"] = str(result.inserted_id)
    return session_data

@router.get("/{session_id}/history", response_model=List[ChatMessage])
async def get_session_history(
    session_id: str,
    current_user: UserResponse = Depends(deps.get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Any:
    """Get message history for a specific session"""
    # Verify ownership
    session = await db.chat_sessions.find_one({"_id": ObjectId(session_id), "user_id": str(current_user.id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    cursor = db.chat_messages.find({"session_id": session_id}).sort("timestamp", 1)
    messages = await cursor.to_list(length=100)
    for m in messages:
        m["id"] = str(m["_id"])
    return messages

@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_user: UserResponse = Depends(deps.get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Any:
    """Delete a chat session and its messages"""
    # Verify ownership
    session = await db.chat_sessions.find_one({"_id": ObjectId(session_id), "user_id": str(current_user.id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    await db.chat_sessions.delete_one({"_id": ObjectId(session_id)})
    await db.chat_messages.delete_many({"session_id": session_id})
    return {"status": "deleted"}

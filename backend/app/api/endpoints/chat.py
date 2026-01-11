from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api import deps
from app.models.user import UserResponse
from app.schemas.chat import ChatRequest
from app.services import chat_service

router = APIRouter()


@router.post("/message")
async def chat_message(
    request: ChatRequest, current_user: UserResponse = Depends(deps.get_current_user)
):
    """
    Send a message to the RAG chat engine. Returns a streaming response.
    """
    return StreamingResponse(
        chat_service.chat_stream(request.message, str(current_user.id)),
        media_type="text/plain",
    )

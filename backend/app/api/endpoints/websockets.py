from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from app.core.config import settings
from app.services.chat import chat_stream
from app.websockets.connection_manager import manager

router = APIRouter()


async def get_user_from_token(token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        # Ensure it's an access token
        if payload.get("type") != "access":
            return None

        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return user_id
    except JWTError:
        return None
    except Exception:
        return None


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    user_id = await get_user_from_token(token)
    if not user_id:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)
    
    # Start Redis listener as a background task
    import asyncio
    listener_task = asyncio.create_task(manager.start_redis_listener(user_id))
    
    try:
        while True:
            data = await websocket.receive_json()
            # Handle incoming messages
            # format: { "type": "chat_message", "content": "..." }

            if data.get("type") == "chat_message":
                # Process message
                query = data.get("text", "")
                session_id = data.get("session_id")

                if query:
                    await websocket.send_json({"type": "chat_start"})
                    try:
                        async for token in chat_stream(query, user_id, session_id):
                            await websocket.send_json({"type": "chat_token", "token": token})
                    except Exception:
                        pass
                    await websocket.send_json({"type": "chat_end"})

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

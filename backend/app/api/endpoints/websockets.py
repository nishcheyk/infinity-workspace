from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt

from app.core.config import settings
from app.services import chat_service
from app.websockets.connection_manager import manager

router = APIRouter()


async def get_user_from_token(token: str):
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        
        # Ensure it's an access token
        if payload.get("type") != "access":
            print(f"WS Auth Error: Token is not an access token (type={payload.get('type')})")
            return None
            
        user_id: str = payload.get("sub")
        if user_id is None:
            print(f"WS Auth Error: No sub in token payload")
            return None
        return user_id
    except JWTError as e:
        print(f"WS Auth Error (JWTError): {e}")
        return None
    except Exception as e:
        print(f"WS Auth Error (General): {e}")
        return None


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    print(f"WS Connection Attempt. Token Present: {bool(token)}")
    user_id = await get_user_from_token(token)
    if not user_id:
        print(f"WS Connection Rejected: Invalid Token")
        await websocket.close(code=1008)  # Policy Violation
        return

    print(f"WS Connection Accepted for User: {user_id}")
    await manager.connect(websocket, user_id)
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
                    async for token in chat_service.chat_stream(query, user_id, session_id):
                        await websocket.send_json({"type": "chat_token", "token": token})
                    await websocket.send_json({"type": "chat_end"})

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

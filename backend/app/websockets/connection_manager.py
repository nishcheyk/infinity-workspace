import json
from fastapi import WebSocket
from app.services.notification_service import notification_service


class ConnectionManager:
    def __init__(self):
        # Map user_id to a list of active WebSockets (user might have multiple tabs)
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast_to_user(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id][:]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error sending message to user {user_id}: {e}")
                    if connection in self.active_connections[user_id]:
                        self.active_connections[user_id].remove(connection)

    async def start_redis_listener(self, user_id: str):
        """Listen to Redis and broadcast to all user's WebSockets"""
        async for message in notification_service.subscribe_to_user_updates(user_id):
            try:
                data = json.loads(message)
                await self.broadcast_to_user(data, user_id)
            except Exception as e:
                print(f"Redis listener error for user {user_id}: {e}")


manager = ConnectionManager()

from typing import Dict, List

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # Map user_id to a list of active WebSockets (user might have multiple tabs)
        self.active_connections: Dict[str, List[WebSocket]] = {}

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
            for connection in self.active_connections[user_id][:]: # Iterate over a copy
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error sending message to user {user_id}: {e}")
                    # Remove dead connection
                    if connection in self.active_connections[user_id]:
                        self.active_connections[user_id].remove(connection)


manager = ConnectionManager()

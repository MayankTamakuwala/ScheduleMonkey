import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        if websocket.application_state == WebSocketState.CONNECTED:
            await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            if connection.application_state == WebSocketState.CONNECTED:
                await connection.send_text(message)

from __future__ import annotations

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, payload: dict) -> None:
        dead: list[WebSocket] = []
        for socket in self._connections:
            try:
                await socket.send_json(payload)
            except Exception:
                dead.append(socket)
        for socket in dead:
            self._connections.discard(socket)

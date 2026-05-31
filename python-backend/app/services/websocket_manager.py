"""WebSocket connection manager for real-time updates."""

import asyncio
import json
from datetime import datetime
from typing import Callable, Optional, Set

from fastapi import WebSocket

from app.core.logging import get_logger

logger = get_logger(__name__)


class WebSocketManager:
    """
    Manager for WebSocket connections.

    Handles:
    - Connection registration and cleanup
    - Broadcasting messages to clients
    - Client subscription management
    """

    def __init__(self):
        """Initialize WebSocket manager."""
        self.active_connections: Set[WebSocket] = set()
        self.subscriptions: dict[WebSocket, Set[str]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        """
        Register a new WebSocket connection.

        Args:
            websocket: WebSocket connection
        """
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
            self.subscriptions[websocket] = set()
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket) -> None:
        """
        Unregister a WebSocket connection.

        Args:
            websocket: WebSocket connection
        """
        async with self._lock:
            self.active_connections.discard(websocket)
            self.subscriptions.pop(websocket, None)
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")

    async def subscribe(self, websocket: WebSocket, channel: str) -> None:
        """
        Subscribe a connection to a channel.

        Args:
            websocket: WebSocket connection
            channel: Channel name to subscribe to
        """
        async with self._lock:
            if websocket in self.subscriptions:
                self.subscriptions[websocket].add(channel)
        logger.debug(f"Client subscribed to {channel}")

    async def unsubscribe(self, websocket: WebSocket, channel: str) -> None:
        """
        Unsubscribe a connection from a channel.

        Args:
            websocket: WebSocket connection
            channel: Channel name to unsubscribe from
        """
        async with self._lock:
            if websocket in self.subscriptions:
                self.subscriptions[websocket].discard(channel)
        logger.debug(f"Client unsubscribed from {channel}")

    async def broadcast(
        self, channel: str, message: dict, exclude: Optional[WebSocket] = None
    ) -> None:
        """
        Broadcast a message to all subscribed clients.

        Args:
            channel: Channel name
            message: Message data
            exclude: Optional connection to exclude from broadcast
        """
        message_data = {
            "type": channel,
            "data": message,
            "timestamp": datetime.utcnow().isoformat(),
        }

        async with self._lock:
            connections_copy = self.active_connections.copy()

        disconnected = []
        for connection in connections_copy:
            # Check if client is subscribed to this channel
            async with self._lock:
                if connection not in self.subscriptions:
                    continue
                if channel not in self.subscriptions[connection]:
                    continue
                if connection == exclude:
                    continue

            try:
                await connection.send_json(message_data)
            except Exception as e:
                logger.warning(f"Error sending message to client: {e}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for connection in disconnected:
            await self.disconnect(connection)

    async def send_personal(self, websocket: WebSocket, message: dict) -> None:
        """
        Send a message to a specific client.

        Args:
            websocket: Target WebSocket connection
            message: Message data
        """
        message_data = {
            "type": "personal",
            "data": message,
            "timestamp": datetime.utcnow().isoformat(),
        }

        try:
            await websocket.send_json(message_data)
        except Exception as e:
            logger.warning(f"Error sending personal message: {e}")
            await self.disconnect(websocket)

    def get_connection_count(self) -> int:
        """
        Get total number of active connections.

        Returns:
            Number of active connections
        """
        return len(self.active_connections)

    async def get_subscriptions(self, websocket: WebSocket) -> Set[str]:
        """
        Get subscriptions for a connection.

        Args:
            websocket: WebSocket connection

        Returns:
            Set of subscribed channels
        """
        async with self._lock:
            return self.subscriptions.get(websocket, set()).copy()


# Global WebSocket manager instance
_ws_manager: Optional[WebSocketManager] = None


def get_ws_manager() -> WebSocketManager:
    """
    Get or create global WebSocket manager instance.

    Returns:
        WebSocketManager instance
    """
    global _ws_manager
    if _ws_manager is None:
        _ws_manager = WebSocketManager()
    return _ws_manager

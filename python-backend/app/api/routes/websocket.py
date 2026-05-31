"""WebSocket endpoint handlers."""

import json
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.logging import get_logger
from app.models.mt5_types import SubscriptionRequest, WebSocketMessage
from app.services.tick_streamer import get_tick_streamer
from app.services.websocket_manager import get_ws_manager

logger = get_logger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])

# Track WebSocket client subscriptions
tick_subscribers = set()


@router.websocket("/market")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for market data streaming.

    Supports:
    - subscribe: Subscribe to market data channels
    - unsubscribe: Unsubscribe from market data channels
    - ping: Connection keep-alive
    """
    ws_manager = get_ws_manager()
    tick_streamer = get_tick_streamer()

    await ws_manager.connect(websocket)

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                action = message.get("action")
                channel = message.get("channel")
                symbol = message.get("symbol")

                if action == "subscribe":
                    if channel == "tick":
                        if symbol:
                            await ws_manager.subscribe(websocket, f"tick:{symbol}")
                            tick_streamer.add_symbol(symbol)
                            logger.info(f"Client subscribed to ticks for {symbol}")

                            # Send confirmation
                            await ws_manager.send_personal(
                                websocket,
                                {
                                    "type": "subscription",
                                    "status": "subscribed",
                                    "channel": channel,
                                    "symbol": symbol,
                                },
                            )
                        else:
                            await ws_manager.subscribe(websocket, "tick")
                            logger.info("Client subscribed to all ticks")

                            await ws_manager.send_personal(
                                websocket,
                                {
                                    "type": "subscription",
                                    "status": "subscribed",
                                    "channel": channel,
                                },
                            )
                    else:
                        await ws_manager.subscribe(websocket, channel)
                        logger.info(f"Client subscribed to {channel}")

                        await ws_manager.send_personal(
                            websocket,
                            {
                                "type": "subscription",
                                "status": "subscribed",
                                "channel": channel,
                            },
                        )

                elif action == "unsubscribe":
                    if channel == "tick" and symbol:
                        await ws_manager.unsubscribe(websocket, f"tick:{symbol}")
                        logger.info(f"Client unsubscribed from ticks for {symbol}")

                        await ws_manager.send_personal(
                            websocket,
                            {
                                "type": "subscription",
                                "status": "unsubscribed",
                                "channel": channel,
                                "symbol": symbol,
                            },
                        )
                    else:
                        await ws_manager.unsubscribe(websocket, channel)
                        logger.info(f"Client unsubscribed from {channel}")

                        await ws_manager.send_personal(
                            websocket,
                            {
                                "type": "subscription",
                                "status": "unsubscribed",
                                "channel": channel,
                            },
                        )

                elif action == "ping":
                    await ws_manager.send_personal(
                        websocket,
                        {"type": "pong"},
                    )

                else:
                    logger.warning(f"Unknown action: {action}")
                    await ws_manager.send_personal(
                        websocket,
                        {
                            "type": "error",
                            "message": f"Unknown action: {action}",
                        },
                    )

            except json.JSONDecodeError:
                logger.warning("Received invalid JSON from client")
                await ws_manager.send_personal(
                    websocket,
                    {
                        "type": "error",
                        "message": "Invalid JSON format",
                    },
                )
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                await ws_manager.send_personal(
                    websocket,
                    {
                        "type": "error",
                        "message": str(e),
                    },
                )

    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
        logger.info("Client disconnected from WebSocket")

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await ws_manager.disconnect(websocket)


@router.get("/stats")
async def get_websocket_stats():
    """
    Get WebSocket connection statistics.

    Returns:
        Dictionary with connection stats
    """
    ws_manager = get_ws_manager()
    tick_streamer = get_tick_streamer()

    return {
        "active_connections": ws_manager.get_connection_count(),
        "streaming_active": tick_streamer.is_running(),
        "subscribed_symbols": list(tick_streamer.get_subscribed_symbols()),
    }

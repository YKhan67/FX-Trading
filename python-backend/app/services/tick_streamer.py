"""Real-time tick streaming service."""

import asyncio
from typing import Optional, Set

from app.core.config import settings
from app.core.logging import get_logger
from app.models.mt5_types import TickData
from app.services.mt5_connector import get_mt5_connector
from app.services.websocket_manager import get_ws_manager

logger = get_logger(__name__)


class TickStreamer:
    """
    Service for streaming real-time tick data.

    Handles:
    - Tick data polling from MT5
    - Broadcasting ticks to subscribed clients
    - Connection and subscription management
    """

    def __init__(self):
        """Initialize tick streamer."""
        self.streaming = False
        self.subscribed_symbols: Set[str] = set()
        self._task: Optional[asyncio.Task] = None
        self._poll_interval = 0.1  # 100ms polling interval
        logger.info("TickStreamer initialized")

    async def start(self) -> None:
        """Start the tick streaming service."""
        if self.streaming:
            logger.warning("Tick streaming already running")
            return

        self.streaming = True
        logger.info("Starting tick streaming service")
        self._task = asyncio.create_task(self._stream_loop())

    async def stop(self) -> None:
        """Stop the tick streaming service."""
        if not self.streaming:
            logger.warning("Tick streaming not running")
            return

        self.streaming = False
        logger.info("Stopping tick streaming service")

        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    def add_symbol(self, symbol: str) -> None:
        """
        Add a symbol to the streaming list.

        Args:
            symbol: Trading symbol to stream
        """
        if symbol not in self.subscribed_symbols:
            self.subscribed_symbols.add(symbol)
            logger.info(f"Added symbol to streaming: {symbol}")

    def remove_symbol(self, symbol: str) -> None:
        """
        Remove a symbol from the streaming list.

        Args:
            symbol: Trading symbol to stop streaming
        """
        if symbol in self.subscribed_symbols:
            self.subscribed_symbols.discard(symbol)
            logger.info(f"Removed symbol from streaming: {symbol}")

    async def _stream_loop(self) -> None:
        """Main streaming loop - polls ticks and broadcasts them."""
        mt5 = get_mt5_connector()
        ws_manager = get_ws_manager()

        last_tick_time = {}

        while self.streaming:
            try:
                # Process each subscribed symbol
                for symbol in list(self.subscribed_symbols):
                    try:
                        tick = mt5.get_tick(symbol)
                        if tick is None:
                            continue

                        # Only broadcast if tick time has changed
                        tick_key = f"{symbol}:{tick.time}"
                        if last_tick_time.get(symbol) != tick_key:
                            last_tick_time[symbol] = tick_key

                            # Broadcast tick to WebSocket subscribers
                            await ws_manager.broadcast(
                                "tick",
                                {
                                    "symbol": tick.symbol,
                                    "bid": tick.bid,
                                    "ask": tick.ask,
                                    "bid_volume": tick.bid_volume,
                                    "ask_volume": tick.ask_volume,
                                    "time": tick.time.isoformat(),
                                },
                            )
                    except Exception as e:
                        logger.warning(f"Error streaming tick for {symbol}: {e}")

                # Sleep before next poll
                await asyncio.sleep(self._poll_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in tick streaming loop: {e}")
                await asyncio.sleep(1)  # Back off on error

        logger.info("Tick streaming loop ended")

    def get_subscribed_symbols(self) -> Set[str]:
        """
        Get all currently subscribed symbols.

        Returns:
            Set of symbol names
        """
        return self.subscribed_symbols.copy()

    def is_running(self) -> bool:
        """
        Check if streaming is active.

        Returns:
            True if streaming is running
        """
        return self.streaming


# Global tick streamer instance
_tick_streamer: Optional[TickStreamer] = None


def get_tick_streamer() -> TickStreamer:
    """
    Get or create global tick streamer instance.

    Returns:
        TickStreamer instance
    """
    global _tick_streamer
    if _tick_streamer is None:
        _tick_streamer = TickStreamer()
    return _tick_streamer

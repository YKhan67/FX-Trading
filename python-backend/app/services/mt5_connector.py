"""MT5 connector service for trading operations."""

import threading
from datetime import datetime, timedelta
from typing import Optional

import MetaTrader5 as mt5

from app.core.config import settings
from app.core.logging import get_logger
from app.models.mt5_types import (
    AccountInfo,
    CloseOrderRequest,
    CancelOrderRequest,
    ModifyOrderRequest,
    OHLC,
    OrderHistory,
    OrderResponse,
    OrderType,
    PlaceOrderRequest,
    PositionResponse,
    SubscriptionRequest,
    SymbolInfo,
    TickData,
    TimeFrame,
)

logger = get_logger(__name__)


class MT5Connector:
    """
    Manager for MetaTrader 5 connections and operations.

    Handles:
    - Connection and disconnection
    - Order placement, modification, and cancellation
    - Position and account information retrieval
    - Tick and OHLC data access
    """

    def __init__(self):
        """Initialize MT5 connector."""
        self.connected = False
        self._lock = threading.RLock()
        logger.info("MT5Connector initialized")

    def connect(self) -> bool:
        """
        Connect to MetaTrader 5.

        Returns:
            bool: True if connection successful, False otherwise
        """
        with self._lock:
            try:
                if mt5.initialize(
                    login=settings.mt5_login,
                    password=settings.mt5_password,
                    server=settings.mt5_server,
                    timeout=settings.mt5_timeout,
                ):
                    self.connected = True
                    logger.info(
                        f"Connected to MT5: {settings.mt5_server} (login: {settings.mt5_login})"
                    )
                    return True
                else:
                    error = mt5.last_error()
                    logger.error(f"MT5 connection failed: {error}")
                    return False
            except Exception as e:
                logger.error(f"Exception during MT5 connection: {e}")
                return False

    def disconnect(self) -> None:
        """Disconnect from MetaTrader 5."""
        with self._lock:
            try:
                if self.connected:
                    mt5.shutdown()
                    self.connected = False
                    logger.info("Disconnected from MT5")
            except Exception as e:
                logger.error(f"Error during MT5 disconnection: {e}")

    def is_connected(self) -> bool:
        """
        Check if MT5 is connected.

        Returns:
            bool: Connection status
        """
        return self.connected and mt5.last_error()[0] == 0

    def place_order(self, request: PlaceOrderRequest) -> OrderResponse:
        """
        Place a new order.

        Args:
            request: PlaceOrderRequest with order details

        Returns:
            OrderResponse with execution result
        """
        with self._lock:
            try:
                if not self.is_connected():
                    return OrderResponse(
                        success=False, message="MT5 not connected", retcode=-1
                    )

                # Get symbol tick to determine current prices
                tick = mt5.symbol_info_tick(request.symbol)
                if tick is None:
                    logger.error(f"Cannot get tick for {request.symbol}")
                    return OrderResponse(
                        success=False,
                        message=f"Cannot get tick for {request.symbol}",
                        retcode=-1,
                    )

                # Determine order type and price
                order_type = self._get_mt5_order_type(request.order_type)
                price = request.price or (
                    tick.ask
                    if request.order_type
                    in [OrderType.BUY, OrderType.BUY_LIMIT, OrderType.BUY_STOP]
                    else tick.bid
                )

                # Create order request
                order_request = {
                    "action": mt5.TRADE_ACTION_DEAL,
                    "symbol": request.symbol,
                    "volume": request.volume,
                    "type": order_type,
                    "price": price,
                    "deviation": request.deviation,
                    "magic": request.magic,
                    "comment": request.comment or "",
                    "type_time": mt5.ORDER_TIME_GTC,
                    "type_filling": mt5.ORDER_FILLING_IOC,
                }

                if request.stop_loss:
                    order_request["sl"] = request.stop_loss
                if request.take_profit:
                    order_request["tp"] = request.take_profit

                result = mt5.order_send(order_request)
                if result.retcode == mt5.TRADE_RETCODE_DONE:
                    logger.info(
                        f"Order placed: {request.symbol} {request.order_type} {request.volume}"
                    )
                    return OrderResponse(
                        success=True,
                        ticket=result.order,
                        message="Order placed successfully",
                        retcode=result.retcode,
                        bid=tick.bid,
                        ask=tick.ask,
                    )
                else:
                    logger.warning(f"Order placement failed: {result.comment}")
                    return OrderResponse(
                        success=False,
                        message=result.comment,
                        retcode=result.retcode,
                        bid=tick.bid,
                        ask=tick.ask,
                    )
            except Exception as e:
                logger.error(f"Exception placing order: {e}")
                return OrderResponse(success=False, message=str(e), retcode=-1)

    def modify_order(self, request: ModifyOrderRequest) -> OrderResponse:
        """
        Modify an existing order.

        Args:
            request: ModifyOrderRequest with new order parameters

        Returns:
            OrderResponse with modification result
        """
        with self._lock:
            try:
                if not self.is_connected():
                    return OrderResponse(
                        success=False, message="MT5 not connected", retcode=-1
                    )

                # Get current order info
                order = mt5.order_calc_margin(request.ticket)
                if order is None:
                    return OrderResponse(
                        success=False,
                        message=f"Order {request.ticket} not found",
                        retcode=-1,
                    )

                # Create modification request
                order_request = {
                    "action": mt5.TRADE_ACTION_MODIFY,
                    "order": request.ticket,
                    "type_time": mt5.ORDER_TIME_GTC,
                    "type_filling": mt5.ORDER_FILLING_IOC,
                }

                if request.price is not None:
                    order_request["price"] = request.price
                if request.stop_loss is not None:
                    order_request["sl"] = request.stop_loss
                if request.take_profit is not None:
                    order_request["tp"] = request.take_profit
                if request.comment is not None:
                    order_request["comment"] = request.comment

                result = mt5.order_send(order_request)
                if result.retcode == mt5.TRADE_RETCODE_DONE:
                    logger.info(f"Order {request.ticket} modified successfully")
                    return OrderResponse(
                        success=True,
                        ticket=request.ticket,
                        message="Order modified successfully",
                        retcode=result.retcode,
                    )
                else:
                    logger.warning(f"Order modification failed: {result.comment}")
                    return OrderResponse(
                        success=False,
                        message=result.comment,
                        retcode=result.retcode,
                    )
            except Exception as e:
                logger.error(f"Exception modifying order: {e}")
                return OrderResponse(success=False, message=str(e), retcode=-1)

    def close_order(self, request: CloseOrderRequest) -> OrderResponse:
        """
        Close an open position.

        Args:
            request: CloseOrderRequest with ticket and volume

        Returns:
            OrderResponse with closure result
        """
        with self._lock:
            try:
                if not self.is_connected():
                    return OrderResponse(
                        success=False, message="MT5 not connected", retcode=-1
                    )

                # Get position info
                position = mt5.positions_get(ticket=request.ticket)
                if not position:
                    return OrderResponse(
                        success=False,
                        message=f"Position {request.ticket} not found",
                        retcode=-1,
                    )

                position = position[0]
                tick = mt5.symbol_info_tick(position.symbol)
                if tick is None:
                    return OrderResponse(
                        success=False,
                        message=f"Cannot get tick for {position.symbol}",
                        retcode=-1,
                    )

                # Determine close price and order type
                close_price = tick.bid if position.type == mt5.ORDER_TYPE_BUY else tick.ask
                close_type = (
                    mt5.ORDER_TYPE_SELL
                    if position.type == mt5.ORDER_TYPE_BUY
                    else mt5.ORDER_TYPE_BUY
                )

                # Create close request
                volume = request.volume if request.volume else position.volume
                order_request = {
                    "action": mt5.TRADE_ACTION_DEAL,
                    "symbol": position.symbol,
                    "volume": volume,
                    "type": close_type,
                    "position": request.ticket,
                    "price": close_price,
                    "deviation": request.deviation,
                    "type_time": mt5.ORDER_TIME_GTC,
                    "type_filling": mt5.ORDER_FILLING_IOC,
                }

                result = mt5.order_send(order_request)
                if result.retcode == mt5.TRADE_RETCODE_DONE:
                    logger.info(f"Position {request.ticket} closed successfully")
                    return OrderResponse(
                        success=True,
                        ticket=result.order,
                        message="Position closed successfully",
                        retcode=result.retcode,
                        bid=tick.bid,
                        ask=tick.ask,
                    )
                else:
                    logger.warning(f"Position closure failed: {result.comment}")
                    return OrderResponse(
                        success=False,
                        message=result.comment,
                        retcode=result.retcode,
                        bid=tick.bid,
                        ask=tick.ask,
                    )
            except Exception as e:
                logger.error(f"Exception closing order: {e}")
                return OrderResponse(success=False, message=str(e), retcode=-1)

    def cancel_order(self, request: CancelOrderRequest) -> OrderResponse:
        """
        Cancel a pending order.

        Args:
            request: CancelOrderRequest with order ticket

        Returns:
            OrderResponse with cancellation result
        """
        with self._lock:
            try:
                if not self.is_connected():
                    return OrderResponse(
                        success=False, message="MT5 not connected", retcode=-1
                    )

                # Get order info
                order = mt5.orders_get(ticket=request.ticket)
                if not order:
                    return OrderResponse(
                        success=False,
                        message=f"Order {request.ticket} not found",
                        retcode=-1,
                    )

                # Create cancel request
                order_request = {
                    "action": mt5.TRADE_ACTION_REMOVE,
                    "order": request.ticket,
                }

                result = mt5.order_send(order_request)
                if result.retcode == mt5.TRADE_RETCODE_DONE:
                    logger.info(f"Order {request.ticket} canceled successfully")
                    return OrderResponse(
                        success=True,
                        ticket=request.ticket,
                        message="Order canceled successfully",
                        retcode=result.retcode,
                    )
                else:
                    logger.warning(f"Order cancellation failed: {result.comment}")
                    return OrderResponse(
                        success=False,
                        message=result.comment,
                        retcode=result.retcode,
                    )
            except Exception as e:
                logger.error(f"Exception canceling order: {e}")
                return OrderResponse(success=False, message=str(e), retcode=-1)

    def get_positions(self, symbol: Optional[str] = None) -> list[PositionResponse]:
        """
        Get all open positions or positions for specific symbol.

        Args:
            symbol: Optional symbol filter

        Returns:
            List of PositionResponse objects
        """
        with self._lock:
            try:
                if not self.is_connected():
                    logger.warning("MT5 not connected")
                    return []

                positions = (
                    mt5.positions_get(symbol=symbol)
                    if symbol
                    else mt5.positions_get()
                )
                if positions is None:
                    return []

                result = []
                for pos in positions:
                    try:
                        tick = mt5.symbol_info_tick(pos.symbol)
                        if tick:
                            current_price = tick.bid if pos.type == 0 else tick.ask
                            pnl = (current_price - pos.price_open) * pos.volume * (
                                1 if pos.type == 0 else -1
                            )
                            pips = (current_price - pos.price_open) * 10000
                            pnl_percent = (pnl / (pos.price_open * pos.volume)) * 100

                            result.append(
                                PositionResponse(
                                    ticket=pos.ticket,
                                    symbol=pos.symbol,
                                    order_type=OrderType.BUY
                                    if pos.type == 0
                                    else OrderType.SELL,
                                    volume=pos.volume,
                                    open_price=pos.price_open,
                                    current_price=current_price,
                                    profit_loss=pnl,
                                    profit_loss_pips=pips,
                                    profit_loss_percent=pnl_percent,
                                    open_time=datetime.fromtimestamp(pos.time),
                                    comment=pos.comment,
                                    magic=pos.magic,
                                    stop_loss=pos.sl if pos.sl != 0 else None,
                                    take_profit=pos.tp if pos.tp != 0 else None,
                                )
                            )
                    except Exception as e:
                        logger.warning(f"Error processing position {pos.ticket}: {e}")

                logger.debug(f"Retrieved {len(result)} positions")
                return result
            except Exception as e:
                logger.error(f"Exception getting positions: {e}")
                return []

    def get_account_info(self) -> Optional[AccountInfo]:
        """
        Get account information.

        Returns:
            AccountInfo object or None if error
        """
        with self._lock:
            try:
                if not self.is_connected():
                    logger.warning("MT5 not connected")
                    return None

                account = mt5.account_info()
                if account is None:
                    return None

                return AccountInfo(
                    login=account.login,
                    name=account.name,
                    broker=account.broker,
                    currency=account.currency,
                    balance=account.balance,
                    equity=account.equity,
                    margin=account.margin,
                    margin_free=account.margin_free,
                    margin_level=account.margin_level,
                    leverage=account.leverage,
                )
            except Exception as e:
                logger.error(f"Exception getting account info: {e}")
                return None

    def get_symbol_info(self, symbol: str) -> Optional[SymbolInfo]:
        """
        Get symbol information.

        Args:
            symbol: Trading symbol

        Returns:
            SymbolInfo object or None if error
        """
        with self._lock:
            try:
                if not self.is_connected():
                    logger.warning("MT5 not connected")
                    return None

                symbol_info = mt5.symbol_info(symbol)
                if symbol_info is None:
                    logger.warning(f"Symbol {symbol} not found")
                    return None

                tick = mt5.symbol_info_tick(symbol)
                if tick is None:
                    logger.warning(f"Cannot get tick for {symbol}")
                    return None

                return SymbolInfo(
                    symbol=symbol_info.name,
                    description=symbol_info.description,
                    bid=tick.bid,
                    ask=tick.ask,
                    point=symbol_info.point,
                    digits=symbol_info.digits,
                    spread=int((tick.ask - tick.bid) / symbol_info.point),
                    volume=tick.volume,
                    high=symbol_info.high,
                    low=symbol_info.low,
                )
            except Exception as e:
                logger.error(f"Exception getting symbol info: {e}")
                return None

    def get_tick(self, symbol: str) -> Optional[TickData]:
        """
        Get current tick data.

        Args:
            symbol: Trading symbol

        Returns:
            TickData object or None if error
        """
        with self._lock:
            try:
                if not self.is_connected():
                    logger.warning("MT5 not connected")
                    return None

                tick = mt5.symbol_info_tick(symbol)
                if tick is None:
                    logger.warning(f"Cannot get tick for {symbol}")
                    return None

                return TickData(
                    symbol=symbol,
                    bid=tick.bid,
                    ask=tick.ask,
                    bid_volume=tick.bid_volume,
                    ask_volume=tick.ask_volume,
                    time=datetime.fromtimestamp(tick.time),
                    last=tick.last if hasattr(tick, "last") else None,
                    volume=tick.volume,
                )
            except Exception as e:
                logger.error(f"Exception getting tick: {e}")
                return None

    def get_ohlc(
        self, symbol: str, timeframe: TimeFrame, count: int = 100
    ) -> list[OHLC]:
        """
        Get OHLC candlestick data.

        Args:
            symbol: Trading symbol
            timeframe: Timeframe for candles
            count: Number of candles to retrieve

        Returns:
            List of OHLC objects
        """
        with self._lock:
            try:
                if not self.is_connected():
                    logger.warning("MT5 not connected")
                    return []

                tf = self._get_mt5_timeframe(timeframe)
                rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
                if rates is None or len(rates) == 0:
                    logger.warning(f"Cannot get OHLC for {symbol}")
                    return []

                result = []
                for rate in rates:
                    result.append(
                        OHLC(
                            time=datetime.fromtimestamp(rate["time"]),
                            open=rate["open"],
                            high=rate["high"],
                            low=rate["low"],
                            close=rate["close"],
                            volume=rate["tick_volume"],
                            real_volume=rate["real_volume"]
                            if "real_volume" in rate
                            else None,
                        )
                    )

                logger.debug(f"Retrieved {len(result)} OHLC candles for {symbol}")
                return result
            except Exception as e:
                logger.error(f"Exception getting OHLC: {e}")
                return []

    def get_history(
        self, symbol: str, start_date: datetime, end_date: datetime
    ) -> list[OrderHistory]:
        """
        Get historical orders and positions.

        Args:
            symbol: Trading symbol
            start_date: Start date for history
            end_date: End date for history

        Returns:
            List of OrderHistory objects
        """
        with self._lock:
            try:
                if not self.is_connected():
                    logger.warning("MT5 not connected")
                    return []

                deals = mt5.history_deals_get(start_date, end_date, group=symbol)
                if deals is None:
                    return []

                result = []
                for deal in deals:
                    try:
                        deal_type = OrderType.BUY if deal.type == 0 else OrderType.SELL
                        result.append(
                            OrderHistory(
                                ticket=deal.ticket,
                                symbol=deal.symbol,
                                order_type=deal_type,
                                volume=deal.volume,
                                open_price=deal.price,
                                close_price=deal.price,
                                open_time=datetime.fromtimestamp(deal.time),
                                close_time=datetime.fromtimestamp(deal.time),
                                profit_loss=deal.profit,
                                comment=deal.comment,
                                magic=deal.magic,
                            )
                        )
                    except Exception as e:
                        logger.warning(f"Error processing deal {deal.ticket}: {e}")

                logger.debug(f"Retrieved {len(result)} historical deals")
                return result
            except Exception as e:
                logger.error(f"Exception getting history: {e}")
                return []

    @staticmethod
    def _get_mt5_order_type(order_type: OrderType) -> int:
        """Convert OrderType enum to MT5 order type."""
        mapping = {
            OrderType.BUY: mt5.ORDER_TYPE_BUY,
            OrderType.SELL: mt5.ORDER_TYPE_SELL,
            OrderType.BUY_LIMIT: mt5.ORDER_TYPE_BUY_LIMIT,
            OrderType.SELL_LIMIT: mt5.ORDER_TYPE_SELL_LIMIT,
            OrderType.BUY_STOP: mt5.ORDER_TYPE_BUY_STOP,
            OrderType.SELL_STOP: mt5.ORDER_TYPE_SELL_STOP,
        }
        return mapping.get(order_type, mt5.ORDER_TYPE_BUY)

    @staticmethod
    def _get_mt5_timeframe(timeframe: TimeFrame) -> int:
        """Convert TimeFrame enum to MT5 timeframe."""
        mapping = {
            TimeFrame.M1: mt5.TIMEFRAME_M1,
            TimeFrame.M5: mt5.TIMEFRAME_M5,
            TimeFrame.M15: mt5.TIMEFRAME_M15,
            TimeFrame.M30: mt5.TIMEFRAME_M30,
            TimeFrame.H1: mt5.TIMEFRAME_H1,
            TimeFrame.H4: mt5.TIMEFRAME_H4,
            TimeFrame.D1: mt5.TIMEFRAME_D1,
            TimeFrame.W1: mt5.TIMEFRAME_W1,
            TimeFrame.MN1: mt5.TIMEFRAME_MN1,
        }
        return mapping.get(timeframe, mt5.TIMEFRAME_H1)


# Global MT5 connector instance
_mt5_connector: Optional[MT5Connector] = None


def get_mt5_connector() -> MT5Connector:
    """
    Get or create global MT5 connector instance.

    Returns:
        MT5Connector instance
    """
    global _mt5_connector
    if _mt5_connector is None:
        _mt5_connector = MT5Connector()
    return _mt5_connector

"""Pydantic models for MT5 trading operations."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class OrderType(str, Enum):
    """MetaTrader 5 order types."""

    BUY = "buy"
    SELL = "sell"
    BUY_LIMIT = "buy_limit"
    SELL_LIMIT = "sell_limit"
    BUY_STOP = "buy_stop"
    SELL_STOP = "sell_stop"


class OrderAction(str, Enum):
    """Order action types."""

    PLACE = "place"
    MODIFY = "modify"
    CANCEL = "cancel"
    CLOSE = "close"


class TimeFrame(str, Enum):
    """Available timeframes for chart data."""

    M1 = "M1"
    M5 = "M5"
    M15 = "M15"
    M30 = "M30"
    H1 = "H1"
    H4 = "H4"
    D1 = "D1"
    W1 = "W1"
    MN1 = "MN1"


class PlaceOrderRequest(BaseModel):
    """Request model for placing a new order."""

    symbol: str = Field(..., description="Trading symbol (e.g., 'EURUSD')")
    order_type: OrderType = Field(..., description="Type of order")
    volume: float = Field(..., gt=0, description="Order volume/lot size")
    price: Optional[float] = Field(None, description="Price for limit/stop orders")
    stop_loss: Optional[float] = Field(None, description="Stop loss price")
    take_profit: Optional[float] = Field(None, description="Take profit price")
    comment: Optional[str] = Field(None, max_length=31, description="Order comment")
    magic: Optional[int] = Field(0, description="Magic number for order identification")
    deviation: Optional[int] = Field(20, description="Acceptable deviation in points")


class ModifyOrderRequest(BaseModel):
    """Request model for modifying an existing order."""

    ticket: int = Field(..., description="Order ticket number")
    price: Optional[float] = Field(None, description="New price for pending orders")
    stop_loss: Optional[float] = Field(None, description="New stop loss price")
    take_profit: Optional[float] = Field(None, description="New take profit price")
    comment: Optional[str] = Field(None, max_length=31, description="New order comment")


class CloseOrderRequest(BaseModel):
    """Request model for closing an order."""

    ticket: int = Field(..., description="Order ticket number")
    volume: Optional[float] = Field(None, description="Volume to close (partial close)")
    deviation: Optional[int] = Field(20, description="Acceptable deviation in points")


class CancelOrderRequest(BaseModel):
    """Request model for canceling a pending order."""

    ticket: int = Field(..., description="Order ticket number")


class OrderResponse(BaseModel):
    """Response model for order operations."""

    success: bool = Field(..., description="Whether the operation was successful")
    ticket: Optional[int] = Field(None, description="Order ticket number")
    message: str = Field(..., description="Response message")
    retcode: Optional[int] = Field(None, description="MT5 return code")
    bid: Optional[float] = Field(None, description="Current bid price")
    ask: Optional[float] = Field(None, description="Current ask price")


class PositionResponse(BaseModel):
    """Response model for position information."""

    ticket: int = Field(..., description="Position ticket")
    symbol: str = Field(..., description="Trading symbol")
    order_type: OrderType = Field(..., description="Position type")
    volume: float = Field(..., description="Position volume")
    open_price: float = Field(..., description="Position open price")
    current_price: float = Field(..., description="Current market price")
    profit_loss: float = Field(..., description="Position P&L in account currency")
    profit_loss_pips: float = Field(..., description="Position P&L in pips")
    profit_loss_percent: float = Field(..., description="Position P&L in percentage")
    open_time: datetime = Field(..., description="Position open time")
    comment: str = Field(default="", description="Position comment")
    magic: int = Field(default=0, description="Magic number")
    stop_loss: Optional[float] = Field(None, description="Stop loss price")
    take_profit: Optional[float] = Field(None, description="Take profit price")


class OrderHistory(BaseModel):
    """Response model for historical order information."""

    ticket: int = Field(..., description="Order ticket")
    symbol: str = Field(..., description="Trading symbol")
    order_type: OrderType = Field(..., description="Order type")
    volume: float = Field(..., description="Order volume")
    open_price: float = Field(..., description="Open price")
    close_price: float = Field(..., description="Close price")
    open_time: datetime = Field(..., description="Open time")
    close_time: datetime = Field(..., description="Close time")
    profit_loss: float = Field(..., description="Position profit/loss")
    comment: str = Field(default="", description="Order comment")
    magic: int = Field(default=0, description="Magic number")


class TickData(BaseModel):
    """Real-time tick data model."""

    symbol: str = Field(..., description="Trading symbol")
    bid: float = Field(..., description="Current bid price")
    ask: float = Field(..., description="Current ask price")
    bid_volume: int = Field(default=0, description="Bid volume")
    ask_volume: int = Field(default=0, description="Ask volume")
    time: datetime = Field(default_factory=datetime.utcnow, description="Tick time")
    last: Optional[float] = Field(None, description="Last trade price")
    volume: Optional[int] = Field(None, description="Trade volume")


class OHLC(BaseModel):
    """OHLC (candlestick) data model."""

    time: datetime = Field(..., description="Candle time")
    open: float = Field(..., description="Open price")
    high: float = Field(..., description="High price")
    low: float = Field(..., description="Low price")
    close: float = Field(..., description="Close price")
    volume: int = Field(..., description="Candle volume")
    real_volume: Optional[int] = Field(None, description="Real volume")


class AccountInfo(BaseModel):
    """Account information model."""

    login: int = Field(..., description="Account login")
    name: str = Field(..., description="Account name")
    broker: str = Field(..., description="Broker name")
    currency: str = Field(..., description="Account currency")
    balance: float = Field(..., description="Account balance")
    equity: float = Field(..., description="Account equity")
    margin: float = Field(..., description="Used margin")
    margin_free: float = Field(..., description="Free margin")
    margin_level: float = Field(..., description="Margin level percentage")
    leverage: int = Field(..., description="Account leverage")


class SymbolInfo(BaseModel):
    """Symbol information model."""

    symbol: str = Field(..., description="Symbol name")
    description: str = Field(..., description="Symbol description")
    bid: float = Field(..., description="Current bid")
    ask: float = Field(..., description="Current ask")
    point: float = Field(..., description="Point value")
    digits: int = Field(..., description="Number of digits after decimal")
    spread: int = Field(..., description="Spread in points")
    volume: float = Field(..., description="Current volume")
    high: float = Field(..., description="Daily high")
    low: float = Field(..., description="Daily low")


class WebSocketMessage(BaseModel):
    """WebSocket message model."""

    type: str = Field(..., description="Message type")
    data: dict = Field(default_factory=dict, description="Message data")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SubscriptionRequest(BaseModel):
    """WebSocket subscription request."""

    action: str = Field(..., description="Action: 'subscribe' or 'unsubscribe'")
    channel: str = Field(..., description="Channel to subscribe to")
    symbol: Optional[str] = Field(None, description="Symbol for tick subscriptions")

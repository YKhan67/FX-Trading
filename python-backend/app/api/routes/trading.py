"""Trading REST API endpoints."""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Query

from app.core.logging import get_logger
from app.models.mt5_types import (
    CancelOrderRequest,
    CloseOrderRequest,
    ModifyOrderRequest,
    OrderHistory,
    OrderResponse,
    PlaceOrderRequest,
    PositionResponse,
    SymbolInfo,
    TickData,
    TimeFrame,
    OHLC,
)
from app.services.mt5_connector import get_mt5_connector

logger = get_logger(__name__)

router = APIRouter(prefix="/trading", tags=["trading"])


@router.post("/orders/place", response_model=OrderResponse)
async def place_order(request: PlaceOrderRequest) -> OrderResponse:
    """
    Place a new trading order.

    Args:
        request: Order details

    Returns:
        OrderResponse with execution result
    """
    logger.info(
        f"Placing order: {request.symbol} {request.order_type} {request.volume}"
    )
    mt5 = get_mt5_connector()
    return mt5.place_order(request)


@router.post("/orders/modify", response_model=OrderResponse)
async def modify_order(request: ModifyOrderRequest) -> OrderResponse:
    """
    Modify an existing order.

    Args:
        request: Modification details

    Returns:
        OrderResponse with modification result
    """
    logger.info(f"Modifying order: {request.ticket}")
    mt5 = get_mt5_connector()
    return mt5.modify_order(request)


@router.post("/orders/cancel", response_model=OrderResponse)
async def cancel_order(request: CancelOrderRequest) -> OrderResponse:
    """
    Cancel a pending order.

    Args:
        request: Order to cancel

    Returns:
        OrderResponse with cancellation result
    """
    logger.info(f"Canceling order: {request.ticket}")
    mt5 = get_mt5_connector()
    return mt5.cancel_order(request)


@router.post("/positions/close", response_model=OrderResponse)
async def close_position(request: CloseOrderRequest) -> OrderResponse:
    """
    Close an open position.

    Args:
        request: Position to close

    Returns:
        OrderResponse with closure result
    """
    logger.info(f"Closing position: {request.ticket}")
    mt5 = get_mt5_connector()
    return mt5.close_order(request)


@router.get("/positions", response_model=list[PositionResponse])
async def get_positions(symbol: Optional[str] = Query(None)) -> list[PositionResponse]:
    """
    Get all open positions or positions for specific symbol.

    Args:
        symbol: Optional symbol filter

    Returns:
        List of open positions
    """
    logger.info(f"Getting positions for {symbol or 'all symbols'}")
    mt5 = get_mt5_connector()
    return mt5.get_positions(symbol)


@router.get("/account/info")
async def get_account_info():
    """
    Get account information.

    Returns:
        Account details
    """
    logger.info("Getting account info")
    mt5 = get_mt5_connector()
    account = mt5.get_account_info()
    if account:
        return account.model_dump()
    return {"error": "Cannot retrieve account info"}


@router.get("/symbols/{symbol}", response_model=Optional[SymbolInfo])
async def get_symbol_info(symbol: str) -> Optional[SymbolInfo]:
    """
    Get symbol information.

    Args:
        symbol: Trading symbol

    Returns:
        Symbol details
    """
    logger.info(f"Getting symbol info for {symbol}")
    mt5 = get_mt5_connector()
    return mt5.get_symbol_info(symbol)


@router.get("/ticks/{symbol}", response_model=Optional[TickData])
async def get_tick(symbol: str) -> Optional[TickData]:
    """
    Get current tick data.

    Args:
        symbol: Trading symbol

    Returns:
        Current tick data
    """
    logger.debug(f"Getting tick for {symbol}")
    mt5 = get_mt5_connector()
    return mt5.get_tick(symbol)


@router.get("/ohlc/{symbol}", response_model=list[OHLC])
async def get_ohlc(
    symbol: str,
    timeframe: TimeFrame = Query(TimeFrame.H1),
    count: int = Query(100, ge=1, le=1000),
) -> list[OHLC]:
    """
    Get OHLC candlestick data.

    Args:
        symbol: Trading symbol
        timeframe: Candle timeframe
        count: Number of candles to retrieve

    Returns:
        List of OHLC candles
    """
    logger.info(f"Getting {count} {timeframe} candles for {symbol}")
    mt5 = get_mt5_connector()
    return mt5.get_ohlc(symbol, timeframe, count)


@router.get("/history", response_model=list[OrderHistory])
async def get_history(
    symbol: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=365),
) -> list[OrderHistory]:
    """
    Get historical orders and positions.

    Args:
        symbol: Optional symbol filter
        days: Number of days to retrieve history for

    Returns:
        List of historical orders
    """
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    logger.info(f"Getting history for {symbol or 'all symbols'} ({days} days)")
    mt5 = get_mt5_connector()
    return mt5.get_history(symbol or "", start_date, end_date)

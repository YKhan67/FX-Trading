"""Health check endpoints."""

from datetime import datetime

from fastapi import APIRouter

from app.core.logging import get_logger
from app.services.mt5_connector import get_mt5_connector

logger = get_logger(__name__)

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/ping")
async def ping():
    """
    Simple ping endpoint.

    Returns:
        Pong response
    """
    return {"status": "pong", "timestamp": datetime.utcnow().isoformat()}


@router.get("/ready")
async def readiness():
    """
    Readiness check endpoint.

    Returns:
        Service readiness status
    """
    mt5 = get_mt5_connector()

    return {
        "status": "ready",
        "timestamp": datetime.utcnow().isoformat(),
        "mt5_connected": mt5.is_connected(),
    }


@router.get("/live")
async def liveness():
    """
    Liveness check endpoint.

    Returns:
        Service liveness status
    """
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/status")
async def status():
    """
    Detailed service status.

    Returns:
        Comprehensive service status
    """
    mt5 = get_mt5_connector()
    account_info = mt5.get_account_info()

    return {
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "mt5_connected": mt5.is_connected(),
        "account": account_info.model_dump() if account_info else None,
    }

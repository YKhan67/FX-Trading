"""FastAPI application main module."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, trading, websocket
from app.core.config import settings
from app.core.logging import get_logger, setup_logging
from app.services.mt5_connector import get_mt5_connector
from app.services.tick_streamer import get_tick_streamer

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.

    Handles startup and shutdown events.
    """
    # Startup
    logger.info("Starting MT5 Backend API")
    setup_logging()

    mt5 = get_mt5_connector()
    if mt5.connect():
        logger.info("MT5 connected successfully")
    else:
        logger.error("Failed to connect to MT5")

    tick_streamer = get_tick_streamer()
    await tick_streamer.start()
    logger.info("Tick streamer started")

    yield

    # Shutdown
    logger.info("Shutting down MT5 Backend API")
    await tick_streamer.stop()
    logger.info("Tick streamer stopped")

    mt5.disconnect()
    logger.info("MT5 disconnected")


def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application.

    Returns:
        Configured FastAPI application
    """
    app = FastAPI(
        title=settings.api_title,
        version=settings.api_version,
        description="MetaTrader 5 Trading Backend API",
        lifespan=lifespan,
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(health.router)
    app.include_router(trading.router)
    app.include_router(websocket.router)

    # Root endpoint
    @app.get("/")
    async def root():
        """Root endpoint."""
        return {
            "message": "MT5 Backend API",
            "version": settings.api_version,
            "docs": "/docs",
            "redoc": "/redoc",
        }

    # Shutdown hook
    @app.on_event("shutdown")
    async def shutdown():
        """Cleanup on shutdown."""
        logger.info("Application shutdown initiated")

    return app


# Create the application instance
app = create_app()

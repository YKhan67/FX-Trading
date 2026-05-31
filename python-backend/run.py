#!/usr/bin/env python3
"""Entry point for the MT5 Backend API."""

import uvicorn

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def main():
    """Run the FastAPI application."""
    logger.info(
        f"Starting server on {settings.host}:{settings.port} (debug={settings.debug})"
    )

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
        access_log=True,
    )


if __name__ == "__main__":
    main()

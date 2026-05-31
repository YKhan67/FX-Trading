"""Logging configuration using loguru."""

import sys
from pathlib import Path

from loguru import logger

from app.core.config import settings


def setup_logging() -> None:
    """
    Configure loguru for the application.

    Sets up:
    - Console logging with appropriate level
    - File logging with rotation and retention
    - Structured logging format
    """
    # Remove default handler
    logger.remove()

    # Console logging
    log_level = settings.log_level.upper()
    logger.add(
        sys.stdout,
        level=log_level,
        format="<level>{time:YYYY-MM-DD HH:mm:ss}</level> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        colorize=True,
    )

    # File logging with rotation
    log_file = Path(settings.log_file)
    log_file.parent.mkdir(parents=True, exist_ok=True)

    logger.add(
        str(log_file),
        level=log_level,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        rotation=settings.log_rotation,
        retention=settings.log_retention,
    )

    logger.info(f"Logging initialized with level: {log_level}")


def get_logger(name: str):
    """
    Get a logger instance for a specific module.

    Args:
        name: Logger name (typically __name__)

    Returns:
        Configured logger instance
    """
    return logger.bind(module=name)

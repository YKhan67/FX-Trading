"""Configuration management using Pydantic settings."""

from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration settings."""

    # MetaTrader 5 Configuration
    mt5_login: int = 12345678
    mt5_password: str = "your_password"
    mt5_server: str = "BrokerName-Demo"
    mt5_timeout: int = 60000  # milliseconds

    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    api_title: str = "MT5 Backend API"
    api_version: str = "1.0.0"

    # Supabase Configuration
    supabase_url: str = "your_supabase_url"
    supabase_key: str = "your_supabase_key"

    # Security
    api_secret_key: str = "your-secret-key-change-in-production"
    jwt_secret: str = "your-jwt-secret"
    allowed_origins: list = ["*"]

    # Trading Configuration
    default_lot_size: float = 0.01
    max_slippage_pips: float = 3.0
    execution_timeout: int = 5000  # milliseconds
    max_positions: int = 10
    max_pending_orders: int = 20

    # Logging Configuration
    log_level: str = "INFO"
    log_file: str = "logs/mt5_backend.log"
    log_rotation: str = "500 MB"
    log_retention: str = "30 days"

    # Connection Pool Configuration
    mt5_connection_pool_size: int = 5
    websocket_heartbeat_interval: int = 30  # seconds
    websocket_timeout: int = 300  # seconds

    class Config:
        """Pydantic config."""

        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()

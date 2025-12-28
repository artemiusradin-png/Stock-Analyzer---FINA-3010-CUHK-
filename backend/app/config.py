"""Application Configuration"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Database
    DATABASE_URL: str = "postgresql://portfolio_user:portfolio_pass@localhost:5432/portfolio_db"

    # API Keys
    FINNHUB_API_KEY: str = "d10doh1r01qlsac8fq2gd10doh1r01qlsac8fq30"
    FRED_API_KEY: str = "01b4c1c4a8763cb79b98119a3c32d0a8"
    EOD_API_KEY: str = "692e837b7e7e92.63340340"
    OPENAI_API_KEY: str = ""  # OpenAI API key for AI NPV features

    # Redis (optional)
    REDIS_URL: str = "redis://localhost:6379/0"
    USE_REDIS: bool = False

    # Application
    APP_NAME: str = "Portfolio Management API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # CORS - Allow all origins in production (can be restricted via environment variable)
    CORS_ORIGINS: List[str] = ["*"]  # Allows all origins - backend uses allow_origins=["*"] in main.py

    # Default Financial Parameters
    DEFAULT_RISK_FREE_RATE: float = 0.045
    DEFAULT_ERP: float = 0.055
    DEFAULT_TAX_RATE: float = 0.25
    DEFAULT_TERMINAL_GROWTH: float = 0.025
    DEFAULT_FORECAST_YEARS: int = 10

    # Valuation Bounds
    MIN_WACC: float = 0.02
    MAX_WACC: float = 0.15
    MIN_TERMINAL_GROWTH: float = 0.0
    MAX_TERMINAL_GROWTH: float = 0.03

    # Portfolio Optimization
    DEFAULT_TARGET_RETURN: float = 0.10
    MIN_PORTFOLIO_WEIGHT: float = 0.0
    MAX_PORTFOLIO_WEIGHT: float = 0.40

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

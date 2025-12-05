"""Pydantic schemas for portfolio endpoints"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime


class PortfolioCreate(BaseModel):
    """Create new portfolio request"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    strategy: str = Field("max_sharpe", description="Optimization strategy")
    target_return: Optional[float] = Field(None, ge=0.0, le=1.0)
    max_position_weight: float = Field(0.40, ge=0.0, le=1.0)
    min_position_weight: float = Field(0.0, ge=0.0, le=1.0)
    allow_short: bool = False


class AssetInput(BaseModel):
    """Input for a single asset in portfolio optimization"""
    ticker: str
    expected_return: Optional[float] = None  # If not provided, will be calculated
    dcf_upside: Optional[float] = None  # For DCF-weighted strategy


class PortfolioOptimizationRequest(BaseModel):
    """Request for portfolio optimization"""
    assets: List[AssetInput] = Field(..., min_items=2)
    strategy: str = Field("max_sharpe")
    constraints: Optional[Dict] = None
    lookback_days: int = Field(252, ge=30, le=1000)
    risk_free_rate: float = Field(0.045, ge=0.0, le=0.10)


class HoldingResponse(BaseModel):
    """Portfolio holding information"""
    ticker: str
    weight: float
    expected_return: Optional[float]
    volatility: Optional[float]
    contribution_to_return: Optional[float]
    contribution_to_risk: Optional[float]


class PortfolioResponse(BaseModel):
    """Portfolio optimization response"""
    portfolio_id: Optional[int]
    name: Optional[str]
    strategy: str
    holdings: List[HoldingResponse]
    expected_return: float
    volatility: float
    sharpe_ratio: float


class EfficientFrontierRequest(BaseModel):
    """Request for efficient frontier calculation"""
    tickers: List[str] = Field(..., min_items=2)
    lookback_days: int = Field(252, ge=30, le=1000)
    n_points: int = Field(50, ge=10, le=200)
    risk_free_rate: float = Field(0.045)


class EfficientFrontierPoint(BaseModel):
    """Single point on efficient frontier"""
    target_return: float
    return_achieved: float
    volatility: float
    sharpe_ratio: float
    weights: List[float]


class EfficientFrontierResponse(BaseModel):
    """Efficient frontier response"""
    tickers: List[str]
    frontier: List[EfficientFrontierPoint]
    max_sharpe_point: EfficientFrontierPoint
    min_variance_point: EfficientFrontierPoint

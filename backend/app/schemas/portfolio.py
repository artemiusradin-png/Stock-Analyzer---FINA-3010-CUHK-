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


class MonteCarloRequest(BaseModel):
    """Request for Monte Carlo simulation"""
    tickers: List[str] = Field(..., min_items=2)
    lookback_days: int = Field(252, ge=30, le=1000)
    n_simulations: int = Field(1000, ge=100, le=10000)
    time_horizon_days: int = Field(252, ge=30, le=1000)
    risk_free_rate: float = Field(0.045)


class MonteCarloPoint(BaseModel):
    """Single Monte Carlo simulation result"""
    return_simulated: float
    volatility_simulated: float
    sharpe_ratio: float
    weights: List[float]


class MonteCarloResponse(BaseModel):
    """Monte Carlo simulation response"""
    tickers: List[str]
    simulations: List[MonteCarloPoint]
    mean_return: float
    mean_volatility: float
    percentile_5_return: float
    percentile_95_return: float


class RiskAnalyticsRequest(BaseModel):
    """Request for risk analytics"""
    tickers: List[str] = Field(..., min_items=1)
    weights: Optional[List[float]] = None  # If None, assumes equal weight
    lookback_days: int = Field(252, ge=30, le=1000)
    risk_free_rate: float = Field(0.045)
    confidence_level: float = Field(0.95, ge=0.80, le=0.99)


class RiskMetrics(BaseModel):
    """Risk metrics for portfolio or asset"""
    # Volatility metrics
    annualized_volatility: float
    downside_volatility: float

    # Market risk (for individual assets vs benchmark)
    beta: Optional[float] = None
    alpha: Optional[float] = None
    r_squared: Optional[float] = None

    # Downside risk
    value_at_risk: float  # VaR at confidence level
    conditional_value_at_risk: float  # CVaR (Expected Shortfall)
    max_drawdown: float

    # Risk-adjusted returns
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float

    # Distribution metrics
    skewness: float
    kurtosis: float


class RiskDecomposition(BaseModel):
    """Portfolio risk decomposition"""
    ticker: str
    weight: float
    marginal_var: float  # Marginal contribution to VaR
    component_var: float  # Component VaR (weight * marginal VaR)
    percent_contribution_to_risk: float


class RiskAnalyticsResponse(BaseModel):
    """Risk analytics response"""
    portfolio_metrics: RiskMetrics
    risk_decomposition: List[RiskDecomposition]
    systematic_risk: float  # Portion of risk from market
    idiosyncratic_risk: float  # Portion of risk from individual assets

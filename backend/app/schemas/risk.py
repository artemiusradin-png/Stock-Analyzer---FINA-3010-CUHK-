"""Pydantic schemas for risk analytics endpoints"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict


class RiskMetricsResponse(BaseModel):
    """Comprehensive risk metrics response"""
    ticker: Optional[str]

    # Volatility
    volatility: float
    downside_volatility: float

    # Market risk
    beta: float
    alpha: float
    r_squared: float

    # Downside risk
    var_95: float
    var_99: float
    cvar_95: float
    max_drawdown: float
    max_drawdown_duration: int

    # Risk-adjusted returns
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float

    # Distribution
    skewness: float
    kurtosis: float


class PortfolioRiskResponse(BaseModel):
    """Portfolio risk decomposition response"""
    total_risk: float
    systematic_risk: float
    idiosyncratic_risk: float
    marginal_var: Dict[str, float]
    component_var: Dict[str, float]
    percent_contribution: Dict[str, float]


class RiskAnalysisRequest(BaseModel):
    """Request for risk analysis"""
    ticker: Optional[str] = None
    tickers: Optional[List[str]] = None
    weights: Optional[List[float]] = None
    lookback_days: int = Field(252, ge=30, le=1000)
    benchmark_ticker: str = "SPY"
    risk_free_rate: float = 0.045

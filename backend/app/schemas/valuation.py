"""Pydantic schemas for DCF valuation endpoints"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime


class DCFParameters(BaseModel):
    """Input parameters for DCF calculation"""
    ticker: str = Field(..., description="Stock ticker symbol")

    # Starting assumptions
    revenue_growth_start: Optional[float] = Field(0.08, ge=-0.5, le=2.0)
    ebit_margin_start: Optional[float] = Field(0.25, ge=0.0, le=1.0)
    dna_ratio_start: Optional[float] = Field(0.04, ge=0.0, le=0.5)
    capex_ratio_start: Optional[float] = Field(0.05, ge=0.0, le=0.5)
    nwc_ratio_start: Optional[float] = Field(0.02, ge=-0.5, le=0.5)
    tax_rate_start: Optional[float] = Field(0.25, ge=0.0, le=0.6)

    # Terminal assumptions
    revenue_growth_terminal: Optional[float] = Field(0.03, ge=-0.1, le=0.1)
    ebit_margin_terminal: Optional[float] = Field(0.20, ge=0.0, le=1.0)
    terminal_growth: Optional[float] = Field(0.025, ge=0.0, le=0.03)

    # Discount rate
    discount_rate: Optional[float] = Field(None, ge=0.02, le=0.30)
    risk_free_rate: Optional[float] = Field(0.045, ge=0.0, le=0.10)
    erp: Optional[float] = Field(0.055, ge=0.03, le=0.10)
    cost_of_debt: Optional[float] = Field(None, ge=0.0, le=0.15)

    # Forecast horizon
    forecast_period: int = Field(10, ge=5, le=20)


class ProjectionYear(BaseModel):
    """Single year projection data"""
    year: int
    revenue: float
    revenue_growth_pct: float
    ebit: float
    ebit_margin_pct: float
    fcf: float
    pv_fcf: float
    tax_rate_pct: float
    nopat: float
    reinvestment: float


class DCFResult(BaseModel):
    """DCF valuation results"""
    ticker: str
    company_name: Optional[str]
    sector: Optional[str]
    industry: Optional[str]
    country: Optional[str]

    # Valuation outputs
    current_price: float
    implied_price: float
    upside_downside: float
    enterprise_value: float
    equity_value: float
    terminal_value: float
    pv_terminal: float

    # WACC components
    wacc: float
    cost_of_equity: float
    cost_of_debt: float
    risk_free_rate: float
    erp: float
    beta: float
    unlevered_beta: float

    # Capital structure
    market_cap: float
    debt: float
    cash: float
    shares_outstanding: float

    # Projections
    projections: List[ProjectionYear]


class ScenarioResult(BaseModel):
    """Results from multi-scenario analysis"""
    scenario_type: str
    implied_price: float
    upside_downside: float
    assumptions: Dict[str, float]


class MultiScenarioResponse(BaseModel):
    """Response for multi-scenario analysis"""
    ticker: str
    current_price: float
    scenarios: List[ScenarioResult]
    probability_weighted_price: Optional[float] = None


class SensitivityResponse(BaseModel):
    """Response for sensitivity analysis"""
    waccs: List[float]
    tgrs: List[float]
    price_surface: List[List[float]]
    base_wacc: float
    base_tgr: float
    base_price: float
    current_price: float

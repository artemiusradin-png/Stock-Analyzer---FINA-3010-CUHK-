"""Valuation models for DCF and scenarios"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class ScenarioType(str, enum.Enum):
    """DCF scenario types"""
    BASE = "base"
    BULL = "bull"
    BEAR = "bear"
    OPTIMISTIC = "optimistic"
    PESSIMISTIC = "pessimistic"


class DCFValuation(Base):
    """DCF valuation results"""
    __tablename__ = "dcf_valuations"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), ForeignKey("assets.ticker"), index=True)
    scenario_type = Column(Enum(ScenarioType), default=ScenarioType.BASE)

    # Valuation outputs
    enterprise_value = Column(Float)
    equity_value = Column(Float)
    implied_price = Column(Float)
    current_price = Column(Float)
    upside_downside = Column(Float)

    # Terminal value
    terminal_value = Column(Float)
    pv_terminal = Column(Float)
    terminal_growth = Column(Float)

    # WACC components
    wacc = Column(Float)
    cost_of_equity = Column(Float)
    cost_of_debt = Column(Float)
    risk_free_rate = Column(Float)
    erp = Column(Float)
    beta = Column(Float)
    unlevered_beta = Column(Float)

    # Capital structure
    market_cap = Column(Float)
    debt = Column(Float)
    cash = Column(Float)
    shares_outstanding = Column(Float)

    # Projections (stored as JSON)
    projections = Column(JSON)

    # Sensitivity analysis
    sensitivity_data = Column(JSON)

    # Metadata
    forecast_period = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    parameters = Column(JSON)

    def __repr__(self):
        return f"<DCFValuation(ticker='{self.ticker}', scenario='{self.scenario_type}', implied_price={self.implied_price})>"


class ScenarioValuation(Base):
    """Multi-scenario valuation results"""
    __tablename__ = "scenario_valuations"

    id = Column(Integer, primary_key=True, index=True)
    dcf_valuation_id = Column(Integer, ForeignKey("dcf_valuations.id"))
    ticker = Column(String(20), index=True)
    scenario_name = Column(String(50))

    # Scenario assumptions
    revenue_growth = Column(Float)
    ebit_margin = Column(Float)
    terminal_growth = Column(Float)
    wacc = Column(Float)

    # Results
    implied_price = Column(Float)
    upside_downside = Column(Float)
    probability = Column(Float)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<ScenarioValuation(ticker='{self.ticker}', scenario='{self.scenario_name}', price={self.implied_price})>"

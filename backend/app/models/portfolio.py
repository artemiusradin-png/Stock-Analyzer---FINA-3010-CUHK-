"""Portfolio models for optimization and performance tracking"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class PortfolioStrategy(str, enum.Enum):
    """Portfolio optimization strategies"""
    MAX_SHARPE = "max_sharpe"
    MIN_VARIANCE = "min_variance"
    TARGET_RETURN = "target_return"
    RISK_PARITY = "risk_parity"
    DCF_WEIGHTED = "dcf_weighted"
    EQUAL_WEIGHT = "equal_weight"


class Portfolio(Base):
    """Portfolio configuration and metadata"""
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1000))
    strategy = Column(Enum(PortfolioStrategy), default=PortfolioStrategy.MAX_SHARPE)

    # Optimization parameters
    target_return = Column(Float)
    max_position_weight = Column(Float, default=0.40)
    min_position_weight = Column(Float, default=0.0)
    allow_short = Column(Boolean, default=False)

    # Current state
    total_value = Column(Float, default=0.0)
    cash = Column(Float, default=0.0)

    # Performance metrics
    expected_return = Column(Float)
    expected_volatility = Column(Float)
    sharpe_ratio = Column(Float)

    # Holdings (relationship)
    holdings = relationship("PortfolioHolding", back_populates="portfolio", cascade="all, delete-orphan")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_rebalanced = Column(DateTime(timezone=True))

    def __repr__(self):
        return f"<Portfolio(name='{self.name}', strategy='{self.strategy}')>"


class PortfolioHolding(Base):
    """Individual holdings within a portfolio"""
    __tablename__ = "portfolio_holdings"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    ticker = Column(String(20), ForeignKey("assets.ticker"), nullable=False)

    # Position details
    weight = Column(Float, nullable=False)
    shares = Column(Float)
    cost_basis = Column(Float)
    current_value = Column(Float)

    # Contribution to portfolio
    contribution_to_return = Column(Float)
    contribution_to_risk = Column(Float)

    # Relationship
    portfolio = relationship("Portfolio", back_populates="holdings")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_updated = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<PortfolioHolding(ticker='{self.ticker}', weight={self.weight})>"


class PortfolioPerformance(Base):
    """Time-series portfolio performance metrics"""
    __tablename__ = "portfolio_performance"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)

    # Performance metrics
    total_value = Column(Float)
    daily_return = Column(Float)
    cumulative_return = Column(Float)
    volatility = Column(Float)
    sharpe_ratio = Column(Float)

    # Risk metrics
    beta = Column(Float)
    var_95 = Column(Float)
    cvar_95 = Column(Float)
    max_drawdown = Column(Float)

    # Holdings snapshot
    holdings_snapshot = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<PortfolioPerformance(portfolio_id={self.portfolio_id}, date={self.date}, value={self.total_value})>"

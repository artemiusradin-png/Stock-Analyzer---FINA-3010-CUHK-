"""Market data models for historical prices and returns"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base


class HistoricalPrice(Base):
    """Historical price data for assets"""
    __tablename__ = "historical_prices"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), ForeignKey("assets.ticker"), index=True)
    date = Column(Date, nullable=False, index=True)

    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    adjusted_close = Column(Float)
    volume = Column(Float)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<HistoricalPrice(ticker='{self.ticker}', date={self.date}, close={self.close})>"


class AssetReturn(Base):
    """Calculated returns for assets"""
    __tablename__ = "asset_returns"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), ForeignKey("assets.ticker"), index=True)
    date = Column(Date, nullable=False, index=True)

    daily_return = Column(Float)
    log_return = Column(Float)
    cumulative_return = Column(Float)

    # Rolling statistics
    volatility_30d = Column(Float)
    volatility_90d = Column(Float)
    rolling_beta_30d = Column(Float)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<AssetReturn(ticker='{self.ticker}', date={self.date}, return={self.daily_return})>"


class CovarianceMatrix(Base):
    """Covariance matrix for portfolio optimization"""
    __tablename__ = "covariance_matrix"

    id = Column(Integer, primary_key=True, index=True)
    matrix_date = Column(Date, nullable=False, index=True)
    lookback_period = Column(Integer, default=252)

    # Tickers included
    tickers = Column(JSON)

    # Matrix data (stored as JSON)
    covariance_data = Column(JSON)
    correlation_data = Column(JSON)

    # Expected returns
    expected_returns = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<CovarianceMatrix(date={self.matrix_date}, tickers={len(self.tickers) if self.tickers else 0})>"

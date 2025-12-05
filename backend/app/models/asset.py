"""Asset model for storing ticker metadata"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base


class Asset(Base):
    """Asset metadata and fundamental data"""
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(255))
    sector = Column(String(100))
    industry = Column(String(100))
    country = Column(String(50))
    exchange = Column(String(50))
    currency = Column(String(10))

    # Market data
    market_cap = Column(Float)
    current_price = Column(Float)
    shares_outstanding = Column(Float)
    beta = Column(Float)

    # Financial metrics
    revenue = Column(Float)
    ebit = Column(Float)
    net_income = Column(Float)
    total_debt = Column(Float)
    cash = Column(Float)
    cost_of_debt = Column(Float)

    # Status
    is_active = Column(Boolean, default=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Asset(ticker='{self.ticker}', name='{self.name}')>"

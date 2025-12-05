"""Sentiment analysis models for news and market sentiment"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.sql import func
import enum
from app.database import Base


class SentimentPolarity(str, enum.Enum):
    """Sentiment classification"""
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class NewsSentiment(Base):
    """Individual news article sentiment"""
    __tablename__ = "news_sentiment"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), ForeignKey("assets.ticker"), index=True)

    # Article metadata
    headline = Column(String(500))
    summary = Column(Text)
    source = Column(String(100))
    url = Column(String(1000))
    published_at = Column(DateTime(timezone=True))

    # Sentiment scores
    sentiment_score = Column(Float)
    sentiment_polarity = Column(Enum(SentimentPolarity))
    compound_score = Column(Float)
    positive_score = Column(Float)
    negative_score = Column(Float)
    neutral_score = Column(Float)

    # Impact
    relevance_score = Column(Float)
    recency_weight = Column(Float)
    impact_on_valuation = Column(Float)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<NewsSentiment(ticker='{self.ticker}', headline='{self.headline[:50]}...', score={self.sentiment_score})>"


class SentimentSummary(Base):
    """Aggregated sentiment summary for a ticker"""
    __tablename__ = "sentiment_summary"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), ForeignKey("assets.ticker"), unique=True, index=True)

    # Aggregate scores
    overall_sentiment = Column(Float)
    sentiment_trend = Column(String(20))
    avg_sentiment_7d = Column(Float)
    avg_sentiment_30d = Column(Float)

    # Volume metrics
    news_volume_7d = Column(Integer)
    news_volume_30d = Column(Integer)
    positive_ratio = Column(Float)
    negative_ratio = Column(Float)

    # Valuation impact
    sentiment_adjustment = Column(Float)
    adjusted_growth_rate = Column(Float)
    confidence_score = Column(Float)

    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<SentimentSummary(ticker='{self.ticker}', overall={self.overall_sentiment}, trend='{self.sentiment_trend}')>"

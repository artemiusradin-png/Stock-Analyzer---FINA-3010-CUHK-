"""Pydantic schemas for sentiment analysis endpoints"""
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class NewsArticleResponse(BaseModel):
    """News article with sentiment"""
    headline: str
    summary: str
    source: str
    url: str
    published_at: datetime
    sentiment_score: float
    sentiment_polarity: str
    relevance_score: Optional[float]


class SentimentSummaryResponse(BaseModel):
    """Aggregated sentiment summary"""
    ticker: str
    overall_sentiment: float
    sentiment_trend: str
    avg_sentiment_7d: float
    avg_sentiment_30d: float
    news_volume_7d: int
    news_volume_30d: int
    positive_ratio: float
    negative_ratio: float
    sentiment_adjustment: float
    confidence: float
    last_updated: datetime


class SentimentRequest(BaseModel):
    """Request for sentiment analysis"""
    ticker: str
    days: int = 30

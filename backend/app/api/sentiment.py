"""Sentiment analysis API endpoints"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from typing import List

from app.schemas.sentiment import (
    SentimentRequest,
    SentimentSummaryResponse,
    NewsArticleResponse
)
from app.services.sentiment_engine import SentimentEngine
from app.config import settings

router = APIRouter()
sentiment_engine = SentimentEngine(finnhub_api_key=settings.FINNHUB_API_KEY)


@router.post("/analyze", response_model=SentimentSummaryResponse)
async def analyze_sentiment(request: SentimentRequest):
    """
    Analyze news sentiment for a ticker

    Fetches recent news and calculates aggregate sentiment metrics
    """
    try:
        summary = sentiment_engine.get_sentiment_summary(request.ticker)

        return SentimentSummaryResponse(
            ticker=summary.ticker,
            overall_sentiment=summary.overall_score,
            sentiment_trend=summary.trend,
            avg_sentiment_7d=summary.avg_7d,
            avg_sentiment_30d=summary.avg_30d,
            news_volume_7d=summary.news_volume_7d,
            news_volume_30d=summary.news_volume_30d,
            positive_ratio=summary.positive_ratio,
            negative_ratio=summary.negative_ratio,
            sentiment_adjustment=summary.sentiment_adjustment,
            confidence=summary.confidence,
            last_updated=datetime.now()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/news/{ticker}", response_model=List[NewsArticleResponse])
async def get_news_with_sentiment(ticker: str, days: int = 7):
    """
    Get news articles with sentiment scores for a ticker
    """
    try:
        articles = sentiment_engine.fetch_news(
            ticker,
            start_date=datetime.now() - timedelta(days=days)
        )

        responses = []
        for article in articles[:50]:  # Limit to 50 articles
            text = f"{article.headline} {article.summary}"
            sentiment = sentiment_engine.analyze_sentiment(text)

            responses.append(NewsArticleResponse(
                headline=article.headline,
                summary=article.summary,
                source=article.source,
                url=article.url,
                published_at=article.published_at,
                sentiment_score=sentiment.compound,
                sentiment_polarity=sentiment.polarity,
                relevance_score=None
            ))

        return responses

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

"""Sentiment Analysis Engine with Finnhub Integration"""
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
import numpy as np
import pandas as pd

try:
    import finnhub
    FINNHUB_AVAILABLE = True
except ImportError:
    FINNHUB_AVAILABLE = False
    print("Warning: finnhub-python not installed")

try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    VADER_AVAILABLE = True
except ImportError:
    VADER_AVAILABLE = False
    print("Warning: vaderSentiment not installed")

try:
    from textblob import TextBlob
    TEXTBLOB_AVAILABLE = True
except ImportError:
    TEXTBLOB_AVAILABLE = False
    print("Warning: textblob not installed")


@dataclass
class NewsArticle:
    """News article data structure"""
    headline: str
    summary: str
    source: str
    url: str
    published_at: datetime
    category: Optional[str] = None
    related_tickers: Optional[List[str]] = None


@dataclass
class SentimentScore:
    """Sentiment analysis results for a single article"""
    compound: float
    positive: float
    negative: float
    neutral: float
    polarity: str  # 'positive', 'neutral', 'negative'
    confidence: float


@dataclass
class AggregateSentiment:
    """Aggregated sentiment for a ticker"""
    ticker: str
    overall_score: float
    trend: str  # 'bullish', 'neutral', 'bearish'
    avg_7d: float
    avg_30d: float
    news_volume_7d: int
    news_volume_30d: int
    positive_ratio: float
    negative_ratio: float
    sentiment_adjustment: float  # Impact on valuation (-X% to +X%)
    confidence: float


class SentimentEngine:
    """News sentiment analysis and aggregation"""

    def __init__(self, finnhub_api_key: Optional[str] = None):
        self.finnhub_api_key = finnhub_api_key
        self.finnhub_client = None

        if FINNHUB_AVAILABLE and finnhub_api_key:
            self.finnhub_client = finnhub.Client(api_key=finnhub_api_key)

        if VADER_AVAILABLE:
            self.vader = SentimentIntensityAnalyzer()
        else:
            self.vader = None

    def fetch_news(
        self,
        ticker: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[NewsArticle]:
        """Fetch news from Finnhub"""
        if not self.finnhub_client:
            return []

        if start_date is None:
            start_date = datetime.now() - timedelta(days=30)
        if end_date is None:
            end_date = datetime.now()

        try:
            news_data = self.finnhub_client.company_news(
                ticker,
                _from=start_date.strftime('%Y-%m-%d'),
                to=end_date.strftime('%Y-%m-%d')
            )

            articles = []
            for item in news_data:
                article = NewsArticle(
                    headline=item.get('headline', ''),
                    summary=item.get('summary', ''),
                    source=item.get('source', ''),
                    url=item.get('url', ''),
                    published_at=datetime.fromtimestamp(item.get('datetime', 0)),
                    category=item.get('category', None),
                    related_tickers=item.get('related', [])
                )
                articles.append(article)

            return articles

        except Exception as e:
            print(f"Error fetching news for {ticker}: {e}")
            return []

    def analyze_sentiment(self, text: str) -> SentimentScore:
        """
        Analyze sentiment of text using multiple methods
        Combines VADER and TextBlob for robust scoring
        """
        if not text:
            return SentimentScore(0.0, 0.0, 0.0, 1.0, 'neutral', 0.0)

        scores = []

        # VADER sentiment
        if self.vader and VADER_AVAILABLE:
            vader_scores = self.vader.polarity_scores(text)
            scores.append({
                'compound': vader_scores['compound'],
                'pos': vader_scores['pos'],
                'neg': vader_scores['neg'],
                'neu': vader_scores['neu']
            })

        # TextBlob sentiment
        if TEXTBLOB_AVAILABLE:
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity  # -1 to 1
            subjectivity = blob.sentiment.subjectivity  # 0 to 1

            scores.append({
                'compound': polarity,
                'pos': max(0, polarity),
                'neg': max(0, -polarity),
                'neu': 1 - subjectivity
            })

        # Average scores if multiple methods available
        if scores:
            avg_compound = np.mean([s['compound'] for s in scores])
            avg_pos = np.mean([s['pos'] for s in scores])
            avg_neg = np.mean([s['neg'] for s in scores])
            avg_neu = np.mean([s['neu'] for s in scores])
        else:
            # Fallback to simple keyword-based sentiment
            positive_keywords = ['buy', 'bullish', 'growth', 'profit', 'gain', 'beat', 'strong', 'upgrade']
            negative_keywords = ['sell', 'bearish', 'loss', 'decline', 'miss', 'weak', 'downgrade', 'risk']

            text_lower = text.lower()
            pos_count = sum(1 for kw in positive_keywords if kw in text_lower)
            neg_count = sum(1 for kw in negative_keywords if kw in text_lower)

            total = max(1, pos_count + neg_count)
            avg_pos = pos_count / total
            avg_neg = neg_count / total
            avg_neu = 1 - (avg_pos + avg_neg)
            avg_compound = (avg_pos - avg_neg)

        # Determine polarity
        if avg_compound >= 0.05:
            polarity = 'positive'
        elif avg_compound <= -0.05:
            polarity = 'negative'
        else:
            polarity = 'neutral'

        # Confidence based on strength of signal
        confidence = abs(avg_compound)

        return SentimentScore(
            compound=avg_compound,
            positive=avg_pos,
            negative=avg_neg,
            neutral=avg_neu,
            polarity=polarity,
            confidence=confidence
        )

    def calculate_recency_weight(self, published_at: datetime, decay_days: int = 7) -> float:
        """Calculate weight based on article recency (exponential decay)"""
        age_days = (datetime.now() - published_at).days
        weight = np.exp(-age_days / decay_days)
        return weight

    def aggregate_sentiment(
        self,
        ticker: str,
        articles: List[Tuple[NewsArticle, SentimentScore]]
    ) -> AggregateSentiment:
        """
        Aggregate sentiment across multiple news articles

        Applies recency weighting and calculates various metrics
        """
        if not articles:
            return AggregateSentiment(
                ticker=ticker,
                overall_score=0.0,
                trend='neutral',
                avg_7d=0.0,
                avg_30d=0.0,
                news_volume_7d=0,
                news_volume_30d=0,
                positive_ratio=0.0,
                negative_ratio=0.0,
                sentiment_adjustment=0.0,
                confidence=0.0
            )

        now = datetime.now()
        scores_7d = []
        scores_30d = []
        weighted_scores = []

        for article, sentiment in articles:
            age = (now - article.published_at).days

            if age <= 7:
                scores_7d.append(sentiment.compound)
            if age <= 30:
                scores_30d.append(sentiment.compound)

            # Recency weight
            weight = self.calculate_recency_weight(article.published_at)
            weighted_scores.append(sentiment.compound * weight)

        # Calculate metrics
        overall_score = np.mean(weighted_scores) if weighted_scores else 0.0
        avg_7d = np.mean(scores_7d) if scores_7d else 0.0
        avg_30d = np.mean(scores_30d) if scores_30d else 0.0

        news_volume_7d = len(scores_7d)
        news_volume_30d = len(scores_30d)

        # Positive/negative ratios
        positive_count = sum(1 for _, s in articles if s.polarity == 'positive')
        negative_count = sum(1 for _, s in articles if s.polarity == 'negative')
        total = len(articles)

        positive_ratio = positive_count / total if total > 0 else 0.0
        negative_ratio = negative_count / total if total > 0 else 0.0

        # Determine trend
        if overall_score >= 0.1:
            trend = 'bullish'
        elif overall_score <= -0.1:
            trend = 'bearish'
        else:
            trend = 'neutral'

        # Calculate sentiment adjustment for valuation
        # Map sentiment [-1, 1] to adjustment [-10%, +10%]
        sentiment_adjustment = overall_score * 10.0

        # Confidence based on volume and consistency
        score_std = np.std([s for _, s in articles for s in [s.compound]]) if articles else 1.0
        volume_factor = min(1.0, news_volume_7d / 20.0)  # Normalize by expected volume
        consistency_factor = 1.0 - min(1.0, score_std)
        confidence = (volume_factor + consistency_factor) / 2.0

        return AggregateSentiment(
            ticker=ticker,
            overall_score=overall_score,
            trend=trend,
            avg_7d=avg_7d,
            avg_30d=avg_30d,
            news_volume_7d=news_volume_7d,
            news_volume_30d=news_volume_30d,
            positive_ratio=positive_ratio,
            negative_ratio=negative_ratio,
            sentiment_adjustment=sentiment_adjustment,
            confidence=confidence
        )

    def apply_sentiment_to_valuation(
        self,
        base_growth_rate: float,
        sentiment_adjustment: float,
        confidence: float,
        max_adjustment: float = 0.05
    ) -> float:
        """
        Apply sentiment adjustment to growth rate

        Args:
            base_growth_rate: Base revenue growth rate
            sentiment_adjustment: Sentiment-based adjustment percentage
            confidence: Confidence in sentiment (0-1)
            max_adjustment: Maximum adjustment to apply (default 5%)

        Returns:
            Adjusted growth rate
        """
        # Scale adjustment by confidence
        effective_adjustment = (sentiment_adjustment / 100.0) * confidence

        # Cap the adjustment
        effective_adjustment = np.clip(effective_adjustment, -max_adjustment, max_adjustment)

        # Apply to base growth rate
        adjusted_growth = base_growth_rate * (1 + effective_adjustment)

        return adjusted_growth

    def get_sentiment_summary(self, ticker: str) -> AggregateSentiment:
        """
        Complete sentiment analysis pipeline for a ticker

        1. Fetch news from Finnhub
        2. Analyze sentiment for each article
        3. Aggregate and calculate metrics
        """
        # Fetch news
        articles = self.fetch_news(ticker, start_date=datetime.now() - timedelta(days=30))

        if not articles:
            return AggregateSentiment(
                ticker=ticker,
                overall_score=0.0,
                trend='neutral',
                avg_7d=0.0,
                avg_30d=0.0,
                news_volume_7d=0,
                news_volume_30d=0,
                positive_ratio=0.0,
                negative_ratio=0.0,
                sentiment_adjustment=0.0,
                confidence=0.0
            )

        # Analyze sentiment for each article
        analyzed_articles = []
        for article in articles:
            text = f"{article.headline} {article.summary}"
            sentiment = self.analyze_sentiment(text)
            analyzed_articles.append((article, sentiment))

        # Aggregate
        return self.aggregate_sentiment(ticker, analyzed_articles)

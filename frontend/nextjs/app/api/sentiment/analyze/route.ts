import { NextRequest, NextResponse } from 'next/server';
import { FinnhubService } from '@/lib/finnhub-service';
import { OpenAIService } from '@/lib/openai-service';
import { SentimentScoringEngine, type NewsArticle } from '@/lib/sentiment-scoring';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticker, days = 30 } = body;

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    const finnhubService = new FinnhubService();

    // Fetch news articles from Finnhub company-news
    const today = new Date();
    const fromDate = new Date();
    fromDate.setDate(today.getDate() - days);
    
    const finnhubNewsRaw = await finnhubService.getNews(
      ticker,
      fromDate.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );
    
    // Also fetch headlines from Yahoo Finance RSS to diversify sources
    let yahooNews: any[] = [];
    try {
      const yahooUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
        ticker
      )}&region=US&lang=en-US`;
      const yahooResponse = await fetch(yahooUrl);
      if (yahooResponse.ok) {
        const rss = await yahooResponse.text();
        // Very lightweight RSS parsing - enough for titles and links
        const itemBlocks = rss.split('<item>').slice(1);
        yahooNews = itemBlocks.slice(0, 15).map((block) => {
          const getTag = (tag: string) => {
            const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
            const match = block.match(regex);
            return match ? match[1].replace(/<!\\[CDATA\\[|\\]\\]>/g, '').trim() : '';
          };
          const headline = getTag('title');
          const summary = getTag('description');
          const url = getTag('link');
          const pubDate = getTag('pubDate');
          const datetime = pubDate ? Date.parse(pubDate) / 1000 : undefined;
          return {
            headline,
            summary,
            source: 'Yahoo Finance',
            datetime,
            url,
            _source_type: 'yahoo',
          };
        });
      }
    } catch (yahooError: any) {
      console.warn('Yahoo Finance news fetch failed:', yahooError?.message || yahooError);
    }

    // Mark Finnhub articles and preserve original source names
    const finnhubNews = finnhubNewsRaw.map((article: any) => ({
      ...article,
      _source_type: 'finnhub',
    }));

    const allNews = [...finnhubNews, ...yahooNews];
    const articleCount = allNews.length;

    if (articleCount === 0) {
      return NextResponse.json({
        ticker,
        overall_sentiment: 0,
        sentiment_label: 'Neutral',
        confidence: 0,
        news_count: 0,
        reputable_sources: [],
        key_themes: [],
        recent_articles: [],
        article_sentiments: [],
      });
    }

    // Prepare articles for OpenAI analysis
    const articles = allNews.map((article: any) => ({
      headline: article.headline || '',
      summary: article.summary || '',
      source: article.source || 'Unknown',
      datetime: article.datetime,
      url: article.url,
      _source_type: article._source_type,
    }));

    // Compute source breakdown - separate Finnhub from original sources
    const source_breakdown: Record<string, number> = {};
    let finnhubCount = 0;
    let yahooCount = 0;
    
    for (const a of articles) {
      if (a._source_type === 'finnhub') {
        finnhubCount++;
        // Also track original source (e.g., "SeekingAlpha")
        const origSrc = a.source || 'Unknown';
        source_breakdown[origSrc] = (source_breakdown[origSrc] || 0) + 1;
      } else if (a._source_type === 'yahoo') {
        yahooCount++;
      } else {
        const src = a.source || 'Unknown';
        source_breakdown[src] = (source_breakdown[src] || 0) + 1;
      }
    }
    
    // Add aggregated counts
    if (finnhubCount > 0) {
      source_breakdown['Finnhub'] = finnhubCount;
    }
    if (yahooCount > 0) {
      source_breakdown['Yahoo Finance'] = yahooCount;
    }

    // Convert articles to NewsArticle format
    const newsArticles: NewsArticle[] = allNews.map((article: any) => ({
      headline: article.headline || '',
      summary: article.summary || '',
      source: article.source || 'Unknown',
      datetime: article.datetime,
      url: article.url,
      _source_type: article._source_type,
    }));

    // Score sentiment using comprehensive methodology
    const sentimentResult = SentimentScoringEngine.scoreSentiment(newsArticles);
    
    // Optionally enhance with OpenAI for richer analysis (non-blocking)
    let openAIAnalysis: any = null;
    try {
      const openAIService = new OpenAIService();
      // Use OpenAI in parallel with timeout (non-blocking enhancement)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 2000)
      );
      openAIAnalysis = await Promise.race([
        openAIService.analyzeSentiment(ticker, newsArticles.slice(0, 20)),
        timeoutPromise,
      ]).catch(() => null);
    } catch (error) {
      // Silently fail - scoring engine already provides robust analysis
      console.warn('OpenAI enhancement failed, using scoring engine result');
    }

    // Map sentiment result to API response format
    // Convert score from 0-100 to -1 to +1 for backward compatibility
    const overallSentiment = (sentimentResult.overallScore - 50) / 50; // Maps 0-100 to -1 to +1
    
    return NextResponse.json({
      ticker,
      overall_sentiment: overallSentiment,
      sentiment_label: sentimentResult.sentimentLabel,
      sentiment_score: sentimentResult.overallScore, // 0-100 scale
      confidence: sentimentResult.confidence,
      news_count: sentimentResult.articleCount,
      quality_flag: sentimentResult.qualityFlag,
      momentum: sentimentResult.momentum,
      source_breakdown,
      reputable_sources: sentimentResult.reputableSources,
      key_themes: sentimentResult.keyThemes,
      red_flags: sentimentResult.redFlags,
      recent_articles: articles.slice(0, 10).map((article: any) => ({
        headline: article.headline,
        summary: article.summary,
        source: article.source,
        datetime: article.datetime,
        url: article.url,
        _source_type: article._source_type,
      })),
      article_sentiments: sentimentResult.scoredArticles.slice(0, 10).map(scored => ({
        headline: scored.article.headline,
        source: scored.article.source,
        sentiment: scored.rawSentiment,
        sentiment_score: scored.finalScore, // 0-100 scale
        sentiment_label: scored.finalScore >= 61 ? 'Positive' : 
                        scored.finalScore >= 41 ? 'Neutral' : 'Negative',
        is_reputable: scored.sourceWeight >= 0.85,
        weights: {
          recency: scored.recencyWeight,
          source: scored.sourceWeight,
          impact: scored.impactWeight,
          intensity: scored.intensityWeight,
        },
      })),
      // Include OpenAI analysis if available (for enhanced themes)
      enhanced_themes: openAIAnalysis?.key_themes || [],
    });
  } catch (error: any) {
    console.error('Sentiment analysis error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

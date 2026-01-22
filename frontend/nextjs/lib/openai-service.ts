// OpenAI Service for Sentiment Analysis

import { config } from './config';

interface NewsArticle {
  headline: string;
  summary?: string;
  source: string;
  datetime?: number;
  url?: string;
}

interface SentimentAnalysis {
  overall_sentiment: number; // -1 to +1
  sentiment_label: 'Very Negative' | 'Negative' | 'Neutral' | 'Positive' | 'Very Positive';
  confidence: number; // 0 to 1
  reputable_sources: string[];
  key_themes: string[];
  article_sentiments: Array<{
    headline: string;
    source: string;
    sentiment: number;
    sentiment_label: string;
    is_reputable: boolean;
  }>;
}

interface IndustryWaccResult {
  average_wacc: number;
  peers: Array<{
    name: string;
    ticker: string;
    est_wacc: number;
  }>;
  reasoning: string;
}

export class OpenAIService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async analyzeSentiment(
    ticker: string,
    articles: NewsArticle[]
  ): Promise<SentimentAnalysis> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (articles.length === 0) {
      return {
        overall_sentiment: 0,
        sentiment_label: 'Neutral',
        confidence: 0,
        reputable_sources: [],
        key_themes: [],
        article_sentiments: [],
      };
    }

    // Prepare articles for analysis (limit to 20 most recent)
    const articlesToAnalyze = articles.slice(0, 20);
    const articlesText = articlesToAnalyze
      .map((article, idx) => {
        return `Article ${idx + 1}:
Source: ${article.source}
Headline: ${article.headline}
Summary: ${article.summary || 'N/A'}
---`;
      })
      .join('\n\n');

    const prompt = `You are a financial sentiment analysis expert. Analyze news articles about ${ticker} and provide a comprehensive sentiment assessment.

**Instructions:**
1. Analyze each article's sentiment on a scale from -1 (very negative) to +1 (very positive)
2. Identify reputable financial news sources (e.g., Bloomberg, Reuters, Wall Street Journal, Financial Times, CNBC, MarketWatch, Barron's, Forbes, The Motley Fool, Seeking Alpha, Yahoo Finance, etc.)
3. Extract key themes and topics discussed
4. Provide overall sentiment score as a weighted average (weight reputable sources 2x more)
5. Classify sentiment label: "Very Negative" (< -0.5), "Negative" (-0.5 to -0.1), "Neutral" (-0.1 to 0.1), "Positive" (0.1 to 0.5), "Very Positive" (> 0.5)

**Articles to analyze:**
${articlesText}

**Output Format (JSON only, no markdown):**
{
  "overall_sentiment": <number between -1 and 1>,
  "sentiment_label": "<Very Negative|Negative|Neutral|Positive|Very Positive>",
  "confidence": <number between 0 and 1>,
  "reputable_sources": [<array of source names that are reputable>],
  "key_themes": [<array of 3-5 key themes/topics>],
  "article_sentiments": [
    {
      "headline": "<article headline>",
      "source": "<source name>",
      "sentiment": <number -1 to 1>,
      "sentiment_label": "<label>",
      "is_reputable": <true|false>
    }
  ]
}

Respond with ONLY valid JSON, no additional text.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Using cheaper model for cost efficiency
          messages: [
            {
              role: 'system',
              content: 'You are a financial sentiment analysis expert. Always respond with valid JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3, // Lower temperature for more consistent analysis
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse JSON response
      const analysis = JSON.parse(content) as SentimentAnalysis;

      // Validate and normalize sentiment score
      if (typeof analysis.overall_sentiment !== 'number') {
        analysis.overall_sentiment = 0;
      }
      analysis.overall_sentiment = Math.max(
        -1,
        Math.min(1, analysis.overall_sentiment)
      );

      // Ensure confidence is valid
      if (typeof analysis.confidence !== 'number') {
        analysis.confidence = 0.5;
      }
      analysis.confidence = Math.max(0, Math.min(1, analysis.confidence));

      return analysis;
    } catch (error: any) {
      console.error('OpenAI sentiment analysis error:', error);
      throw new Error(
        `Failed to analyze sentiment: ${error.message || 'Unknown error'}`
      );
    }
  }

  async estimateIndustryWacc(industry: string): Promise<IndustryWaccResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Identify the five largest money makers (by revenue or profit) among publicly listed companies in the ${industry} industry (prefer US tickers; keep it current as of 2024). For each, provide ticker, name, and an estimated WACC (decimal, e.g., 0.085). Then give the simple average WACC across the five. Respond in JSON only.
Format:
{
  "peers": [
    { "ticker": "TICK", "name": "Company Name", "est_wacc": 0.0 }
  ],
  "average_wacc": 0.0,
  "reasoning": "one short sentence on why these peers were chosen"
}`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a finance analyst. Always respond with valid JSON only, no markdown.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content) as IndustryWaccResult;
      const peers = Array.isArray(parsed.peers) ? parsed.peers : [];
      const sanitizedPeers = peers
        .slice(0, 5)
        .map((p) => ({
          name: p.name || '',
          ticker: (p.ticker || '').toUpperCase(),
          est_wacc: Math.min(
            config.MAX_WACC,
            Math.max(config.MIN_WACC, Number(p.est_wacc) || 0)
          ),
        }))
        .filter((p) => p.ticker);

      const avg =
        sanitizedPeers.length > 0
          ? sanitizedPeers.reduce((sum, p) => sum + p.est_wacc, 0) /
            sanitizedPeers.length
          : NaN;

      return {
        peers: sanitizedPeers,
        average_wacc: isFinite(avg)
          ? Math.min(config.MAX_WACC, Math.max(config.MIN_WACC, avg))
          : NaN,
        reasoning: parsed.reasoning || '',
      };
    } catch (error: any) {
      console.error('OpenAI industry WACC error:', error);
      throw new Error(
        `Failed to estimate industry WACC: ${error.message || 'Unknown error'}`
      );
    }
  }

  async estimateQualityMetrics(ticker: string, companyName?: string, industry?: string): Promise<{
    marketCap?: number;
    avgVolume?: number;
    exchange?: string;
    priceVolatility?: number;
    priceMomentum?: number;
    yearsSinceIPO?: number;
    currentPrice?: number;
  }> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Estimate quality metrics for ${ticker}${companyName ? ` (${companyName})` : ''}${industry ? ` in the ${industry} industry` : ''}.

Based on publicly available information and typical market data as of 2024, provide reasonable estimates for:
1. Market capitalization (in USD)
2. Average daily trading volume (in shares)
3. Primary exchange (NYSE, NASDAQ, AMEX, or OTC)
4. Annualized price volatility (as decimal, e.g., 0.25 for 25%)
5. Average daily price momentum (as decimal, e.g., 0.0005 for 0.05% daily return)
6. Years since IPO (if known, otherwise estimate based on company age)
7. Current stock price estimate (in USD)

Respond in JSON only, no markdown:
{
  "marketCap": <number in USD>,
  "avgVolume": <number of shares>,
  "exchange": "<NYSE|NASDAQ|AMEX|OTC>",
  "priceVolatility": <decimal 0-1>,
  "priceMomentum": <decimal, typically -0.01 to 0.01>,
  "yearsSinceIPO": <number>,
  "currentPrice": <number in USD>,
  "reasoning": "<brief explanation of estimates>"
}

If you cannot find reliable information, use conservative defaults:
- Market Cap: $5B for established companies, $1B for smaller
- Volume: 1-10M shares per day depending on size
- Exchange: NASDAQ (most common) or NYSE for large caps
- Volatility: 0.20-0.35 (20-35% annualized)
- Momentum: 0.0 (neutral)
- Years Since IPO: Estimate based on company age if known, otherwise 10
- Current Price: Estimate based on market cap and shares if possible`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a financial data analyst. Provide realistic estimates based on public company information. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content) as any;

      // Validate and sanitize the response
      return {
        marketCap: parsed.marketCap && isFinite(parsed.marketCap) && parsed.marketCap > 0
          ? parsed.marketCap
          : undefined,
        avgVolume: parsed.avgVolume && isFinite(parsed.avgVolume) && parsed.avgVolume > 0
          ? parsed.avgVolume
          : undefined,
        exchange: parsed.exchange && typeof parsed.exchange === 'string'
          ? parsed.exchange.toUpperCase()
          : undefined,
        priceVolatility: parsed.priceVolatility && isFinite(parsed.priceVolatility) && parsed.priceVolatility >= 0
          ? Math.min(1, Math.max(0, parsed.priceVolatility))
          : undefined,
        priceMomentum: parsed.priceMomentum && isFinite(parsed.priceMomentum)
          ? Math.max(-0.05, Math.min(0.05, parsed.priceMomentum))
          : undefined,
        yearsSinceIPO: parsed.yearsSinceIPO && isFinite(parsed.yearsSinceIPO) && parsed.yearsSinceIPO > 0
          ? parsed.yearsSinceIPO
          : undefined,
        currentPrice: parsed.currentPrice && isFinite(parsed.currentPrice) && parsed.currentPrice > 0
          ? parsed.currentPrice
          : undefined,
      };
    } catch (error: any) {
      console.error('OpenAI quality metrics estimation error:', error);
      throw new Error(
        `Failed to estimate quality metrics: ${error.message || 'Unknown error'}`
      );
    }
  }

  async estimateFundamentalMetrics(ticker: string, companyName?: string, industry?: string): Promise<{
    // Profitability
    roic?: number;
    wacc?: number;
    operatingMargin_5yAvg?: number;
    operatingMargin_industryPercentile?: number;
    
    // Earnings Quality
    accrualsRatio?: number;
    fcfNetIncome_5yAvg?: number;
    
    // Balance Sheet Strength
    netDebtEBITDA?: number;
    interestCoverage?: number;
    
    // Growth Durability
    revenueCAGR_5y?: number;
    revenueCAGR_industryStdDev?: number;
    revenueVolatility_5y?: number;
    revenueVolatility_industryPercentile?: number;
    
    // Capital Allocation
    reinvestmentEfficiency?: number;
    reinvestmentEfficiency_industryPercentile?: number;
    shareholderReturns_pctFCF?: number;
    netDebtEBITDA_trend?: 'rising' | 'stable' | 'falling';
    
    // Metadata
    dataCompleteness?: number; // 0-1
    yearsOfData?: number;
  }> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Estimate fundamental quality metrics for ${ticker}${companyName ? ` (${companyName})` : ''}${industry ? ` in the ${industry} industry` : ''}.

Based on publicly available financial information as of 2024, estimate these metrics:

**Profitability:**
- ROIC (Return on Invested Capital, as %): Typical range 5-20%
- WACC (Weighted Average Cost of Capital, as %): Typical range 6-12%
- Operating Margin 5-year average (as %): Typical range 10-30%
- Operating Margin industry percentile (0-100): Where this company ranks vs peers

**Earnings Quality:**
- Accruals Ratio (CFO / Net Income): 1.0+ is good (high cash conversion), <0.7 is concerning
- FCF/Net Income 5-year average: 1.2+ is excellent, 0.8-1.2 is good, <0.8 is weak

**Balance Sheet Strength:**
- Net Debt / EBITDA: <1x is excellent, 1-2x is good, >4x is concerning
- Interest Coverage (EBITDA / Interest Expense): >10x is strong, <1.5x is risky

**Growth Durability:**
- Revenue CAGR 5-year (as %): Typical range -5% to 30%
- Revenue CAGR vs industry (in std devs): -2 to +2
- Revenue Volatility 5-year (std/avg): Lower is better, typical 0.1-0.3
- Revenue Volatility industry percentile (0-100): Lower percentile = more stable

**Capital Allocation:**
- Reinvestment Efficiency (ΔRevenue / CapEx+R&D): Higher is better, typical 0.2-1.0
- Reinvestment Efficiency industry percentile (0-100)
- Shareholder Returns as % of FCF (Dividends + Buybacks / FCF): 30-70% is balanced
- Net Debt/EBITDA trend: "rising", "stable", or "falling"

**Data Quality:**
- Data Completeness (0-1): 1 = all metrics available, 0 = none
- Years of Data: How many years of financial data available

Respond in JSON only:
{
  "roic": <number or null>,
  "wacc": <number or null>,
  "operatingMargin_5yAvg": <number or null>,
  "operatingMargin_industryPercentile": <number 0-100 or null>,
  "accrualsRatio": <number or null>,
  "fcfNetIncome_5yAvg": <number or null>,
  "netDebtEBITDA": <number or null>,
  "interestCoverage": <number or null>,
  "revenueCAGR_5y": <number or null>,
  "revenueCAGR_industryStdDev": <number or null>,
  "revenueVolatility_5y": <number or null>,
  "revenueVolatility_industryPercentile": <number 0-100 or null>,
  "reinvestmentEfficiency": <number or null>,
  "reinvestmentEfficiency_industryPercentile": <number 0-100 or null>,
  "shareholderReturns_pctFCF": <number 0-100 or null>,
  "netDebtEBITDA_trend": "rising"|"stable"|"falling"|null,
  "dataCompleteness": <number 0-1>,
  "yearsOfData": <number>
}

Use realistic estimates based on company size, industry norms, and typical ranges. If data is unavailable, use null.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a financial analyst. Provide realistic fundamental metrics based on public company data. Always respond with valid JSON only, no markdown.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content) as any;

      // Validate and return (all fields are optional)
      return {
        roic: parsed.roic && isFinite(parsed.roic) ? parsed.roic : undefined,
        wacc: parsed.wacc && isFinite(parsed.wacc) ? parsed.wacc : undefined,
        operatingMargin_5yAvg: parsed.operatingMargin_5yAvg && isFinite(parsed.operatingMargin_5yAvg) ? parsed.operatingMargin_5yAvg : undefined,
        operatingMargin_industryPercentile: parsed.operatingMargin_industryPercentile && isFinite(parsed.operatingMargin_industryPercentile) ? Math.max(0, Math.min(100, parsed.operatingMargin_industryPercentile)) : undefined,
        accrualsRatio: parsed.accrualsRatio && isFinite(parsed.accrualsRatio) ? parsed.accrualsRatio : undefined,
        fcfNetIncome_5yAvg: parsed.fcfNetIncome_5yAvg && isFinite(parsed.fcfNetIncome_5yAvg) ? parsed.fcfNetIncome_5yAvg : undefined,
        netDebtEBITDA: parsed.netDebtEBITDA && isFinite(parsed.netDebtEBITDA) ? parsed.netDebtEBITDA : undefined,
        interestCoverage: parsed.interestCoverage && isFinite(parsed.interestCoverage) ? parsed.interestCoverage : undefined,
        revenueCAGR_5y: parsed.revenueCAGR_5y && isFinite(parsed.revenueCAGR_5y) ? parsed.revenueCAGR_5y : undefined,
        revenueCAGR_industryStdDev: parsed.revenueCAGR_industryStdDev && isFinite(parsed.revenueCAGR_industryStdDev) ? parsed.revenueCAGR_industryStdDev : undefined,
        revenueVolatility_5y: parsed.revenueVolatility_5y && isFinite(parsed.revenueVolatility_5y) ? parsed.revenueVolatility_5y : undefined,
        revenueVolatility_industryPercentile: parsed.revenueVolatility_industryPercentile && isFinite(parsed.revenueVolatility_industryPercentile) ? Math.max(0, Math.min(100, parsed.revenueVolatility_industryPercentile)) : undefined,
        reinvestmentEfficiency: parsed.reinvestmentEfficiency && isFinite(parsed.reinvestmentEfficiency) ? parsed.reinvestmentEfficiency : undefined,
        reinvestmentEfficiency_industryPercentile: parsed.reinvestmentEfficiency_industryPercentile && isFinite(parsed.reinvestmentEfficiency_industryPercentile) ? Math.max(0, Math.min(100, parsed.reinvestmentEfficiency_industryPercentile)) : undefined,
        shareholderReturns_pctFCF: parsed.shareholderReturns_pctFCF && isFinite(parsed.shareholderReturns_pctFCF) ? Math.max(0, Math.min(100, parsed.shareholderReturns_pctFCF)) : undefined,
        netDebtEBITDA_trend: parsed.netDebtEBITDA_trend && ['rising', 'stable', 'falling'].includes(parsed.netDebtEBITDA_trend) ? parsed.netDebtEBITDA_trend : undefined,
        dataCompleteness: parsed.dataCompleteness && isFinite(parsed.dataCompleteness) ? Math.max(0, Math.min(1, parsed.dataCompleteness)) : undefined,
        yearsOfData: parsed.yearsOfData && isFinite(parsed.yearsOfData) ? parsed.yearsOfData : undefined,
      };
    } catch (error: any) {
      console.error('OpenAI fundamental metrics estimation error:', error);
      throw new Error(
        `Failed to estimate fundamental metrics: ${error.message || 'Unknown error'}`
      );
    }
  }
}

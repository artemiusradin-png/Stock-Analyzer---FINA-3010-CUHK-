import { NextRequest, NextResponse } from 'next/server';
import { ScoringEngine } from '@/lib/scoring-engine';
import { FinnhubService } from '@/lib/finnhub-service';
import { RiskAnalytics } from '@/lib/risk-analytics';
import { OpenAIService } from '@/lib/openai-service';
import { DCFEngine, DCFInputs } from '@/lib/dcf-engine';
import { config } from '@/lib/config';

function getRequestOrigin(request: NextRequest): string {
  // Prefer the incoming request origin (works in dev + deployed environments)
  const nextUrlOrigin = request.nextUrl?.origin;
  if (nextUrlOrigin && nextUrlOrigin !== 'null') return nextUrlOrigin;

  // Fallback for some proxies
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  if (host) return `${proto}://${host}`;

  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    'http://localhost:3000'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticker } = body;

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    // Fetch real data from APIs
    let dcfUpsideDownside: number | undefined;
    let momentumScore: number | undefined;
    let sentimentScore: number | undefined;
    let sentimentDetails:
      | { raw_sentiment: number; confidence: number; article_count: number }
      | undefined;
    let qualityMetrics: any = {};
    let sensitivityData: any = undefined;
    let riskMetrics: any = {};

    const finnhubService = new FinnhubService();

    const origin = getRequestOrigin(request);

    // Parallelize independent data fetches for faster response
    const today = new Date();
    const fromDate30 = new Date();
    fromDate30.setDate(today.getDate() - 30);
    const fromDate60 = new Date();
    fromDate60.setDate(today.getDate() - 60);

    // Start all independent API calls in parallel
    const [
      valuationResponse,
      profileData,
      quoteData,
      newsData,
      stockPricesData,
      marketPricesData,
    ] = await Promise.allSettled([
      // 1. DCF valuation
      fetch(`${origin}/api/valuations/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      }),
      // 2. Company profile (use standardized endpoint for USD conversion)
      fetch(`${origin}/api/company/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      }),
      // 3. Current quote (for momentum fallback - raw for price history)
      finnhubService.getCompanyQuote(ticker),
      // 4. News for sentiment
      finnhubService.getNews(
        ticker,
        fromDate30.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      ),
      // 5. Historical prices for momentum/risk
      finnhubService.getHistoricalPrices(ticker, fromDate60, today, 'D'),
      // 6. Market prices for beta/risk
      finnhubService.getHistoricalPrices('SPY', fromDate60, today, 'D'),
    ]);

    // Process DCF data
    if (valuationResponse.status === 'fulfilled' && valuationResponse.value.ok) {
      try {
        const valuation = await valuationResponse.value.json();
        if (
          valuation &&
          valuation.upside_downside !== undefined &&
          isFinite(valuation.upside_downside)
        ) {
          dcfUpsideDownside = valuation.upside_downside;
        }

        if (
          valuation?.wacc &&
          valuation?.implied_price &&
          valuation?.current_price &&
          isFinite(valuation.wacc) &&
          isFinite(valuation.implied_price) &&
          isFinite(valuation.current_price)
        ) {
          sensitivityData = {
            wacc_range: [
              (valuation.wacc / 100) * 0.7,
              (valuation.wacc / 100) * 1.3,
            ] as [number, number],
            price_range: [
              valuation.implied_price * 0.85,
              valuation.implied_price * 1.15,
            ] as [number, number],
            base_price: valuation.current_price,
          };
        }
      } catch (error: any) {
        console.warn(`Valuation parse error for ${ticker}:`, error?.message);
      }
    }

    // Fallback DCF if valuation endpoint unavailable
    if (!dcfUpsideDownside && profileData.status === 'fulfilled' && quoteData.status === 'fulfilled') {
      try {
        const profileResponse = profileData.value;
        const profile = profileResponse.ok ? await profileResponse.json() : null;
        const quote = quoteData.value;
        const price = quote?.c || quote?.pc || 0;
        const marketCap = profile?.marketCap || 0;
        const shares = (profile?.shareOutstanding || 0) * 1000000;
        
        if (price > 0) {
          let revenueStart = 0;
          if (marketCap > 0) {
            revenueStart = marketCap / 5;
          } else if (price > 0 && shares > 0) {
            revenueStart = (price * shares) / 5;
          }
          
          if (revenueStart <= 0 && price > 0 && shares > 0) {
            revenueStart = (price * shares) * 0.2;
          }

          if (revenueStart > 0 && price > 0) {
            const inputs: DCFInputs = {
              revenue_start: revenueStart,
              revenue_growth_start: 0.08,
              ebit_margin_start: 0.25,
              dna_ratio_start: 0.0,
              capex_ratio_start: 0.0,
              nwc_ratio_start: 0.0,
              tax_rate_start: config.DEFAULT_TAX_RATE,
              nwc_level: 0.0,
              revenue_growth_terminal: 0.03,
              ebit_margin_terminal: 0.25,
              dna_ratio_terminal: 0.0,
              capex_ratio_terminal: 0.0,
              nwc_ratio_terminal: 0.0,
              tax_rate_terminal: config.DEFAULT_TAX_RATE,
              risk_free_rate: config.DEFAULT_RISK_FREE_RATE,
              erp: config.DEFAULT_ERP,
              beta: 1.0,
              cost_of_debt: 0.04,
              debt: 0,
              equity: marketCap > 0 ? marketCap : (price > 0 && shares > 0 ? price * shares : 1.0),
              tax_rate: config.DEFAULT_TAX_RATE,
              forecast_period: 10,
              terminal_growth: config.DEFAULT_TERMINAL_GROWTH,
              shares_outstanding: shares > 0 ? shares : 1.0,
              cash: 0,
            };

            try {
              const result = DCFEngine.performDCF(inputs, price);
              if (result.upside_downside !== undefined && 
                  !isNaN(result.upside_downside) && 
                  isFinite(result.upside_downside)) {
                dcfUpsideDownside = dcfUpsideDownside ?? result.upside_downside;
                
                if (result.wacc && result.implied_price && price && 
                    isFinite(result.wacc) && isFinite(result.implied_price) && !sensitivityData) {
                  sensitivityData = {
                    wacc_range: [result.wacc * 0.7, result.wacc * 1.3] as [number, number],
                    price_range: [result.implied_price * 0.8, result.implied_price * 1.2] as [number, number],
                    base_price: price,
                  };
                }
              }
            } catch (dcfError: any) {
              console.warn(`DCF calculation error for ${ticker}:`, dcfError?.message);
            }
          }
        }
      } catch (error: any) {
        console.warn(`Fallback DCF failed for ${ticker}:`, error?.message);
      }
    }

    // Sentiment (watchlist): simple keyword pipeline; fallback to GPT if that fails
    try {
      const positiveKeywords = [
        'growth', 'profit', 'profits', 'beat', 'beats', 'upgrade', 'upgraded', 'outperform', 'strong',
        'surge', 'rally', 'raise', 'raised', 'guidance raise', 'record', 'margin', 'margins',
        'partnership', 'contract', 'win', 'wins', 'launch', 'approved',
      ];
      const negativeKeywords = [
        'loss', 'losses', 'miss', 'missed', 'misses', 'downgrade', 'downgraded', 'underperform', 'weak',
        'decline', 'drop', 'plunge', 'crash', 'cut', 'guidance cut', 'lawsuit', 'probe', 'investigation',
        'regulatory', 'fine', 'recall', 'bankruptcy', 'default',
      ];
      const reputableSources = [
        'reuters',
        'bloomberg',
        'financial times',
        'ft.com',
        'wall street journal',
        'wsj',
        'forbes',
        'cnbc',
        'yahoo finance',
        'marketwatch',
        "barron's",
        'barrons',
        'finnhub',
      ];

      const news = newsData.status === 'fulfilled' ? newsData.value || [] : [];
      const articleCount = Array.isArray(news) ? news.length : 0;

      if (articleCount === 0) {
        sentimentDetails = { raw_sentiment: 0, confidence: 0, article_count: 0 };
        sentimentScore = 0;
      } else {
        let totalWeighted = 0;
        let totalWeight = 0;

        for (const article of news) {
          const source = String(article?.source || 'Unknown');
          const srcLower = source.toLowerCase();
          const isReputable = reputableSources.some((s) => srcLower.includes(s));
          const weight = isReputable ? 1.5 : 1.0;

          const text = `${article?.headline || ''} ${article?.summary || ''}`.toLowerCase();
          let pos = 0;
          let neg = 0;
          for (const kw of positiveKeywords) if (text.includes(kw)) pos++;
          for (const kw of negativeKeywords) if (text.includes(kw)) neg++;

          const denom = Math.max(1, pos + neg);
          const articleScore = Math.max(-1, Math.min(1, (pos - neg) / denom));

          totalWeighted += articleScore * weight;
          totalWeight += weight;
        }

        const rawSentiment =
          totalWeight > 0 ? Math.max(-1, Math.min(1, totalWeighted / totalWeight)) : 0;
        const confidence = Math.min(1, Math.sqrt(articleCount / 20));

        let effective = rawSentiment * confidence;
        if (articleCount < 5) {
          effective *= 0.5;
        }

        sentimentDetails = {
          raw_sentiment: rawSentiment,
          confidence,
          article_count: articleCount,
        };

        sentimentScore = Math.max(-1, Math.min(1, effective));
      }
    } catch (e) {
      sentimentDetails = { raw_sentiment: 0, confidence: 0, article_count: 0 };
      sentimentScore = undefined;
    }

    // Fallback: GPT sentiment if the keyword pipeline failed
    if (sentimentScore === undefined) {
      try {
        const articles = (newsData.status === 'fulfilled' ? newsData.value || [] : [])
          .map((a: any) => ({
            headline: a?.headline || '',
            summary: a?.summary || '',
            source: a?.source || 'Unknown',
          }))
          .slice(0, 20);

        if (articles.length > 0) {
          const openAIService = new OpenAIService();
          const gptAnalysis = await Promise.race([
            openAIService.analyzeSentiment(ticker, articles),
            new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI timeout')), 2500)),
          ]);
          const score0to100 = (gptAnalysis as any)?.sentiment_score ?? (gptAnalysis as any)?.overall_sentiment;
          if (typeof score0to100 === 'number' && isFinite(score0to100)) {
            sentimentScore = Math.max(-1, Math.min(1, (score0to100 - 50) / 50));
            sentimentDetails = {
              raw_sentiment: (score0to100 - 50) / 50,
              confidence: 1,
              article_count: articles.length,
            };
          }
        }
      } catch (gptError) {
        // leave sentimentScore undefined -> will default to 0 later
      }
    }

    // Process risk/momentum data
    // Helpers for normalization
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const normRatio = (r: number) => {
      // Map -20% -> 0, 0 -> 0.5, +20% -> 1
      if (!isFinite(r)) return 0.5;
      const x = clamp((r + 0.2) / 0.4, 0, 1);
      return x;
    };
    const normROC = (r: number) => normRatio(r);
    const normRSI = (rsi: number) => clamp(rsi / 100, 0, 1);

    // Momentum components calculator
    const computeMomentumScore = (prices: any[]): number | undefined => {
      if (!prices || prices.length < 50) return undefined;
      const closes: number[] = prices.map(p => p.close);
      const vols: number[] = prices.map(p => p.volume ?? 0);
      const n = closes.length;
      const close = closes[n - 1];

      const ma = (arr: number[], len: number) => {
        if (arr.length < len) return undefined;
        return arr.slice(-len).reduce((a, b) => a + b, 0) / len;
      };
      const ma20 = ma(closes, 20);
      const ma50 = ma(closes, 50);
      const volMa20 = ma(vols, 20);

      // RSI-14
      let rsi14: number | undefined;
      if (closes.length >= 15) {
        let gains = 0;
        let losses = 0;
        for (let i = n - 14; i < n; i++) {
          const diff = closes[i] - closes[i - 1];
          if (diff > 0) gains += diff;
          else losses -= diff;
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        if (avgLoss === 0 && avgGain === 0) rsi14 = 50;
        else if (avgLoss === 0) rsi14 = 100;
        else {
          const rs = avgGain / avgLoss;
          rsi14 = 100 - 100 / (1 + rs);
        }
      }

      // ROC-10
      let roc10: number | undefined;
      if (closes.length >= 11) {
        const prev = closes[n - 11];
        if (prev > 0) roc10 = (close - prev) / prev;
      }

      const priceVsMa20 = ma20 ? (close - ma20) / ma20 : undefined;
      const priceVsMa50 = ma50 ? (close - ma50) / ma50 : undefined;
      const volumeTrend = volMa20 ? (vols[n - 1] - volMa20) / volMa20 : undefined;

      const components: number[] = [];
      const weights: number[] = [];

      if (priceVsMa20 !== undefined) { components.push(normRatio(priceVsMa20)); weights.push(0.25); }
      if (priceVsMa50 !== undefined) { components.push(normRatio(priceVsMa50)); weights.push(0.25); }
      if (rsi14 !== undefined)      { components.push(normRSI(rsi14));       weights.push(0.20); }
      if (volumeTrend !== undefined){ components.push(normRatio(volumeTrend));weights.push(0.15); }
      if (roc10 !== undefined)      { components.push(normROC(roc10));       weights.push(0.15); }

      if (components.length === 0) return undefined;
      const totalW = weights.reduce((a, b) => a + b, 0);
      const score = components.reduce((sum, c, idx) => sum + c * weights[idx], 0) / totalW;
      return clamp(score * 100, 0, 100);
    };

    // Helper to compute momentum/risk from price series
    const processPrices = (stockPrices: any[], marketPrices: any[], label: string) => {
      const stockPricesArray = stockPrices.map(p => p.close);
      const marketPricesArray = marketPrices.length > 0 
        ? marketPrices.map(p => p.close)
        : stockPricesArray; // Fallback to stock prices if market unavailable

      const dates = stockPrices.map(p => p.date);
      
      const riskData = RiskAnalytics.analyzeRisk({
        prices: stockPricesArray,
        marketPrices: marketPricesArray,
        dates,
        riskFreeRate: 0.045,
        lookbackDays: 20,
      });

      const momScore = computeMomentumScore(stockPrices);
      if (momScore !== undefined) {
        momentumScore = momScore;
      }
      // Debug log to verify data quality
      const closes = stockPricesArray.slice(-21); // last 21 closes to show 20 returns
      console.log(`[Momentum Debug] ${ticker} (${label}) closes:`, closes);
      
      riskMetrics = {
        max_drawdown: riskData.drawdown?.max_drawdown ?? 0.15,
        volatility:
          riskData.volatility?.annualized_vol ??
          riskData.volatility?.monthly_vol ??
          0.25,
        beta: riskData.beta?.current_beta ?? 1.0,
        var_95: riskData.var?.var_95 ?? 0.02,
      };
    };

    // Try primary prices
    if (stockPricesData.status === 'fulfilled' && stockPricesData.value.length > 0) {
      try {
        const stockPrices = stockPricesData.value;
        const marketPrices = marketPricesData.status === 'fulfilled' ? marketPricesData.value : [];
        processPrices(stockPrices, marketPrices, 'primary');
      } catch (error) {
        console.warn('Risk calculation failed:', error);
      }
    } else if (stockPricesData.status !== 'fulfilled' || stockPricesData.value.length === 0) {
      // Secondary attempt: if ticker ends with class (e.g., GOOGL), try classless (GOOG) or vice versa
      try {
        const altTicker = ticker.endsWith('L') || ticker.endsWith('l')
          ? ticker.slice(0, -1) // GOOGL -> GOO G
          : `${ticker}L`; // GOOG -> GOOGL
        const altStockPrices = await finnhubService.getHistoricalPrices(
          altTicker,
          fromDate60,
          today,
          'D'
        );
        if (altStockPrices.length > 0) {
          const altMarketPrices = marketPricesData.status === 'fulfilled' ? marketPricesData.value : [];
          processPrices(altStockPrices, altMarketPrices, 'alt');
        }
      } catch (error) {
        console.warn('Secondary ticker fetch failed for momentum/risk:', error);
      }
    }

    // Seed neutral defaults if risk metrics missing so quality can vary
    if (!riskMetrics || Object.keys(riskMetrics).length === 0) {
      riskMetrics = {
        max_drawdown: 0.15,
        volatility: 0.25,
        beta: 1.0,
        var_95: 0.02,
      };
    }

    // If no momentum score computed, leave neutral

    // Quality metrics - fetch fundamental metrics (using ChatGPT API with timeout)
    let fundamentalMetrics: any = {};
    const profile = (profileData.status === 'fulfilled' && profileData.value.ok) ? await profileData.value.json() : null;
    const quote = quoteData.status === 'fulfilled' ? quoteData.value : null;
    const stockPrices = stockPricesData.status === 'fulfilled' ? stockPricesData.value : [];
    
    // Calculate price volatility and beta from available data
    let calculatedPriceVolatility: number | undefined;
    if (stockPrices && stockPrices.length > 1) {
      try {
        const prices = stockPrices.map((p: any) => p.close || 0).filter((p: number) => p > 0);
        if (prices.length > 1) {
          const returns: number[] = [];
          for (let i = 1; i < prices.length; i++) {
            if (prices[i - 1] > 0) {
              returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
            }
          }
          if (returns.length > 0) {
            const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
            const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
            calculatedPriceVolatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized
          }
        }
      } catch (error) {
        // Ignore calculation errors
      }
    }
    
    // Extract beta from risk metrics
    const calculatedBeta = riskMetrics.beta;
    // If we have annualized volatility from risk metrics, use it as a fallback
    if (!calculatedPriceVolatility && riskMetrics.volatility !== undefined) {
      calculatedPriceVolatility = riskMetrics.volatility;
    }
    // If still missing, use a neutral default
    if (calculatedPriceVolatility === undefined) {
      calculatedPriceVolatility = 0.25;
    }
    
    // Try to fetch fundamental metrics from ChatGPT (with timeout for speed)
    try {
      const openAIService = new OpenAIService();
      const fundamentalPromise = profile
        ? openAIService.estimateFundamentalMetrics(
            ticker,
            profile.name,
            profile.industry
          )
        : Promise.resolve({});
      
      // Use 3-second timeout for fundamental metrics (non-blocking for speed)
      fundamentalMetrics = await Promise.race([
        fundamentalPromise,
        new Promise(resolve => setTimeout(() => resolve({}), 3000))
      ]) as any;
    } catch (error) {
      console.warn(`[Scoring ${ticker}] Fundamental metrics unavailable`);
      fundamentalMetrics = {};
    }
    
    const hasFundamentals = fundamentalMetrics && Object.keys(fundamentalMetrics).length > 0;

    // If nothing came back and we have no calculated volatility, try a quick GPT fallback once more
    if (!hasFundamentals && calculatedPriceVolatility === undefined) {
      try {
        const openAIService = new OpenAIService();
        const fallbackFundamentals = await Promise.race([
          openAIService.estimateFundamentalMetrics(
            ticker,
            profile?.name,
            profile?.industry
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI fallback timeout')), 2000)),
        ]);
        if (fallbackFundamentals && typeof fallbackFundamentals === 'object') {
          Object.assign(fundamentalMetrics, fallbackFundamentals);
        }
      } catch {
        // ignore fallback failure; continue with calculated metrics only
      }
    }

    // Merge fundamental metrics with calculated values
    qualityMetrics = {
      // Profitability
      roic: fundamentalMetrics.roic,
      wacc: fundamentalMetrics.wacc,
      operatingMargin_5yAvg: fundamentalMetrics.operatingMargin_5yAvg,
      operatingMargin_industryPercentile: fundamentalMetrics.operatingMargin_industryPercentile,
      
      // Earnings Quality
      accrualsRatio: fundamentalMetrics.accrualsRatio,
      fcfNetIncome_5yAvg: fundamentalMetrics.fcfNetIncome_5yAvg,
      
      // Balance Sheet Strength
      netDebtEBITDA: fundamentalMetrics.netDebtEBITDA,
      interestCoverage: fundamentalMetrics.interestCoverage,
      
      // Growth Durability
      revenueCAGR_5y: fundamentalMetrics.revenueCAGR_5y,
      revenueCAGR_industryStdDev: fundamentalMetrics.revenueCAGR_industryStdDev,
      revenueVolatility_5y: fundamentalMetrics.revenueVolatility_5y,
      revenueVolatility_industryPercentile: fundamentalMetrics.revenueVolatility_industryPercentile,
      
      // Capital Allocation
      reinvestmentEfficiency: fundamentalMetrics.reinvestmentEfficiency,
      reinvestmentEfficiency_industryPercentile: fundamentalMetrics.reinvestmentEfficiency_industryPercentile,
      shareholderReturns_pctFCF: fundamentalMetrics.shareholderReturns_pctFCF,
      netDebtEBITDA_trend: fundamentalMetrics.netDebtEBITDA_trend,
      
      // Risk/Volatility (use calculated if ChatGPT doesn't provide)
      beta: calculatedBeta || fundamentalMetrics.beta,
      priceVolatility: calculatedPriceVolatility || fundamentalMetrics.priceVolatility,
      priceVolatility_industryPercentile: fundamentalMetrics.priceVolatility_industryPercentile,
      
      // Data Completeness
      dataCompleteness: fundamentalMetrics.dataCompleteness !== undefined ? fundamentalMetrics.dataCompleteness : 1.0,
      yearsOfData: fundamentalMetrics.yearsOfData,
      hasData: hasFundamentals || calculatedPriceVolatility !== undefined,
    };

    // Validate DCF upside/downside - filter out extreme/invalid values
    // Reasonable range: -90% to +500% (anything outside is likely a calculation error)
    const isValidDcf = dcfUpsideDownside !== undefined && 
                       isFinite(dcfUpsideDownside) && 
                       dcfUpsideDownside >= -90 && 
                       dcfUpsideDownside <= 500;
    
    // Use defaults if data not available or invalid
    // Don't use fallback for DCF - return null so UI can show "N/A"
    const finalDcfUpside = isValidDcf ? dcfUpsideDownside : undefined;
    const finalMomentum = momentumScore !== undefined ? momentumScore : undefined;
    const finalSentiment = sentimentScore !== undefined ? sentimentScore : 0.1;
    const finalQuality = qualityMetrics;
    // Only apply fragility if we have real sensitivity data from a valuation run
    const finalSensitivity = sensitivityData || undefined;
    const finalRisk = Object.keys(riskMetrics).length > 0 ? riskMetrics : {
      max_drawdown: 0.15,
      volatility: 0.25,
      beta: 1.0,
      var_95: 0.02,
    };

    // Log data availability for debugging
    console.log(`[Scoring ${ticker}] DCF: ${finalDcfUpside !== undefined ? finalDcfUpside.toFixed(2) : 'N/A'}, Momentum score: ${finalMomentum !== undefined ? finalMomentum.toFixed(2) : 'N/A'}, Sentiment: ${finalSentiment !== undefined ? finalSentiment.toFixed(2) : 'N/A'}`);

    const score = ScoringEngine.calculateUnifiedScore({
      dcf_upside_downside: finalDcfUpside,
      momentum_score: finalMomentum,
      sentiment_score: finalSentiment,
      quality_metrics: finalQuality,
      sensitivity_data: finalSensitivity,
      risk_metrics: finalRisk,
    });

    // Derive a display-friendly DCF upside percentage:
    // - If we have a valid upside/downside from DCF, use it directly
    // - Otherwise, approximate from the DCF component score: score 50 ≈ 0%,
    //   60 ≈ +10%, 40 ≈ -10%, etc. (inverse of calculateDCFUpside mapping)
    let displayDcfPct: number | null = null;
    if (isValidDcf && finalDcfUpside !== undefined) {
      displayDcfPct = finalDcfUpside;
    } else if (
      score?.components?.dcf_upside !== undefined &&
      isFinite(score.components.dcf_upside)
    ) {
      const s = score.components.dcf_upside;
      displayDcfPct = s - 50; // inverse of calculateDCFUpside
    }

    return NextResponse.json({
      ticker,
      score,
      // Expose a usable upside/downside percentage for UI.
      // When raw DCF is missing, this is approximated from the DCF component score.
      dcf_upside_pct: displayDcfPct,
      sentiment_details: sentimentDetails,
      timestamp: new Date().toISOString(),
      data_sources: {
        dcf: isValidDcf,
        sentiment: sentimentScore !== undefined,
        risk: true,
        quality: false, // Not yet implemented
      },
    });
  } catch (error: any) {
    console.error('Scoring error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

'use client';

import { useEffect, useState } from 'react';
import styles from './Research.module.css';
import AddToPortfolioModal from './components/AddToPortfolioModal';
import { getCachedResearch, saveCachedResearch, clearExpiredCache } from '@/lib/research-cache';

export default function ResearchPage() {
  const [ticker, setTicker] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'dcf' | 'sentiment' | 'risk'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [dcfData, setDcfData] = useState<any>(null);
  const [sentimentData, setSentimentData] = useState<any>(null);
  const [riskData, setRiskData] = useState<any>(null);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAddingToWatchlist, setIsAddingToWatchlist] = useState(false);
  const [watchlistStatus, setWatchlistStatus] = useState<'none' | 'added' | 'exists'>('none');
  const [showAddToPortfolio, setShowAddToPortfolio] = useState(false);
  const [recentTickers, setRecentTickers] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const loadDCFData = async (symbol: string = ticker, useCache: boolean = true) => {
    const upperSymbol = symbol.toUpperCase();
    
    // Check cache first
    if (useCache) {
      const cached = getCachedResearch(upperSymbol, 'dcf');
      if (cached) {
        setDcfData(cached);
        return;
      }
    }

    // Fetch fresh data
    const response = await fetch('/api/valuations/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: upperSymbol,
        forecast_period: 10,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to calculate DCF');
    }

    const data = await response.json();
    setDcfData(data);
    // Save to cache
    saveCachedResearch(upperSymbol, 'dcf', data);
  };

  const loadSentimentData = async (symbol: string = ticker, useCache: boolean = true) => {
    const upperSymbol = symbol.toUpperCase();
    
    // Check cache first
    if (useCache) {
      const cached = getCachedResearch(upperSymbol, 'sentiment');
      if (cached) {
        setSentimentData(cached);
        return;
      }
    }

    // Fetch fresh data
    const response = await fetch('/api/sentiment/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: upperSymbol,
        days: 30,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to analyze sentiment');
    }

    const data = await response.json();
    setSentimentData(data);
    // Save to cache
    saveCachedResearch(upperSymbol, 'sentiment', data);
  };

  const loadOverviewData = async (symbol: string = ticker, useCache: boolean = true) => {
    const upperSymbol = symbol.toUpperCase();
    
    // Check cache first
    if (useCache) {
      const cached = getCachedResearch(upperSymbol, 'overview');
      if (cached) {
        setOverviewData(cached);
        // Check if ticker is already in watchlist
        checkWatchlistStatus(upperSymbol);
        return;
      }
    }

    // Fetch fresh data
    try {
      const response = await fetch('/api/company/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: upperSymbol }),
      });

      if (response.ok) {
        const data = await response.json();
        setOverviewData(data);
        // Save to cache
        saveCachedResearch(upperSymbol, 'overview', data);
        // Check if ticker is already in watchlist
        checkWatchlistStatus(upperSymbol);
      }
    } catch (err) {
      // Silently fail - overview is optional
    }
  };

  const checkWatchlistStatus = (tickerSymbol: string) => {
    const saved = localStorage.getItem('fina3010_watchlist');
    if (saved) {
      const watchlist = JSON.parse(saved);
      const exists = watchlist.some((item: any) => item.ticker === tickerSymbol.toUpperCase());
      setWatchlistStatus(exists ? 'exists' : 'none');
    } else {
      setWatchlistStatus('none');
    }
  };

  const addToWatchlist = async () => {
    if (!ticker.trim()) return;

    setIsAddingToWatchlist(true);
    try {
      const response = await fetch('/api/scoring/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.toUpperCase() }),
      });

      if (!response.ok) {
        throw new Error('Failed to score ticker');
      }

      const data = await response.json();
      const newItem = {
        ticker: ticker.toUpperCase(),
        score: data.score.overall_score,
        recommendation: data.score.recommendation,
        dcf_upside: data.score.components.dcf_upside,
        momentum: data.score.components.momentum,
        sentiment: data.score.components.sentiment,
        quality: data.score.components.quality,
        flags: data.score.flags,
      };

      const saved = localStorage.getItem('fina3010_watchlist');
      const watchlist = saved ? JSON.parse(saved) : [];
      
      // Check if already exists
      const exists = watchlist.some((item: any) => item.ticker === ticker.toUpperCase());
      if (exists) {
        setWatchlistStatus('exists');
      } else {
        watchlist.push(newItem);
        localStorage.setItem('fina3010_watchlist', JSON.stringify(watchlist));
        setWatchlistStatus('added');
        setTimeout(() => setWatchlistStatus('none'), 3000); // Reset after 3 seconds
      }
    } catch (error: any) {
      setError(`Failed to add to watchlist: ${error.message}`);
    } finally {
      setIsAddingToWatchlist(false);
    }
  };

  const loadRiskData = async (symbol: string = ticker, useCache: boolean = true) => {
    const upperSymbol = symbol.toUpperCase();
    
    // Check cache first
    if (useCache) {
      const cached = getCachedResearch(upperSymbol, 'risk');
      if (cached) {
        setRiskData(cached);
        return;
      }
    }

    // Fetch fresh data
    const response = await fetch('/api/risk/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: upperSymbol,
        lookback_days: 252,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to analyze risk');
    }

    const data = await response.json();
    setRiskData(data);
    // Save to cache
    saveCachedResearch(upperSymbol, 'risk', data);
  };

  const handleTabChange = async (tab: 'overview' | 'dcf' | 'sentiment' | 'risk') => {
    setActiveTab(tab);
    if (ticker) {
      // Check if we have cached data first - if so, don't show loading
      const upperTicker = ticker.toUpperCase();
      let hasCache = false;
      
      if (tab === 'overview') {
        hasCache = !!getCachedResearch(upperTicker, 'overview');
        if (!hasCache && !overviewData) setIsLoading(true);
      } else if (tab === 'dcf') {
        hasCache = !!getCachedResearch(upperTicker, 'dcf');
        if (!hasCache && !dcfData) setIsLoading(true);
      } else if (tab === 'sentiment') {
        hasCache = !!getCachedResearch(upperTicker, 'sentiment');
        if (!hasCache && !sentimentData) setIsLoading(true);
      } else if (tab === 'risk') {
        hasCache = !!getCachedResearch(upperTicker, 'risk');
        if (!hasCache && !riskData) setIsLoading(true);
      }
      
      try {
        if (tab === 'overview' && !overviewData) {
          await loadOverviewData();
        } else if (tab === 'dcf' && !dcfData) {
          await loadDCFData();
        } else if (tab === 'sentiment' && !sentimentData) {
          await loadSentimentData();
        } else if (tab === 'risk' && !riskData) {
          await loadRiskData();
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const runResearchForTicker = async (symbol: string, skipCache: boolean = false) => {
    const trimmed = symbol.trim();
    if (!trimmed) return;
    const upper = trimmed.toUpperCase();
    setTicker(upper);
    
    // Clear existing data to show fresh results
    setDcfData(null);
    setSentimentData(null);
    setRiskData(null);
    setOverviewData(null);
    
    // Check if all data is cached - if so, load instantly without loading state
    const hasOverviewCache = !!getCachedResearch(upper, 'overview');
    const hasDcfCache = !!getCachedResearch(upper, 'dcf');
    const hasSentimentCache = !!getCachedResearch(upper, 'sentiment');
    const hasRiskCache = !!getCachedResearch(upper, 'risk');
    
    const allCached = hasOverviewCache && 
      (activeTab === 'dcf' ? hasDcfCache : 
       activeTab === 'sentiment' ? hasSentimentCache : 
       activeTab === 'risk' ? hasRiskCache : true);
    
    if (!allCached && !skipCache) {
      setIsLoading(true);
    }
    
    setError(null);
    
    try {
      // Load overview first (always needed)
      await loadOverviewData(upper, !skipCache);
      
      // Load active tab data
      if (activeTab === 'dcf') {
        await loadDCFData(upper, !skipCache);
      } else if (activeTab === 'sentiment') {
        await loadSentimentData(upper, !skipCache);
      } else if (activeTab === 'risk') {
        await loadRiskData(upper, !skipCache);
      }
      
      // Update recent tickers list
      setRecentTickers((prev) => {
        const next = [upper, ...prev.filter((t) => t !== upper)];
        const sliced = next.slice(0, 5);
        if (typeof window !== 'undefined') {
          localStorage.setItem('fina3010_recent_research', JSON.stringify(sliced));
        }
        return sliced;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runResearchForTicker(ticker);
  };

  useEffect(() => {
    const handler = (event: any) => {
      const symbol = event?.detail?.ticker;
      if (!symbol) return;
      setActiveTab('overview');
      runResearchForTicker(symbol);
    };
    window.addEventListener('assistant:research', handler as any);
    return () => window.removeEventListener('assistant:research', handler as any);
  }, [activeTab]);

  useEffect(() => {
    const handler = () => {
      if (!ticker) return;
      setShowAddToPortfolio(true);
    };
    window.addEventListener('assistant:addToPortfolio', handler);
    return () => window.removeEventListener('assistant:addToPortfolio', handler);
  }, [ticker]);

  useEffect(() => {
    // Load recent tickers from localStorage
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('fina3010_recent_research');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentTickers(parsed.map((s) => String(s).toUpperCase()));
        }
      }
      
      // Clean up expired cache entries on mount
      clearExpiredCache();
    } catch {
      // ignore parse errors
    }
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Equity Research Workspace</h1>
          <p>Run valuations, sentiment, and risk checks before placing MarketWatch trades.</p>
        </div>
        <div className={styles.logo}>ARQAM</div>
      </header>

      <div className={styles.searchSection}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input
            type="text"
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value.toUpperCase());
              setWatchlistStatus('none'); // Reset status when ticker changes
            }}
            placeholder="Enter ticker symbol (e.g., AAPL, MSFT, TSLA)"
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchButton} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Research'}
          </button>
          {ticker && (
            <>
              <button
                type="button"
                onClick={addToWatchlist}
                className={styles.addToWatchlistButton}
                disabled={isAddingToWatchlist || watchlistStatus === 'exists'}
              >
                {isAddingToWatchlist 
                  ? 'Adding...' 
                  : watchlistStatus === 'exists' 
                    ? '✓ In Watchlist' 
                    : watchlistStatus === 'added'
                      ? '✓ Added!'
                      : '+ Add to Watchlist'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    await runResearchForTicker(ticker, true); // skipCache = true
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                className={styles.refreshButton}
                disabled={isLoading || isRefreshing}
                title="Refresh with fresh data (bypass cache)"
              >
                {isRefreshing ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            </>
          )}
        </form>
        {recentTickers.length > 0 && (
          <div className={styles.recentSection}>
            <span className={styles.recentLabel}>Recent tickers</span>
            <div className={styles.recentList}>
              {recentTickers.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  className={styles.recentChip}
                  onClick={() => runResearchForTicker(sym)}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {ticker && (
        <div className={styles.content}>
          <nav className={styles.navTabs}>
            <button
              className={activeTab === 'overview' ? styles.tabActive : styles.tab}
              onClick={() => handleTabChange('overview')}
            >
              Overview
            </button>
            <button
              className={activeTab === 'dcf' ? styles.tabActive : styles.tab}
              onClick={() => handleTabChange('dcf')}
            >
              DCF Valuation
            </button>
            <button
              className={activeTab === 'sentiment' ? styles.tabActive : styles.tab}
              onClick={() => handleTabChange('sentiment')}
            >
              Sentiment Analysis
            </button>
            <button
              className={activeTab === 'risk' ? styles.tabActive : styles.tab}
              onClick={() => handleTabChange('risk')}
            >
              Risk Metrics
            </button>
          </nav>

          <div className={styles.tabContent}>
            {isLoading ? (
              <div className={styles.loading}>Loading analysis...</div>
            ) : (
              <>
                {ticker && (
                  <div className={styles.cacheIndicator}>
                    {getCachedResearch(ticker, activeTab) ? (
                      <span className={styles.cacheBadge} title="Data loaded from cache">
                        ⚡ Cached
                      </span>
                    ) : (
                      <span className={styles.freshBadge} title="Fresh data">
                        ✨ Fresh
                      </span>
                    )}
                  </div>
                )}
                {activeTab === 'overview' && (
                  <OverviewTab ticker={ticker} data={overviewData} />
                )}
                {activeTab === 'dcf' && (
                  <DCFTab ticker={ticker} data={dcfData} />
                )}
                {activeTab === 'sentiment' && (
                  <SentimentTab ticker={ticker} data={sentimentData} />
                )}
                {activeTab === 'risk' && (
                  <RiskTab ticker={ticker} data={riskData} />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {!ticker && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📊</div>
          <h2>Research Any Stock</h2>
          <p>Enter a ticker symbol above to get started with comprehensive stock analysis</p>
          <div className={styles.featuresList}>
            <div className={styles.featureCard}>
              <strong>DCF Valuation</strong>
              <p>Calculate intrinsic value using discounted cash flow analysis</p>
            </div>
            <div className={styles.featureCard}>
              <strong>Sentiment Analysis</strong>
              <p>Analyze news sentiment and market perception</p>
            </div>
            <div className={styles.featureCard}>
              <strong>Risk Metrics</strong>
              <p>Assess volatility, beta, drawdowns, VaR, and correlation</p>
            </div>
          </div>
        </div>
      )}

      {showAddToPortfolio && (
        <AddToPortfolioModal
          ticker={ticker}
          currentPrice={overviewData?.current_price || dcfData?.current_price}
          onClose={() => setShowAddToPortfolio(false)}
        />
      )}
    </div>
  );
}

function OverviewTab({ ticker, data }: { ticker: string; data: any }) {
  const info = data || {};
  const hasProfileData =
    info && (info.name || info.exchange || info.country || info.industry || info.marketCap || info.current_price);

  // Format market cap (always in USD now)
  const formatMarketCap = (marketCap: number) => {
    if (!marketCap || marketCap <= 0) return 'N/A';
    
    // Values are already in USD from backend
    if (marketCap >= 1e12) {
      return `$${(marketCap / 1e12).toFixed(2)}T`;
    } else if (marketCap >= 1e9) {
      return `$${(marketCap / 1e9).toFixed(2)}B`;
    } else if (marketCap >= 1e6) {
      return `$${(marketCap / 1e6).toFixed(2)}M`;
    } else {
      return `$${marketCap.toFixed(0)}`;
    }
  };

  // Format price (always in USD now)
  const formatPrice = (price: number) => {
    if (!price || price <= 0) return 'N/A';
    return `$${price.toFixed(2)}`;
  };

  return (
    <div className={styles.tabPanel}>
      <h2>Company Overview - {info.name || ticker}</h2>
      
      <div className={styles.resultsGrid}>
        <div className={styles.resultCard}>
          <div className={styles.resultLabel}>Company Name</div>
          <div className={styles.resultValue}>{info.name || ticker}</div>
        </div>
        <div className={styles.resultCard}>
          <div className={styles.resultLabel}>Exchange</div>
          <div className={styles.resultValue}>{info.exchange && info.exchange.trim() ? info.exchange : 'N/A'}</div>
        </div>
        <div className={styles.resultCard}>
          <div className={styles.resultLabel}>Country</div>
          <div className={styles.resultValue}>{info.country && info.country.trim() ? info.country : 'N/A'}</div>
        </div>
        <div className={styles.resultCard}>
          <div className={styles.resultLabel}>Industry</div>
          <div className={styles.resultValue}>{info.industry && info.industry.trim() ? info.industry : 'N/A'}</div>
        </div>
        <div className={styles.resultCard}>
          <div className={styles.resultLabel}>Market Cap</div>
          <div className={styles.resultValue}>
            {formatMarketCap(info.marketCap)}
          </div>
        </div>
        {info.current_price && info.current_price > 0 && (
          <div className={styles.resultCard}>
            <div className={styles.resultLabel}>Current Price</div>
            <div className={styles.resultValue}>{formatPrice(info.current_price)}</div>
          </div>
        )}
      </div>

      <div className={styles.infoCard} style={{ marginTop: '2rem' }}>
        {hasProfileData ? (
          <p><strong>Use the tabs above</strong> to view DCF Valuation, Sentiment Analysis, and Risk Metrics.</p>
        ) : (
          <p style={{ color: '#6b7280' }}>
            No detailed profile data is available from the data provider for this symbol. You can still use the DCF,
            Sentiment, and Risk tabs to analyze it where data is available.
          </p>
        )}
      </div>
    </div>
  );
}

function DCFTab({ ticker, data }: { ticker: string; data: any }) {
  if (!data) {
    return (
      <div className={styles.tabPanel}>
        <div className={styles.sectionHeader}>
          <h2>DCF Valuation</h2>
          <span className={styles.pill}>Ticker: {ticker}</span>
        </div>
        <p style={{ color: '#6b7280' }}>Click "Research" to calculate DCF valuation for {ticker}.</p>
      </div>
    );
  }

  return (
    <div className={styles.tabPanel}>
      <div className={styles.sectionHeader}>
        <h2>DCF Valuation</h2>
        <span className={styles.pill}>
          {data.company_name || ticker} · {ticker}
        </span>
      </div>
      
      <div className={styles.resultsGrid}>
        <div className={styles.resultCard}>
          <div className={styles.resultLabel}>Current Price</div>
          <div className={styles.resultValue}>${data.current_price?.toFixed(2)}</div>
        </div>
        <div className={styles.resultCard}>
          <div className={styles.resultLabel}>Implied Price</div>
          <div className={styles.resultValue}>${data.implied_price?.toFixed(2)}</div>
        </div>
        <div className={styles.resultCard}>
          <div className={styles.resultLabel}>Upside/Downside</div>
          <div className={styles.resultValue} style={{ 
            color: data.upside_downside >= 0 ? '#10b981' : '#ef4444' 
          }}>
            {data.upside_downside >= 0 ? '+' : ''}{data.upside_downside?.toFixed(2)}%
          </div>
        </div>
        <div className={styles.resultCard}>
          <div className={styles.resultLabel}>WACC</div>
          <div className={styles.resultValue}>{data.wacc?.toFixed(2)}%</div>
        </div>
      </div>

      {data.projections && data.projections.length > 0 && (
        <div className={styles.projectionsTable}>
          <h3>Financial Projections</h3>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Revenue ($B)</th>
                <th>Growth %</th>
                <th>FCF ($B)</th>
                <th>PV FCF ($B)</th>
              </tr>
            </thead>
            <tbody>
              {data.projections.slice(0, 5).map((proj: any) => (
                <tr key={proj.year}>
                  <td>{proj.year}</td>
                  <td>${proj.revenue?.toFixed(2)}</td>
                  <td>{proj.revenue_growth_pct?.toFixed(1)}%</td>
                  <td>${proj.fcf?.toFixed(2)}</td>
                  <td>${proj.pv_fcf?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SentimentTab({ ticker, data }: { ticker: string; data: any }) {
  if (!data) {
    return (
      <div className={styles.tabPanel}>
        <div className={styles.sectionHeader}>
          <h2>Sentiment Analysis</h2>
          <span className={styles.pill}>Ticker: {ticker}</span>
        </div>
        <p style={{ color: '#6b7280' }}>Click "Research" to analyze sentiment for {ticker}.</p>
      </div>
    );
  }

  const sentimentClass =
    data.overall_sentiment > 0 ? styles.pillPositive : data.overall_sentiment < 0 ? styles.pillNegative : styles.pillNeutral;

  const sourceBreakdown = data.source_breakdown || {};
  const finnhubCount = sourceBreakdown['Finnhub'] || sourceBreakdown['SeekingAlpha'] || 0;
  const yahooCount = sourceBreakdown['Yahoo Finance'] || 0;
  const otherSources = Object.entries(sourceBreakdown).filter(([name]) => 
    name !== 'Finnhub' && name !== 'SeekingAlpha' && name !== 'Yahoo Finance'
  );

  return (
    <div className={styles.tabPanel}>
      <div className={styles.sectionHeader}>
        <h2>Sentiment Analysis</h2>
        <span className={`${styles.pill} ${sentimentClass}`}>
          {ticker} · {data.sentiment_label || 'Neutral'}
        </span>
      </div>

      <div className={styles.resultsGrid}>
        <div className={styles.resultCard}>
          <div className={styles.resultLabel}>Overall Sentiment</div>
          <div className={styles.resultValue}>{data.sentiment_label || 'Neutral'}</div>
          <div className={styles.resultNote}>
            Score: {data.overall_sentiment?.toFixed(2)} (-1 to +1)
          </div>
        </div>
        <div className={styles.resultCard}>
          <div className={styles.resultLabel}>News Articles</div>
          <div className={styles.resultValue}>{data.news_count || 0}</div>
          <div className={styles.resultNote}>Analyzed</div>
        </div>
      </div>

      {(finnhubCount > 0 || yahooCount > 0 || otherSources.length > 0) && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600 }}>News Sources</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {finnhubCount > 0 && (
              <div className={styles.chip}>
                <span style={{ fontWeight: 600, color: '#374151' }}>Finnhub:</span>
                <span style={{ color: '#6b7280' }}>{finnhubCount} article{finnhubCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            {yahooCount > 0 && (
              <div className={styles.chip}>
                <span style={{ fontWeight: 600, color: '#374151' }}>Yahoo Finance:</span>
                <span style={{ color: '#6b7280' }}>{yahooCount} article{yahooCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            {otherSources.map(([name, count]) => (
              <div key={name} className={styles.chip}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{name}:</span>
                <span style={{ color: '#6b7280' }}>{count as number} article{(count as number) !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.key_themes && data.key_themes.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Key Themes</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            {data.key_themes.map((theme: string, idx: number) => (
              <span key={idx} className={styles.chip}>{theme}</span>
            ))}
          </div>
        </div>
      )}

      {data.reputable_sources && data.reputable_sources.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3>Reputable Sources Identified</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            {data.reputable_sources.map((source: string, idx: number) => (
              <span key={idx} className={`${styles.chip} ${styles.chipPositive}`}>
                ✓ {source}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.recent_articles && data.recent_articles.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Recent News Articles</h3>
          <div className={styles.newsList}>
            {data.recent_articles.slice(0, 10).map((article: any, idx: number) => {
              const articleSentiment = data.article_sentiments?.[idx];
              return (
                <div key={idx} className={styles.newsItem}>
                  <div className={styles.newsHeader}>
                    <strong>{article.headline}</strong>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {articleSentiment && (
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          background: articleSentiment.sentiment > 0 ? '#dcfce7' : articleSentiment.sentiment < 0 ? '#fee2e2' : '#f3f4f6',
                          color: articleSentiment.sentiment > 0 ? '#166534' : articleSentiment.sentiment < 0 ? '#991b1b' : '#374151',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}>
                          {articleSentiment.sentiment_label}
                        </span>
                      )}
                      <span className={styles.newsSource} style={{
                        fontWeight: 600,
                        padding: '0.25rem 0.5rem',
                        background: article._source_type === 'yahoo' ? '#fef3c7' : 
                                   article._source_type === 'finnhub' ? '#dbeafe' : '#f3f4f6',
                        color: article._source_type === 'yahoo' ? '#78350f' : 
                               article._source_type === 'finnhub' ? '#1e40af' : '#374151',
                        borderRadius: '4px',
                        fontSize: '0.75rem'
                      }}>
                        {articleSentiment?.is_reputable ? '✓ ' : ''}
                        {article._source_type === 'finnhub' ? `Finnhub: ${article.source}` : 
                         article._source_type === 'yahoo' ? 'Yahoo Finance' : 
                         article.source}
                      </span>
                    </div>
                  </div>
                  {article.summary && (
                    <p className={styles.newsSummary}>{article.summary}</p>
                  )}
                  {article.datetime && (
                    <div className={styles.newsDate}>
                      {new Date(article.datetime * 1000).toLocaleDateString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RiskTab({ ticker, data }: { ticker: string; data: any }) {
  if (!data) {
    return (
      <div className={styles.tabPanel}>
        <div className={styles.sectionHeader}>
          <h2>Risk Metrics</h2>
          <span className={styles.pill}>Ticker: {ticker}</span>
        </div>
        <p style={{ color: '#6b7280' }}>Click "Research" to analyze risk for {ticker}.</p>
      </div>
    );
  }

  const metrics = data.metrics || {};

  return (
    <div className={styles.tabPanel}>
      <div className={styles.sectionHeader}>
        <h2>Risk Metrics</h2>
        <span className={styles.pill}>Ticker: {ticker}</span>
      </div>
      
      {data.data_source === 'mock' && (
        <div className={styles.warningMessage} style={{ marginBottom: '1rem', padding: '1rem', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '6px', color: '#78350f' }}>
          ⚠️ Using mock data. Real price data unavailable or API error occurred.
        </div>
      )}

      <div className={styles.riskSections}>
        <div className={styles.riskSection}>
          <h3>Returns</h3>
          <div className={styles.metricRow}>
            <span>Annualized Return:</span>
            <strong>{(metrics.returns?.annualized_return * 100)?.toFixed(2)}%</strong>
          </div>
          <div className={styles.metricRow}>
            <span>Total Return:</span>
            <strong>{(metrics.returns?.total_return * 100)?.toFixed(2)}%</strong>
          </div>
        </div>

        <div className={styles.riskSection}>
          <h3>Volatility</h3>
          <div className={styles.metricRow}>
            <span>Annualized Volatility:</span>
            <strong>{(metrics.volatility?.annualized_vol * 100)?.toFixed(2)}%</strong>
          </div>
          <div className={styles.metricRow}>
            <span>Downside Volatility:</span>
            <strong>{(metrics.volatility?.downside_vol * 100)?.toFixed(2)}%</strong>
          </div>
        </div>

        <div className={styles.riskSection}>
          <h3>Drawdown</h3>
          <div className={styles.metricRow}>
            <span>Max Drawdown:</span>
            <strong style={{ color: '#ef4444' }}>
              {(metrics.drawdown?.max_drawdown * 100)?.toFixed(2)}%
            </strong>
          </div>
          <div className={styles.metricRow}>
            <span>Current Drawdown:</span>
            <strong>{(metrics.drawdown?.current_drawdown * 100)?.toFixed(2)}%</strong>
          </div>
          <div className={styles.metricRow}>
            <span>Max Drawdown Duration:</span>
            <strong>{metrics.drawdown?.max_drawdown_duration} days</strong>
          </div>
        </div>

        <div className={styles.riskSection}>
          <h3>Beta & Correlation</h3>
          <div className={styles.metricRow}>
            <span>Beta:</span>
            <strong>{metrics.beta?.current_beta?.toFixed(2)}</strong>
          </div>
          <div className={styles.metricRow}>
            <span>Market Correlation:</span>
            <strong>{metrics.correlation?.market_correlation?.toFixed(3)}</strong>
          </div>
        </div>

        <div className={styles.riskSection}>
          <h3>Value at Risk (VaR)</h3>
          <div className={styles.metricRow}>
            <span>VaR (95%):</span>
            <strong style={{ color: '#ef4444' }}>
              {(metrics.var?.var_95 * 100)?.toFixed(2)}%
            </strong>
          </div>
          <div className={styles.metricRow}>
            <span>VaR (99%):</span>
            <strong style={{ color: '#ef4444' }}>
              {(metrics.var?.var_99 * 100)?.toFixed(2)}%
            </strong>
          </div>
          <div className={styles.metricRow}>
            <span>CVaR (95%):</span>
            <strong style={{ color: '#ef4444' }}>
              {(metrics.var?.cvar_95 * 100)?.toFixed(2)}%
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}

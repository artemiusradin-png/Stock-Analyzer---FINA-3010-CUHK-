'use client';

import { useState, useEffect } from 'react';
import styles from './Watchlist.module.css';
import AddToPortfolioModal from '../research/components/AddToPortfolioModal';
import { getCachedResearch } from '@/lib/research-cache';

interface WatchlistItem {
  ticker: string;
  score: number;
  recommendation: string;
  dcf_upside_pct: number | undefined;
  dcf_upside: number | undefined;
  momentum: number | undefined;
  sentiment: number | undefined;
  quality: number | undefined;
  dcf_implied_price?: number;
  dcf_current_price?: number;
  flags: {
    high_fragility: boolean;
    high_risk: boolean;
    negative_sentiment: boolean;
    negative_momentum: boolean;
  };
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [newTicker, setNewTicker] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddToPortfolio, setShowAddToPortfolio] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [currentPrice, setCurrentPrice] = useState<number | undefined>(undefined);
  const [hasAutoRefreshed, setHasAutoRefreshed] = useState(false);

  const mergeCachedDcf = (items: WatchlistItem[]): WatchlistItem[] => {
    return items.map((item) => {
      const cachedDcf = getCachedResearch(item.ticker, 'dcf');
      const cachedUpside = cachedDcf?.upside_downside;
      const hasValidUpside =
        cachedUpside !== undefined && cachedUpside !== null && isFinite(cachedUpside);

      return {
        ...item,
        dcf_upside_pct: hasValidUpside ? cachedUpside : item.dcf_upside_pct,
        dcf_implied_price: isFinite(cachedDcf?.implied_price) ? cachedDcf.implied_price : item.dcf_implied_price,
        dcf_current_price: isFinite(cachedDcf?.current_price) ? cachedDcf.current_price : item.dcf_current_price,
      };
    });
  };

  useEffect(() => {
    loadWatchlist();
  }, []);

  // Temporary debug logging to verify component scores
  useEffect(() => {
    if (watchlist.length === 0) return;
    console.table(
      watchlist.map((stock) => ({
        ticker: stock.ticker,
        momentum: stock.momentum,
        sentiment: stock.sentiment,
        quality: stock.quality,
        overall: stock.score,
      }))
    );
  }, [watchlist]);

  // After loading existing watchlist items, automatically refresh scores once on mount
  useEffect(() => {
    // Only run once on initial mount if watchlist has items
    if (!hasAutoRefreshed && watchlist.length > 0) {
      setHasAutoRefreshed(true);
      // Fire and forget – UI already has manual refresh if this fails
      // Use a separate function to avoid dependency issues
      const doRefresh = async () => {
        try {
          if (watchlist.length === 0) return;
          setIsLoading(true);
          const updated = await Promise.all(
            watchlist.map(async (item) => {
              try {
                const response = await fetch('/api/scoring/unified', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ticker: item.ticker, skipDCF: true }),
                });

                if (!response.ok) {
                  throw new Error(`Scoring API returned ${response.status}`);
                }

                const data = await response.json();
                const cachedDcf = getCachedResearch(item.ticker, 'dcf');
                const cachedUpside = cachedDcf?.upside_downside;
                const isValidDcf =
                  cachedUpside !== null &&
                  cachedUpside !== undefined &&
                  isFinite(cachedUpside) &&
                  cachedUpside >= -90 &&
                  cachedUpside <= 500;

                return {
                  ...item,
                  score: data.score?.overall_score ?? item.score,
                  recommendation: data.score?.recommendation ?? item.recommendation,
                  dcf_upside: cachedDcf?.upside_downside ?? item.dcf_upside,
                  dcf_upside_pct: isValidDcf ? cachedUpside : item.dcf_upside_pct,
                  dcf_implied_price: cachedDcf?.implied_price ?? item.dcf_implied_price,
                  dcf_current_price: cachedDcf?.current_price ?? item.dcf_current_price,
                  momentum: data.score?.components?.momentum ?? item.momentum,
                  sentiment: data.score?.components?.sentiment ?? item.sentiment,
                  quality: data.score?.components?.quality ?? item.quality,
                  flags: data.score?.flags ?? item.flags,
                };
              } catch (err) {
                console.warn(`Failed to refresh score for ${item.ticker}:`, err);
                return item;
              }
            })
          );
          setWatchlist(updated.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)));
          localStorage.setItem('fina3010_watchlist', JSON.stringify(updated.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))));
        } catch (error) {
          console.error('Auto-refresh failed:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      doRefresh();
    }
    // Only depend on hasAutoRefreshed and watchlist length - don't depend on refreshScores
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAutoRefreshed]);

  const loadWatchlist = () => {
    const saved = localStorage.getItem('fina3010_watchlist');
    if (saved) {
      const parsed: WatchlistItem[] = JSON.parse(saved);
      setWatchlist(mergeCachedDcf(parsed));
    }
  };

  const saveWatchlist = (items: WatchlistItem[]) => {
    const merged = mergeCachedDcf(items);
    setWatchlist(merged);
    localStorage.setItem('fina3010_watchlist', JSON.stringify(merged));
  };

  const addToWatchlist = async () => {
    if (!newTicker.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/scoring/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: newTicker.toUpperCase(), skipDCF: true }),
      });

      if (!response.ok) throw new Error('Failed to score ticker');

      const data = await response.json();
      // Validate DCF upside - filter out extreme/invalid values
      const cachedDcf = getCachedResearch(newTicker, 'dcf');
      const cachedUpside = cachedDcf?.upside_downside;
      const isValidDcf = cachedUpside !== null && 
                         cachedUpside !== undefined && 
                         isFinite(cachedUpside) && 
                         cachedUpside >= -90 && 
                         cachedUpside <= 500;
      
      const newItem: WatchlistItem = {
        ticker: newTicker.toUpperCase(),
        score: data.score?.overall_score ?? 0,
        recommendation: data.score?.recommendation ?? 'neutral',
        dcf_upside: cachedDcf?.upside_downside,
        dcf_upside_pct: isValidDcf ? cachedUpside : undefined,
        dcf_implied_price: cachedDcf?.implied_price,
        dcf_current_price: cachedDcf?.current_price,
        momentum: data.score?.components?.momentum,
        sentiment: data.score?.components?.sentiment,
        quality: data.score?.components?.quality,
        flags: data.score?.flags ?? {
          high_fragility: false,
          high_risk: false,
          negative_sentiment: false,
          negative_momentum: false,
        },
      };

      saveWatchlist([...watchlist, newItem]);
      setNewTicker('');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromWatchlist = (ticker: string) => {
    saveWatchlist(watchlist.filter(item => item.ticker !== ticker));
  };

  const handleAddToPortfolio = async (ticker: string) => {
    setSelectedTicker(ticker);
    setShowAddToPortfolio(true);
    
    // Fetch current price
    try {
      const response = await fetch('/api/company/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentPrice(data.current_price);
      }
    } catch (error) {
      console.warn('Failed to fetch current price:', error);
      setCurrentPrice(undefined);
    }
  };

  const refreshScores = async () => {
    if (isLoading) return; // Prevent multiple simultaneous refreshes
    if (watchlist.length === 0) return; // Nothing to refresh
    
    setIsLoading(true);
    try {
      const updated = await Promise.all(
        watchlist.map(async (item) => {
          try {
            const response = await fetch('/api/scoring/unified', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticker: item.ticker }),
            });

            if (!response.ok) {
              throw new Error(`Scoring API returned ${response.status}`);
            }

            const data = await response.json();
            // Validate DCF upside - filter out extreme/invalid values
            const dcfUpsidePct = data.dcf_upside_pct;
            const isValidDcf =
              dcfUpsidePct !== null &&
              dcfUpsidePct !== undefined &&
              isFinite(dcfUpsidePct) &&
              dcfUpsidePct >= -90 &&
              dcfUpsidePct <= 500;

            return {
              ...item,
              score: data.score?.overall_score ?? item.score,
              recommendation: data.score?.recommendation ?? item.recommendation,
              dcf_upside: data.score?.components?.dcf_upside ?? item.dcf_upside,
              dcf_upside_pct: isValidDcf ? dcfUpsidePct : undefined, // Set to undefined if invalid so it shows "N/A"
              momentum: data.score?.components?.momentum ?? item.momentum,
              sentiment: data.score?.components?.sentiment ?? item.sentiment,
              quality: data.score?.components?.quality ?? item.quality,
              flags: data.score?.flags ?? item.flags,
            };
          } catch (err) {
            console.warn(`Failed to refresh score for ${item.ticker}:`, err);
            // If one ticker fails, keep its previous values instead of breaking the whole refresh.
            return item;
          }
        })
      );
      saveWatchlist(updated.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)));
    } catch (error: any) {
      console.error('Error refreshing scores:', error);
      alert(`Error refreshing scores: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addAllToBuilder = () => {
    if (typeof window === 'undefined') return;
    if (watchlist.length === 0) return;

    try {
      const tickers = watchlist.map((item) => item.ticker);
      localStorage.setItem('fina3010_builder_seed', JSON.stringify(tickers));
      window.location.href = '/builder';
    } catch (error) {
      console.warn('Failed to seed portfolio builder from watchlist:', error);
    }
  };

  const sortedWatchlist = [...watchlist].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Watchlist</h1>
          <p>Track and rank stocks using unified scoring</p>
        </div>
        <div className={styles.logo}>ARQAM</div>
      </header>

      <div className={styles.mainContent}>
        <div className={styles.addSection}>
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            placeholder="Enter ticker (e.g., AAPL)"
            className={styles.input}
          />
          <div className={styles.buttonGroup}>
            <button onClick={addToWatchlist} className={styles.addButton} disabled={isLoading || !newTicker.trim()}>
              Add to Watchlist
            </button>
            {watchlist.length > 0 && (
              <>
                <button onClick={addAllToBuilder} className={styles.refreshButton} disabled={isLoading}>
                  Add All → Builder
                </button>
                <button
                  onClick={refreshScores}
                  className={`${styles.refreshButton} ${styles.refreshButtonSmall}`}
                  disabled={isLoading}
                  title="Refresh scores"
                >
                  ↻ Refresh
                </button>
              </>
            )}
          </div>
        </div>

        {watchlist.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No stocks in watchlist. Add tickers to get unified scores and rankings.</p>
          </div>
        ) : (
          <div className={styles.watchlistTable}>
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Ticker</th>
                  <th>Score (0–100)</th>
                  <th>Recommendation</th>
                  <th>DCF Upside (%)</th>
                  <th>Momentum Score</th>
                  <th>Sentiment Score</th>
                  <th>Quality Score</th>
                  <th>Flags</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedWatchlist.map((item, index) => (
                  <tr key={item.ticker}>
                    <td>#{index + 1}</td>
                    <td><strong>{item.ticker}</strong></td>
                    <td>
                      <div className={styles.scoreCell}>
                        <span className={styles.scoreValue}>{(item.score ?? 0).toFixed(1)}</span>
                        <div className={styles.scoreBar}>
                          <div
                            className={styles.scoreFill}
                            style={{ width: `${item.score ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[item.recommendation.replace('_', '')]}`}>
                        {item.recommendation.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const v = item.dcf_upside_pct;
                        // Validate: must be finite and within reasonable range (-90% to +500%)
                        if (v === undefined || v === null || !isFinite(v) || v < -90 || v > 500) {
                          return 'N/A';
                        }
                        const signed = v >= 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`;
                        return signed;
                      })()}
                    </td>
                    <td>{(item.momentum ?? 50).toFixed(1)}</td>
                    <td>{(item.sentiment ?? 50).toFixed(1)}</td>
                    <td>{(item.quality ?? 50).toFixed(1)}</td>
                    <td>
                      <div className={styles.flags}>
                        {item.flags.high_fragility && <span className={styles.flag} title="High Fragility">⚠️</span>}
                        {item.flags.high_risk && <span className={styles.flag} title="High Risk">🔴</span>}
                        {item.flags.negative_sentiment && <span className={styles.flag} title="Negative Sentiment">📉</span>}
                        {item.flags.negative_momentum && <span className={styles.flag} title="Negative Momentum">⬇️</span>}
                      </div>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button
                          onClick={() => handleAddToPortfolio(item.ticker)}
                          className={styles.addToPortfolioButton}
                          title="Add to Portfolio"
                          disabled={isLoading}
                        >
                          💼 Add
                        </button>
                        <button
                          onClick={() => removeFromWatchlist(item.ticker)}
                          className={styles.removeButton}
                          title="Remove from Watchlist"
                          disabled={isLoading}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.infoBox}>
          <h3>Unified Scoring (0-100)</h3>
          <p>The unified score combines:</p>
          <ul>
            <li><strong>DCF Upside (30%):</strong> Valuation attractiveness</li>
            <li><strong>Momentum (20%):</strong> Price trend strength</li>
            <li><strong>Sentiment (20%):</strong> News and market perception</li>
            <li><strong>Quality (30%):</strong> Financial health metrics</li>
            <li><strong>Penalties:</strong> Risk flags and fragility reduce score</li>
          </ul>
        </div>
      </div>

      {showAddToPortfolio && (
        <AddToPortfolioModal
          ticker={selectedTicker}
          currentPrice={currentPrice}
          onClose={() => {
            setShowAddToPortfolio(false);
            setSelectedTicker('');
            setCurrentPrice(undefined);
          }}
        />
      )}
    </div>
  );
}

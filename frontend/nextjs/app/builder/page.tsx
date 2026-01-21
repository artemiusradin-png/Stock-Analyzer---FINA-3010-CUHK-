'use client';

import { useState, useEffect } from 'react';
import styles from './Builder.module.css';
import type { OptimizationStrategy, OptimizedPosition, OptimizationResult } from '@/lib/portfolio-optimizer';
import type { VaRResult } from '@/lib/var-calculator';

interface Position {
  ticker: string;
  quantity: number;
  price: number;
  percentage: number;
}

export default function BuilderPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [optimizationStrategy, setOptimizationStrategy] = useState<OptimizationStrategy>('max_sharpe');
  const [optimizedResult, setOptimizedResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showOptimized, setShowOptimized] = useState(false);
  const [varResult, setVarResult] = useState<VaRResult | null>(null);
  const portfolioValue = 100000;

  const loadSavedPositions = () => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('fina3010_builder_positions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPositions(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
  };

  useEffect(() => {
    // Load saved positions first
    loadSavedPositions();
  }, []);

  // Auto-calculate VaR when positions change
  useEffect(() => {
    let isMounted = true;
    
    const calculateVaR = async () => {
      if (positions.length === 0) {
        if (isMounted) {
          setVarResult(null);
        }
        return;
      }

      try {
        const positionsForVaR = positions.map(p => ({
          ticker: p.ticker,
          quantity: p.quantity,
          price: p.price,
        }));

        const response = await fetch('/api/portfolio/var', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            positions: positionsForVaR,
            method: 'historical',
            confidence_level: 0.95,
            time_horizon: 1,
          }),
        });

        if (response.ok && isMounted) {
          const result: VaRResult = await response.json();
          console.log('VaR result:', result);
          if (result && result.var_amount !== undefined) {
            setVarResult(result);
          } else {
            console.warn('VaR result is invalid:', result);
            if (isMounted) {
              setVarResult(null);
            }
          }
        } else {
          const errorText = await response.text();
          console.error('VaR API error:', response.status, errorText);
          if (isMounted) {
            setVarResult(null);
          }
        }
      } catch (error: any) {
        console.error('VaR calculation error:', error);
        if (isMounted) {
          setVarResult(null);
        }
      }
    };

    // Debounce VaR calculation to avoid too many API calls
    const timeoutId = setTimeout(() => {
      calculateVaR();
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [positions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const loadSeededPositions = async () => {
      try {
        const seedRaw = localStorage.getItem('fina3010_builder_seed');
        if (!seedRaw) return;
        const parsed = JSON.parse(seedRaw);
        if (!Array.isArray(parsed) || parsed.length === 0) return;

        // Check if we already have positions stored (don't overwrite)
        const savedPositions = localStorage.getItem('fina3010_builder_positions');
        if (savedPositions) {
          try {
            const existing = JSON.parse(savedPositions);
            if (Array.isArray(existing) && existing.length > 0) {
              // Already have positions, don't overwrite with seed
              localStorage.removeItem('fina3010_builder_seed');
              return;
            }
          } catch {
            // Ignore parse errors
          }
        }

        setIsLoadingPrices(true);

        // Fetch current prices for all seeded tickers in parallel
        const tickers = parsed.map((t: any) => String(t).toUpperCase());
        const pricePromises = tickers.map(async (t: string) => {
          try {
            const response = await fetch('/api/company/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticker: t }),
            });
            if (response.ok) {
              const data = await response.json();
              const price = data.current_price || 0;
              return { ticker: t, price };
            }
          } catch (error) {
            console.warn(`Failed to fetch price for ${t}:`, error);
          }
          return { ticker: t, price: 0 };
        });

        const priceResults = await Promise.all(pricePromises);
        
        // Create positions with valid 5-10% allocations
        const seeded: Position[] = priceResults
          .filter((p) => p.price > 0) // Only include tickers with valid prices
          .map((p) => {
            // Calculate quantity to make it 7.5% of portfolio (middle of 5-10% range)
            const targetValue = portfolioValue * 0.075; // 7.5%
            const quantity = Math.floor(targetValue / p.price);
            const actualValue = quantity * p.price;
            const percentage = (actualValue / portfolioValue) * 100;

            return {
              ticker: p.ticker,
              quantity,
              price: p.price,
              percentage,
            };
          })
          .filter((pos) => pos.percentage >= 5 && pos.percentage <= 10); // Only valid positions

        if (seeded.length > 0) {
          setPositions(seeded);
          // Save to localStorage for persistence
          localStorage.setItem('fina3010_builder_positions', JSON.stringify(seeded));
        }

        localStorage.removeItem('fina3010_builder_seed');
      } catch (error) {
        console.error('Failed to load seeded positions:', error);
        localStorage.removeItem('fina3010_builder_seed');
      } finally {
        setIsLoadingPrices(false);
      }
    };

    loadSeededPositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addPosition = () => {
    if (!ticker || quantity <= 0 || price <= 0) return;

    const positionValue = quantity * price;
    const percentage = (positionValue / portfolioValue) * 100;

    if (percentage < 5 || percentage > 10) {
      alert(`Position must be between 5% and 10% of portfolio. Current: ${percentage.toFixed(2)}%`);
      return;
    }

    const newPosition: Position = {
      ticker: ticker.toUpperCase(),
      quantity,
      price,
      percentage,
    };

    const updated = [...positions, newPosition];
    setPositions(updated);
    localStorage.setItem('fina3010_builder_positions', JSON.stringify(updated));
    setTicker('');
    setQuantity(0);
    setPrice(0);
  };

  const removePosition = (index: number) => {
    const updated = positions.filter((_, i) => i !== index);
    setPositions(updated);
    localStorage.setItem('fina3010_builder_positions', JSON.stringify(updated));
    setOptimizedResult(null);
    setShowOptimized(false);
  };

  const optimizePortfolio = async () => {
    if (positions.length === 0) {
      alert('Please add at least one position before optimizing.');
      return;
    }
    // Course constraint feasibility: with 5–10% per position, feasible only when 10–20 assets.
    if (positions.length < 10 || positions.length > 20) {
      alert(
        `Portfolio optimization under the 5–10% position rule is only feasible with 10–20 assets.\n` +
          `You currently have ${positions.length}. Add/remove assets, then re-run optimization.`
      );
      return;
    }

    setIsOptimizing(true);
    try {
      const tickers = positions.map(p => p.ticker);
      const prices = positions.map(p => p.price);

      const response = await fetch('/api/portfolio/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: optimizationStrategy,
          tickers,
          prices,
          portfolioValue,
          riskFreeRate: 0.02,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to optimize portfolio');
      }

      const result: OptimizationResult = await response.json();
      setOptimizedResult(result);
      setShowOptimized(true);
    } catch (error: any) {
      console.error('Optimization error:', error);
      alert(`Failed to optimize portfolio: ${error.message}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const applyOptimizedAllocations = () => {
    if (!optimizedResult) return;

    // Recompute percentages from actual quantities to validate constraints.
    const updated: Position[] = optimizedResult.positions.map((pos) => {
      const value = pos.quantity * pos.price;
      const percentage = (value / portfolioValue) * 100;
      return {
        ticker: pos.ticker,
        quantity: pos.quantity,
        price: pos.price,
        percentage,
      };
    });

    const hasInvalid = updated.some((p) => p.percentage < 5 || p.percentage > 10);
    if (hasInvalid) {
      alert(
        `Optimized allocations violate the 5–10% position-size rule.\n` +
          `This can happen if you have fewer than 10 or more than 20 assets.\n` +
          `Adjust the number of assets and re-run optimization.`
      );
      return;
    }

    setPositions(updated);
    localStorage.setItem('fina3010_builder_positions', JSON.stringify(updated));
    setShowOptimized(false);
    setOptimizedResult(null);
  };


  const totalAllocated = positions.reduce((sum, p) => sum + (p.quantity * p.price), 0);
  const totalPercentage = (totalAllocated / portfolioValue) * 100;
  const remaining = portfolioValue - totalAllocated;
  const remainingPercentage = 100 - totalPercentage;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Portfolio Builder</h1>
          <p>Plan allocations with position size guardrails before trading on MarketWatch.</p>
        </div>
        <div className={styles.logo}>ARQAM</div>
      </header>

      <div className={styles.mainContent}>
        <div className={styles.builderSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Add Position</h2>
              <p className={styles.sectionSub}>Target 5-10% per position; pre-check size before adding.</p>
            </div>
          </div>
          <div className={styles.addForm}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Ticker</label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Quantity</label>
                <input
                  type="number"
                  value={quantity || ''}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  min="1"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Price per Share ($)</label>
                <input
                  type="number"
                  value={price || ''}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className={styles.inlineRow}>
              <div className={styles.positionSummary}>
                <div className={styles.positionLabel}>Position size</div>
                <div className={styles.positionValue}>
                  {quantity > 0 && price > 0 ? `$${(quantity * price).toLocaleString()}` : '—'}
                  <span className={styles.positionPct}>
                    {quantity > 0 && price > 0
                      ? ` (${((quantity * price / portfolioValue) * 100).toFixed(2)}%)`
                      : ''}
                  </span>
                </div>
                <div className={styles.positionNote}>Must be between 5% and 10% of $100,000</div>
              </div>
              <div className={styles.actionsRow}>
                <button
                  onClick={addPosition}
                  className={styles.addButton}
                  disabled={!ticker || quantity <= 0 || price <= 0}
                >
                  Add to Portfolio
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.summarySection}>
          <h2>Portfolio Summary</h2>
          <div className={styles.summaryCards}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Starting Value</div>
              <div className={styles.summaryValue}>${portfolioValue.toLocaleString()}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Allocated</div>
              <div className={styles.summaryValue}>${totalAllocated.toLocaleString()}</div>
              <div className={styles.summaryNote}>{totalPercentage.toFixed(2)}%</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Remaining</div>
              <div className={styles.summaryValue}>${remaining.toLocaleString()}</div>
              <div className={styles.summaryNote}>{remainingPercentage.toFixed(2)}%</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Positions</div>
              <div className={styles.summaryValue}>{positions.length}</div>
            </div>
          </div>

          {positions.length > 0 && (
            <>
              <div className={styles.optimizationSection}>
                <h3>Portfolio Optimization</h3>
                <div className={styles.optimizationControls}>
                  <div className={styles.strategySelector}>
                    <label>Strategy:</label>
                    <select
                      value={optimizationStrategy}
                      onChange={(e) => setOptimizationStrategy(e.target.value as OptimizationStrategy)}
                      className={styles.strategySelect}
                    >
                      <option value="max_sharpe">Max Sharpe Ratio (Analytical)</option>
                      <option value="monte_carlo_sharpe">Max Sharpe Ratio (Monte Carlo)</option>
                      <option value="min_volatility">Min Volatility</option>
                      <option value="equal_weight">Equal Weight</option>
                      <option value="risk_parity">Risk Parity</option>
                    </select>
                  </div>
                  <button
                    onClick={optimizePortfolio}
                    className={styles.optimizeButton}
                    disabled={isOptimizing}
                  >
                    {isOptimizing ? 'Optimizing...' : 'Optimize Portfolio'}
                  </button>
                </div>
                {(optimizedResult || varResult) && (
                  <div className={styles.optimizationResults}>
                    <h4>Portfolio Metrics</h4>
                    <div className={styles.optimizationMetrics}>
                      {optimizedResult && (
                        <>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Expected Return:</span>
                            <span className={styles.metricValue}>{(optimizedResult.expected_return * 100).toFixed(2)}%</span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Volatility:</span>
                            <span className={styles.metricValue}>{(optimizedResult.volatility * 100).toFixed(2)}%</span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Sharpe Ratio:</span>
                            <span className={styles.metricValue}>{optimizedResult.sharpe_ratio.toFixed(3)}</span>
                          </div>
                        </>
                      )}
                      {varResult && (
                        <>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>VaR (95%, 1-day):</span>
                            <span className={styles.metricValue}>
                              ${varResult.var_amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>VaR %:</span>
                            <span className={styles.metricValue}>{varResult.var_percentage.toFixed(2)}%</span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>CVaR:</span>
                            <span className={styles.metricValue}>
                              ${varResult.cvar_amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    {showOptimized && (
                      <button
                        onClick={applyOptimizedAllocations}
                        className={styles.applyButton}
                      >
                        Apply Optimized Allocations
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.positionsTable}>
                <h3>{showOptimized ? 'Optimized Positions' : 'Current Positions'}</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Value</th>
                      <th>% of Portfolio</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showOptimized && optimizedResult ? optimizedResult.positions : positions).map((pos, index) => {
                      const isOptimized = showOptimized && optimizedResult;
                      const actualPos = isOptimized 
                        ? { ...pos, percentage: pos.percentage }
                        : pos as Position;
                      
                      return (
                        <tr key={`${actualPos.ticker}-${index}`} className={isOptimized ? styles.optimizedRow : ''}>
                          <td><strong>{actualPos.ticker}</strong></td>
                          <td>{actualPos.quantity.toLocaleString()}</td>
                          <td>${actualPos.price.toFixed(2)}</td>
                          <td>${(actualPos.quantity * actualPos.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td>{actualPos.percentage.toFixed(2)}%</td>
                          <td>
                            {actualPos.percentage >= 5 && actualPos.percentage <= 10 ? (
                              <span className={styles.statusOk}>✓ Valid</span>
                            ) : (
                              <span className={styles.statusError}>✗ Invalid</span>
                            )}
                          </td>
                          <td>
                            {!isOptimized && (
                              <button
                                onClick={() => removePosition(index)}
                                className={styles.removeButton}
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {isLoadingPrices && (
            <div className={styles.emptyState}>
              <p>Loading prices for seeded positions...</p>
            </div>
          )}

          {!isLoadingPrices && positions.length === 0 && (
            <div className={styles.emptyState}>
              <p>Add positions to build your portfolio plan. Each position must be 5-10% of your $100,000 portfolio.</p>
            </div>
          )}

          <div className={styles.constraintsInfo}>
            <h3>Portfolio Constraints</h3>
            <ul>
              <li>Each position: 5-10% of portfolio ($5,000 - $10,000)</li>
              <li>Minimum price: $2 per share</li>
              <li>Minimum 20 trades required</li>
              <li>Maximum 200 trades allowed</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

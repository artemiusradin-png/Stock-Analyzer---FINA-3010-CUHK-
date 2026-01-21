'use client';

import { useState, useEffect } from 'react';
import styles from './Trading.module.css';
import TradeAssistant from './components/TradeAssistant';

interface Trade {
  id: string;
  date: string;
  ticker: string;
  orderType: 'market' | 'limit_buy' | 'limit_sell' | 'stop_loss';
  action: 'buy' | 'sell' | 'short_sell';
  quantity: number;
  price: number;
  commission: number;
  totalCost: number;
  notes?: string;
  thesis?: string;
  signalScore?: number;
  signalNotes?: string;
  plannedEntry?: number;
  plannedStop?: number;
  plannedTarget?: number;
  exitPrice?: number;
  exitDate?: string;
  outcomeNotes?: string;
  status?: 'open' | 'closed';
}

interface EquityPoint {
  date: string;
  equity: number;
  cash: number;
}

interface RemotePerformance {
  start_date: string;
  end_date: string;
  dates: string[];
  equitySeries: number[];
  benchmarkSeries: number[];
  metrics: {
    totalReturn: number;
    benchmarkReturn: number;
    alpha: number;
    trackingError: number;
    maxDrawdown: number;
    currentDrawdown: number;
  };
  benchmark: string;
}

function stddev(values: number[]) {
  if (!values.length) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function computeEquitySeries(trades: Trade[]): { series: EquityPoint[]; holdings: Record<string, { qty: number; costBasis: number; lastPrice: number; realized: number }>; } {
  const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const holdings: Record<string, { qty: number; costBasis: number; lastPrice: number; realized: number }> = {};
  let cash = 100000;
  const series: EquityPoint[] = [];

  const uniqueDates = Array.from(new Set(sorted.map(t => t.date))).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  uniqueDates.forEach(date => {
    const tradesForDate = sorted.filter(t => t.date === date);

    tradesForDate.forEach(t => {
      const commission = t.commission ?? 5;
      const key = t.ticker.toUpperCase();
      if (!holdings[key]) {
        holdings[key] = { qty: 0, costBasis: 0, lastPrice: t.price, realized: 0 };
      }
      const h = holdings[key];

      if (t.action === 'buy') {
        const newQty = h.qty + t.quantity;
        const totalCost = h.qty * h.costBasis + t.quantity * t.price;
        h.costBasis = newQty > 0 ? totalCost / newQty : 0;
        h.qty = newQty;
        cash -= t.quantity * t.price + commission;
      } else if (t.action === 'sell') {
        const sellQty = Math.min(h.qty, t.quantity);
        h.qty -= sellQty;
        h.realized += (t.price - h.costBasis) * sellQty - commission;
        cash += t.price * t.quantity - commission;
      } else if (t.action === 'short_sell') {
        // Treat shorts as negative quantity for simple tracking
        h.qty -= t.quantity;
        cash += t.price * t.quantity - commission;
      }

      h.lastPrice = t.price;
      if (h.qty === 0) {
        h.costBasis = 0;
      }
    });

    const equity = cash + Object.values(holdings).reduce((sum, h) => sum + h.qty * h.lastPrice, 0);
    series.push({ date, equity, cash });
  });

  return { series, holdings };
}

function computePerformanceStats(trades: Trade[]) {
  const { series, holdings } = computeEquitySeries(trades);
  const startValue = 100000;
  const endValue = series.length ? series[series.length - 1].equity : startValue;

  let peak = startValue;
  let maxDrawdown = 0;
  let currentDrawdown = 0;

  const dailyReturns: number[] = [];

  series.forEach((point, idx) => {
    if (point.equity > peak) {
      peak = point.equity;
    }
    const dd = (point.equity - peak) / peak;
    maxDrawdown = Math.min(maxDrawdown, dd);
    currentDrawdown = dd;

    if (idx > 0) {
      const prev = series[idx - 1].equity;
      dailyReturns.push((point.equity - prev) / prev);
    }
  });

  const bestDay = dailyReturns.length ? Math.max(...dailyReturns) : 0;
  const worstDay = dailyReturns.length ? Math.min(...dailyReturns) : 0;

  const benchmarkReturns = new Array(dailyReturns.length).fill(0); // Placeholder until benchmark data wired
  const activeReturns = dailyReturns.map((r, idx) => r - (benchmarkReturns[idx] || 0));

  const trackingError = stddev(activeReturns);
  const alphaVsSpy = (endValue - startValue) / startValue - benchmarkReturns.reduce((s, r) => s + r, 0);

  const concentrationWarnings: string[] = [];
  const holdingsValues = Object.entries(holdings).map(([ticker, h]) => ({
    ticker,
    value: h.qty * h.lastPrice,
  })).filter(h => h.value !== 0);
  const totalValue = holdingsValues.reduce((s, h) => s + h.value, 0);
  holdingsValues.sort((a, b) => b.value - a.value);
  const topHoldings = holdingsValues.slice(0, 3);

  topHoldings.forEach(h => {
    const weight = totalValue ? h.value / totalValue : 0;
    if (weight > 0.12) {
      concentrationWarnings.push(`${h.ticker} is ${Math.round(weight * 100)}% of open positions`);
    }
  });

  const realizedPnL = Object.entries(holdings).map(([ticker, h]) => ({
    ticker,
    realized: h.realized,
  })).sort((a, b) => b.realized - a.realized);

  return {
    startValue,
    endValue,
    totalReturn: (endValue - startValue) / startValue,
    bestDay,
    worstDay,
    maxDrawdown,
    currentDrawdown,
    trackingError,
    alphaVsSpy,
    topHoldings,
    concentrationWarnings,
    equitySeries: series,
    activeReturns,
    realizedPnL,
  };
}

export default function TradingPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<'journal' | 'portfolio' | 'performance'>('journal');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [remotePerformance, setRemotePerformance] = useState<RemotePerformance | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfError, setPerfError] = useState<string | null>(null);

  // Load trades from localStorage
  useEffect(() => {
    const savedTrades = localStorage.getItem('fina3010_trades');
    if (savedTrades) {
      setTrades(JSON.parse(savedTrades));
    }
  }, []);

  // Fetch benchmarked performance when trades change
  useEffect(() => {
    const fetchPerformance = async () => {
      if (!trades.length) {
        setRemotePerformance(null);
        return;
      }
      setPerfLoading(true);
      setPerfError(null);
      try {
        const payload = {
          trades: trades.map(t => ({
            date: t.date,
            ticker: t.ticker,
            action: t.action,
            quantity: t.quantity,
            price: t.price,
            commission: t.commission ?? 5,
          })),
        };
        const res = await fetch('/api/performance/equity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error(`Performance fetch failed (${res.status})`);
        }
        const data = await res.json();
        setRemotePerformance(data);
      } catch (err: any) {
        setPerfError(err.message || 'Unable to load benchmark performance');
      } finally {
        setPerfLoading(false);
      }
    };

    fetchPerformance();
  }, [trades]);

  // Save trades to localStorage
  const saveTrades = (newTrades: Trade[]) => {
    setTrades(newTrades);
    localStorage.setItem('fina3010_trades', JSON.stringify(newTrades));
  };

  const addTrade = (trade: Omit<Trade, 'id'>) => {
    const newTrade: Trade = {
      ...trade,
      id: Date.now().toString(),
      commission: 5, // $5 per trade as per rules
      totalCost: trade.quantity * trade.price + 5,
      status: trade.status || 'open',
    };
    saveTrades([...trades, newTrade]);
    setShowAddForm(false);
  };

  const exportCsv = () => {
    if (!trades.length) return;
    const headers = [
      'date',
      'ticker',
      'action',
      'orderType',
      'quantity',
      'price',
      'commission',
      'plannedEntry',
      'plannedStop',
      'plannedTarget',
      'exitPrice',
      'exitDate',
      'signalScore',
      'signalNotes',
      'thesis',
      'outcomeNotes',
      'notes',
      'status',
    ];

    const rows = trades.map(t => headers.map(h => {
      const val = (t as any)[h];
      return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val ?? '';
    }).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trading-journal.csv';
    a.click();
  };

  const deleteTrade = (id: string) => {
    saveTrades(trades.filter(t => t.id !== id));
  };

  const performance = computePerformanceStats(trades);
  const portfolioValue = performance.endValue;
  const totalTrades = trades.length;
  const totalCommissions = trades.reduce((sum, t) => sum + (t.commission || 5), 0);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>My Trading Portfolio</h1>
          <p>Track your MarketWatch simulation trades and portfolio performance</p>
        </div>
        <div className={styles.logo}>ARQAM</div>
      </header>

      <nav className={styles.navTabs}>
        <button
          className={activeTab === 'journal' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('journal')}
        >
          Trade Journal
        </button>
        <button
          className={activeTab === 'portfolio' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('portfolio')}
        >
          Portfolio
        </button>
        <button
          className={activeTab === 'performance' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('performance')}
        >
          Performance
        </button>
      </nav>

      <div className={styles.mainContent}>
        {activeTab === 'journal' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Trade Journal</h2>
              <div className={styles.buttonGroup}>
                <button 
                  className={styles.assistantButton} 
                  onClick={() => setShowAssistant(true)}
                  title="Use AI to help fill in trades"
                >
                  🤖 AI Assistant
                </button>
                <button className={styles.addButton} onClick={() => setShowAddForm(!showAddForm)}>
                  {showAddForm ? 'Cancel' : '+ Add Trade'}
                </button>
                <button className={styles.secondaryButton} onClick={exportCsv} disabled={!trades.length}>
                  Export CSV
                </button>
              </div>
            </div>

            {showAddForm && (
              <AddTradeForm onSubmit={addTrade} onCancel={() => setShowAddForm(false)} />
            )}

            {trades.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No trades logged yet. Click "Add Trade" to log your first MarketWatch trade.</p>
              </div>
            ) : (
              <div className={styles.tradesTable}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ticker</th>
                      <th>Order Type</th>
                      <th>Action</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Plan (Entry / Stop / Target)</th>
                      <th>Thesis & Signal</th>
                      <th>Outcome</th>
                      <th>Commission</th>
                      <th>Total Cost</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.id}>
                        <td>{new Date(trade.date).toLocaleDateString()}</td>
                        <td><strong>{trade.ticker}</strong></td>
                        <td>{trade.orderType.replace('_', ' ')}</td>
                        <td>
                          <span className={`${styles.badge} ${styles[trade.action]}`}>
                            {trade.action.replace('_', ' ')}
                          </span>
                        </td>
                        <td>{trade.quantity}</td>
                        <td>${trade.price.toFixed(2)}</td>
                        <td>
                          <div className={styles.planBlock}>
                            <div>Entry: ${ (trade.plannedEntry ?? trade.price).toFixed(2) }</div>
                            <div>Stop: {trade.plannedStop ? `$${trade.plannedStop.toFixed(2)}` : '—'}</div>
                            <div>Target: {trade.plannedTarget ? `$${trade.plannedTarget.toFixed(2)}` : '—'}</div>
                          </div>
                        </td>
                        <td>
                          <div className={styles.thesisText}>{trade.thesis || '—'}</div>
                          <div className={styles.muted}>
                            {trade.signalScore !== undefined ? `Score: ${trade.signalScore}` : 'Score: —'}
                            {trade.signalNotes ? ` · ${trade.signalNotes}` : ''}
                          </div>
                          {trade.notes && <div className={styles.muted}>Note: {trade.notes}</div>}
                        </td>
                        <td>
                          <div className={styles.statusPill}>
                            {trade.status === 'closed' || trade.exitPrice ? 'Closed' : 'Open'}
                          </div>
                          {trade.exitPrice && (
                            <div className={styles.muted}>
                              Exit: ${trade.exitPrice.toFixed(2)} {trade.exitDate ? `on ${new Date(trade.exitDate).toLocaleDateString()}` : ''}
                            </div>
                          )}
                          {trade.outcomeNotes && <div className={styles.muted}>{trade.outcomeNotes}</div>}
                        </td>
                        <td>${(trade.commission ?? 5).toFixed(2)}</td>
                        <td>${(trade.totalCost ?? (trade.quantity * trade.price + (trade.commission ?? 5))).toFixed(2)}</td>
                        <td>
                          <button
                            className={styles.deleteButton}
                            onClick={() => deleteTrade(trade.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className={styles.section}>
            <h2>Portfolio Overview</h2>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Current Value</div>
                <div className={styles.statValue}>${portfolioValue.toLocaleString()}</div>
                <div className={styles.statChange}>
                  {portfolioValue - 100000 >= 0 ? '+' : ''}
                  ${(portfolioValue - 100000).toLocaleString()}
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Trades</div>
                <div className={styles.statValue}>{totalTrades}</div>
                <div className={styles.statNote}>
                  {totalTrades < 20 ? `Need ${20 - totalTrades} more (min 20)` : 'Requirement met'}
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Commissions</div>
                <div className={styles.statValue}>${totalCommissions.toFixed(2)}</div>
                <div className={styles.statNote}>$5 per trade</div>
              </div>
            </div>
            <p style={{ marginTop: '2rem', color: '#6b7280', fontSize: '0.875rem' }}>
              <strong>Note:</strong> This is a basic calculator. For accurate portfolio tracking, 
              enter all your MarketWatch trades here as you execute them.
            </p>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className={styles.section}>
            <h2>Performance Analytics</h2>
            <PerformanceTab
              trades={trades}
              performance={performance}
              remotePerformance={remotePerformance}
              loading={perfLoading}
              error={perfError}
            />
          </div>
        )}
      </div>

      {showAssistant && (
        <TradeAssistant
          onAddTrade={(trade) => {
            addTrade(trade);
            // Keep assistant open for multiple trades
          }}
          onClose={() => setShowAssistant(false)}
        />
      )}
    </div>
  );
}

function AddTradeForm({ onSubmit, onCancel }: { onSubmit: (trade: Omit<Trade, 'id'>) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    ticker: '',
    orderType: 'market' as Trade['orderType'],
    action: 'buy' as Trade['action'],
    quantity: 0,
    price: 0,
    notes: '',
    thesis: '',
    signalScore: '',
    signalNotes: '',
    plannedEntry: '',
    plannedStop: '',
    plannedTarget: '',
    exitPrice: '',
    exitDate: '',
    outcomeNotes: '',
    status: 'open' as Trade['status'],
  });
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const fetchScore = async () => {
    if (!formData.ticker) return;
    setScoreLoading(true);
    setScoreError(null);
    try {
      const res = await fetch('/api/scoring/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: formData.ticker }),
      });
      if (!res.ok) {
        throw new Error(`Score request failed (${res.status})`);
      }
      const data = await res.json();
      setFormData((prev) => ({
        ...prev,
        signalScore: data.score?.overall_score ?? data.score ?? '',
        signalNotes: `Components: ${JSON.stringify(data.score?.components || {})}`,
      }));
    } catch (err: any) {
      setScoreError(err.message || 'Failed to fetch score');
    } finally {
      setScoreLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      plannedEntry: formData.plannedEntry ? Number(formData.plannedEntry) : undefined,
      plannedStop: formData.plannedStop ? Number(formData.plannedStop) : undefined,
      plannedTarget: formData.plannedTarget ? Number(formData.plannedTarget) : undefined,
      exitPrice: formData.exitPrice ? Number(formData.exitPrice) : undefined,
      signalScore: formData.signalScore ? Number(formData.signalScore) : undefined,
    });
    setFormData({
      date: new Date().toISOString().split('T')[0],
      ticker: '',
      orderType: 'market',
      action: 'buy',
      quantity: 0,
      price: 0,
      notes: '',
      thesis: '',
      signalScore: '',
      signalNotes: '',
      plannedEntry: '',
      plannedStop: '',
      plannedTarget: '',
      exitPrice: '',
      exitDate: '',
      outcomeNotes: '',
      status: 'open',
    });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.addForm}>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label>Ticker</label>
          <input
            type="text"
            value={formData.ticker}
            onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
            placeholder="AAPL"
            required
          />
          <div className={styles.inlineActions}>
            <button type="button" className={styles.ghostButton} onClick={fetchScore} disabled={!formData.ticker || scoreLoading}>
              {scoreLoading ? 'Loading score...' : 'Autofill Signal Score'}
            </button>
            {scoreError && <span className={styles.errorText}>{scoreError}</span>}
          </div>
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>Order Type</label>
          <select
            value={formData.orderType}
            onChange={(e) => setFormData({ ...formData, orderType: e.target.value as Trade['orderType'] })}
            required
          >
            <option value="market">Market Order</option>
            <option value="limit_buy">Limit Buy Order</option>
            <option value="limit_sell">Limit Sell Order</option>
            <option value="stop_loss">Stop-Loss Order</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label>Action</label>
          <select
            value={formData.action}
            onChange={(e) => setFormData({ ...formData, action: e.target.value as Trade['action'] })}
            required
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="short_sell">Short Sale</option>
          </select>
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>Quantity</label>
          <input
            type="number"
            value={formData.quantity || ''}
            onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
            min="1"
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label>Price ($)</label>
          <input
            type="number"
            value={formData.price || ''}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
            min="0"
            step="0.01"
            required
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>Planned Entry ($)</label>
          <input
            type="number"
            value={formData.plannedEntry}
            onChange={(e) => setFormData({ ...formData, plannedEntry: e.target.value })}
            placeholder={formData.price ? formData.price.toString() : 'Entry price'}
            min="0"
            step="0.01"
          />
        </div>
        <div className={styles.formGroup}>
          <label>Planned Stop ($)</label>
          <input
            type="number"
            value={formData.plannedStop}
            onChange={(e) => setFormData({ ...formData, plannedStop: e.target.value })}
            placeholder="Risk guardrail"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>Planned Target ($)</label>
          <input
            type="number"
            value={formData.plannedTarget}
            onChange={(e) => setFormData({ ...formData, plannedTarget: e.target.value })}
            placeholder="Take-profit idea"
            min="0"
            step="0.01"
          />
        </div>
        <div className={styles.formGroup}>
          <label>Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as Trade['status'] })}
          >
            <option value="open">Open / In-progress</option>
            <option value="closed">Closed / Exited</option>
          </select>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label>Thesis</label>
        <textarea
          value={formData.thesis}
          onChange={(e) => setFormData({ ...formData, thesis: e.target.value })}
          placeholder="1-2 sentence trade thesis (setup, catalyst, risk)"
          rows={2}
          required
        />
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>Signal Score (0-100)</label>
          <input
            type="number"
            value={formData.signalScore}
            onChange={(e) => setFormData({ ...formData, signalScore: e.target.value })}
            min="0"
            max="100"
            step="1"
            placeholder="e.g., 72"
          />
        </div>
        <div className={styles.formGroup}>
          <label>Signal Snapshot</label>
          <textarea
            value={formData.signalNotes}
            onChange={(e) => setFormData({ ...formData, signalNotes: e.target.value })}
            placeholder="DCF upside, momentum, sentiment, risk notes"
            rows={2}
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>Exit Price ($)</label>
          <input
            type="number"
            value={formData.exitPrice}
            onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
            min="0"
            step="0.01"
            placeholder="If closed"
          />
        </div>
        <div className={styles.formGroup}>
          <label>Exit Date</label>
          <input
            type="date"
            value={formData.exitDate}
            onChange={(e) => setFormData({ ...formData, exitDate: e.target.value })}
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label>Outcome Notes</label>
        <textarea
          value={formData.outcomeNotes}
          onChange={(e) => setFormData({ ...formData, outcomeNotes: e.target.value })}
          placeholder="What happened vs plan? Lessons?"
          rows={2}
        />
      </div>

      <div className={styles.formGroup}>
        <label>Notes (optional)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Execution notes, routing, partial fills, etc."
          rows={2}
        />
      </div>

      <div className={styles.formActions}>
        <button type="button" onClick={onCancel} className={styles.cancelButton}>
          Cancel
        </button>
        <button type="submit" className={styles.submitButton}>
          Add Trade
        </button>
      </div>
    </form>
  );
}

function PerformanceTab({
  trades,
  performance,
  remotePerformance,
  loading,
  error,
}: {
  trades: Trade[];
  performance?: ReturnType<typeof computePerformanceStats>;
  remotePerformance?: RemotePerformance | null;
  loading?: boolean;
  error?: string | null;
}) {
  const stats = performance || computePerformanceStats(trades);
  const hasTrades = trades.length > 0;

  const equitySeries = remotePerformance ? remotePerformance.equitySeries : stats.equitySeries.map(p => p.equity);
  const dates = remotePerformance ? remotePerformance.dates : stats.equitySeries.map(p => p.date);
  const benchmarkSeries = remotePerformance ? remotePerformance.benchmarkSeries : equitySeries.map(() => stats.startValue);

  const startValue = equitySeries.length ? equitySeries[0] : stats.startValue;
  const endValue = equitySeries.length ? equitySeries[equitySeries.length - 1] : stats.endValue;

  const normalizedEquity = equitySeries.map((val, idx) => ({
    date: dates[idx] ?? `t${idx}`,
    value: startValue ? (val - startValue) / startValue : 0,
  }));
  const maxAbs = normalizedEquity.length ? Math.max(...normalizedEquity.map(p => Math.abs(p.value))) || 1 : 1;

  const metrics = remotePerformance?.metrics;
  const totalReturn = metrics ? metrics.totalReturn : stats.totalReturn;
  const benchmarkReturn = metrics ? metrics.benchmarkReturn : 0;
  const alpha = metrics ? metrics.alpha : stats.totalReturn;
  const trackingError = metrics ? metrics.trackingError : stats.trackingError;
  const maxDrawdown = metrics ? metrics.maxDrawdown : stats.maxDrawdown;
  const currentDrawdown = metrics ? metrics.currentDrawdown : stats.currentDrawdown;

  return (
    <div>
      {!hasTrades && (
        <div className={styles.emptyState}>
          <p>Log trades to unlock performance analytics and benchmark views.</p>
        </div>
      )}

      {loading && hasTrades && (
        <div className={styles.muted} style={{ marginBottom: '1rem' }}>
          Loading benchmarked performance...
        </div>
      )}

      {error && (
        <div className={styles.warningBlock} style={{ marginBottom: '1rem' }}>
          ⚠️ {error}
        </div>
      )}

      {hasTrades && (
        <>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Total Return</div>
                  <div className={styles.statValue}>{formatPct(totalReturn)}</div>
                  <div className={styles.statNote}>Start ${startValue.toLocaleString()} → ${endValue.toLocaleString()}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Max Drawdown</div>
                  <div className={styles.statValue}>{formatPct(maxDrawdown)}</div>
                  <div className={styles.statNote}>Current: {formatPct(currentDrawdown)}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Alpha vs SPY (placeholder)</div>
                  <div className={styles.statValue}>{formatPct(alpha)}</div>
                  <div className={styles.statNote}>
                    Benchmark {remotePerformance?.benchmark || 'SPY'} return: {formatPct(benchmarkReturn)}
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Tracking Error</div>
                  <div className={styles.statValue}>{formatPct(trackingError)}</div>
                  <div className={styles.statNote}>{remotePerformance ? 'Benchmarked' : 'Local approximation'}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Best / Worst Day</div>
              <div className={styles.statValue}>{formatPct(stats.bestDay)} / {formatPct(stats.worstDay)}</div>
              <div className={styles.statNote}>Using trade-day marks</div>
            </div>
          </div>

          <div className={styles.equityPanel}>
            <div className={styles.sectionHeader}>
              <h3>Equity Curve vs SPY</h3>
              <div className={styles.muted}>SPY assumed flat until benchmark hook-up</div>
            </div>
            <div className={styles.sparkline}>
              {normalizedEquity.map((point, idx) => (
                <div
                  key={`${point.date}-${idx}`}
                  className={styles.sparkBar}
                  title={`${new Date(point.date).toLocaleDateString()}: ${formatPct(point.value)}`}
                  style={{
                    height: `${Math.max(10, Math.abs(point.value) / maxAbs * 80)}px`,
                    background: point.value >= 0 ? '#10b981' : '#ef4444',
                  }}
                />
              ))}
            </div>
            <div className={styles.sparkAxis}>
              <span>Start</span>
              <span>Latest</span>
            </div>
          </div>

          <div className={styles.gridTwo}>
            <div className={styles.smallCard}>
              <div className={styles.sectionHeader}>
                <h3>Concentration & Open Positions</h3>
              </div>
              {stats.topHoldings.length === 0 ? (
                <div className={styles.muted}>No open positions yet.</div>
              ) : (
                <div className={styles.smallTable}>
                  {stats.topHoldings.map(h => (
                    <div key={h.ticker} className={styles.smallRow}>
                      <div className={styles.smallLabel}>{h.ticker}</div>
                      <div className={styles.smallValue}>${h.value.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
              {stats.concentrationWarnings.length > 0 && (
                <div className={styles.warningBlock}>
                  {stats.concentrationWarnings.map((w, idx) => <div key={idx}>⚠️ {w}</div>)}
                </div>
              )}
            </div>

            <div className={styles.smallCard}>
              <div className={styles.sectionHeader}>
                <h3>Realized P&L Contributions</h3>
              </div>
              {stats.realizedPnL.length === 0 ? (
                <div className={styles.muted}>No realized P&L yet.</div>
              ) : (
                <div className={styles.smallTable}>
                  {stats.realizedPnL.map(r => (
                    <div key={r.ticker} className={styles.smallRow}>
                      <div className={styles.smallLabel}>{r.ticker}</div>
                      <div className={styles.smallValue} style={{ color: r.realized >= 0 ? '#10b981' : '#ef4444' }}>
                        ${r.realized.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.muted}>Use this list in weekly reflection and attribution.</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

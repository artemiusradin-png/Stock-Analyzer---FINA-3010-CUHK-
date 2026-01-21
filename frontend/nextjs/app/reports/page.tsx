'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './Reports.module.css';

interface Trade {
  id: string;
  date: string;
  ticker: string;
  orderType: string;
  action: string;
  quantity: number;
  price: number;
  totalCost: number;
  thesis?: string;
  signalScore?: number;
  signalNotes?: string;
  plannedEntry?: number;
  plannedStop?: number;
  plannedTarget?: number;
  exitPrice?: number;
  exitDate?: string;
  outcomeNotes?: string;
  status?: string;
}

export default function ReportsPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [reportType, setReportType] = useState<'weekly' | 'final'>('weekly');
  const [perf, setPerf] = useState<any | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfError, setPerfError] = useState<string | null>(null);

  useEffect(() => {
    const savedTrades = localStorage.getItem('fina3010_trades');
    if (savedTrades) {
      setTrades(JSON.parse(savedTrades));
    }
  }, []);

  useEffect(() => {
    const fetchPerf = async () => {
      if (!trades.length) {
        setPerf(null);
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
            commission: t.totalCost ? (t.totalCost - t.quantity * t.price) : 5,
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
        setPerf(data);
      } catch (err: any) {
        setPerfError(err.message || 'Unable to load benchmark performance');
      } finally {
        setPerfLoading(false);
      }
    };

    fetchPerf();
  }, [trades]);

  const calculateMetrics = () => {
    const totalTrades = trades.length;
    const totalCommissions = trades.reduce((sum, t) => sum + 5, 0);
    
    const portfolioValue = trades.reduce((sum, trade) => {
      if (trade.action === 'buy') {
        return sum - trade.totalCost;
      } else if (trade.action === 'sell' || trade.action === 'short_sell') {
        return sum + (trade.quantity * trade.price - 5);
      }
      return sum;
    }, 100000);

    const startDate = trades.length > 0 ? new Date(trades[0].date) : new Date('2026-01-01');
    const endDate = trades.length > 0 ? new Date(trades[trades.length - 1].date) : new Date();

    return {
      totalTrades,
      totalCommissions,
      portfolioValue,
      startDate: startDate.toLocaleDateString(),
      endDate: endDate.toLocaleDateString(),
      startingValue: 100000,
      gain: portfolioValue - 100000,
      gainPercent: ((portfolioValue - 100000) / 100000 * 100).toFixed(2),
    };
  };

  const metrics = calculateMetrics();

  const getWeekRange = (weekNumber: number) => {
    const weekStart = new Date('2026-01-01');
    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return { weekStart, weekEnd };
  };

  const getWeekTrades = (weekNumber: number) => {
    const { weekStart, weekEnd } = getWeekRange(weekNumber);

    return trades.filter(trade => {
      const tradeDate = new Date(trade.date);
      return tradeDate >= weekStart && tradeDate < weekEnd;
    });
  };

  const buildWeekMarkdown = (weekNumber: number) => {
    const { weekStart, weekEnd } = getWeekRange(weekNumber);
    const weekTrades = getWeekTrades(weekNumber);
    const weekPnl = weekTrades.reduce((sum, t) => {
      const sign = t.action === 'buy' ? -1 : 1;
      return sum + sign * (t.quantity * t.price);
    }, 0);

    const lines = [
      `# Week ${weekNumber} Trading One-Pager`,
      `**Period:** ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`,
      `**Trades:** ${weekTrades.length}`,
      `**Est. Cash Flow Impact:** ${weekPnl >= 0 ? '+' : ''}${weekPnl.toFixed(2)}`,
      '',
      '## Trade Log',
      weekTrades.length === 0
        ? '_No trades this week._'
        : weekTrades.map(t => {
            const plan = [
              t.plannedEntry ? `entry ${t.plannedEntry}` : null,
              t.plannedStop ? `stop ${t.plannedStop}` : null,
              t.plannedTarget ? `target ${t.plannedTarget}` : null,
            ].filter(Boolean).join(' | ');
            const signal = t.signalScore !== undefined ? `score ${t.signalScore}` : 'score n/a';
            return `- ${t.date}: ${t.action.toUpperCase()} ${t.quantity} ${t.ticker} @ $${t.price} (${signal}) ${plan ? `| ${plan}` : ''}${t.thesis ? ` — ${t.thesis}` : ''}`;
          }).join('\n'),
      '',
      '## Outcomes & Notes',
      weekTrades.length === 0
        ? '_Nothing to review._'
        : weekTrades.map(t => {
            const outcome = t.exitPrice ? `Exit $${t.exitPrice}${t.exitDate ? ` on ${t.exitDate}` : ''}` : 'Open';
            return `- ${t.ticker}: ${outcome}${t.outcomeNotes ? ` | ${t.outcomeNotes}` : ''}`;
          }).join('\n'),
      '',
      '_Benchmark and attribution: plug in SPY weekly return once available._',
    ];

    return lines.join('\n');
  };

  const exportWeekMarkdown = (weekNumber: number) => {
    const content = buildWeekMarkdown(weekNumber);
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `week-${weekNumber}-one-pager.md`;
    a.click();
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Reports & Analytics</h1>
          <p>Generate reports for presentations and final reflection</p>
        </div>
        <div className={styles.logo}>ARQAM</div>
      </header>

      <div className={styles.mainContent}>
        <div className={styles.tabs}>
          <button
            className={reportType === 'weekly' ? styles.tabActive : styles.tab}
            onClick={() => setReportType('weekly')}
          >
            Weekly Summary
          </button>
          <button
            className={reportType === 'final' ? styles.tabActive : styles.tab}
            onClick={() => setReportType('final')}
          >
            Final Report
          </button>
        </div>

        {reportType === 'weekly' && (
          <div className={styles.section}>
            <h2>Weekly Trading Summary</h2>
            <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
              Use this summary for your weekly class presentations (5 minutes each).
            </p>

            <div className={styles.weekSelector}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(week => {
                const weekTrades = getWeekTrades(week);
                return (
                  <div key={week} className={styles.weekCard}>
                    <h3>Week {week}</h3>
                    <div className={styles.weekStats}>
                      <div>Trades: {weekTrades.length}</div>
                      <div>{new Date(2026, 0, 1 + (week - 1) * 7).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    </div>
                    {weekTrades.length > 0 && (
                      <div className={styles.weekActions}>
                        <button className={styles.viewButton} onClick={() => {
                          alert(`Week ${week} trades:\n${weekTrades.map(t => `${t.date}: ${t.action} ${t.quantity} ${t.ticker} @ $${t.price}`).join('\n')}`);
                        }}>
                          View Details
                        </button>
                        <button
                          className={styles.exportButtonAlt}
                          onClick={() => exportWeekMarkdown(week)}
                        >
                          Download One-Pager
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className={styles.presentationTips}>
              <h3>Presentation Tips</h3>
              <ul>
                <li>Select 3-5 key trades from the week</li>
                <li>Explain your rationale for each trade</li>
                <li>Show order types used (market, limit, stop-loss)</li>
                <li>Discuss portfolio diversification</li>
                <li>Mention any challenges or lessons learned</li>
              </ul>
            </div>
          </div>
        )}

        {reportType === 'final' && (
          <div className={styles.section}>
            <h2>Final Reflection Report Helper</h2>
            <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
              Use this information for your final reflection report (due March 29, 2026).
            </p>

            <div className={styles.summaryCard}>
              <h3>Portfolio Summary</h3>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>
                  <label>Start Date</label>
                  <span className={styles.summaryValue}>{metrics.startDate}</span>
                </div>
                <div className={styles.summaryItem}>
                  <label>End Date</label>
                  <span className={styles.summaryValue}>{metrics.endDate}</span>
                </div>
                <div className={styles.summaryItem}>
                  <label>Starting Value</label>
                  <span className={styles.summaryValue}>${metrics.startingValue.toLocaleString()}</span>
                </div>
                <div className={styles.summaryItem}>
                  <label>Ending Value</label>
                  <span className={styles.summaryValue}>${metrics.portfolioValue.toLocaleString()}</span>
                </div>
                <div className={styles.summaryItem}>
                  <label>Total Gain/Loss</label>
                  <span className={styles.summaryValue} style={{ color: metrics.gain >= 0 ? '#10b981' : '#ef4444' }}>
                    {metrics.gain >= 0 ? '+' : ''}${metrics.gain.toLocaleString()} ({metrics.gainPercent}%)
                  </span>
                </div>
                <div className={styles.summaryItem}>
                  <label>Number of Trades</label>
                  <span className={styles.summaryValue}>{metrics.totalTrades}</span>
                </div>
                <div className={styles.summaryItem}>
                  <label>Total Commissions</label>
                  <span className={styles.summaryValue}>${metrics.totalCommissions.toFixed(2)}</span>
                </div>
                {perf && (
                  <>
                    <div className={styles.summaryItem}>
                      <label>Total Return</label>
                      <span className={styles.summaryValue} style={{ color: (perf.metrics?.totalReturn ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>
                        {(perf.metrics?.totalReturn ?? 0 * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className={styles.summaryItem}>
                      <label>Benchmark ({perf.benchmark || 'SPY'})</label>
                      <span className={styles.summaryValue}>{((perf.metrics?.benchmarkReturn ?? 0) * 100).toFixed(2)}%</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <label>Alpha</label>
                      <span className={styles.summaryValue} style={{ color: (perf.metrics?.alpha ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>
                        {((perf.metrics?.alpha ?? 0) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </>
                )}
              </div>
              {perfLoading && <div className={styles.summaryNote}>Loading benchmark performance…</div>}
              {perfError && <div className={styles.summaryNote} style={{ color: '#dc2626' }}>⚠️ {perfError}</div>}
            </div>

            <div className={styles.reportGuide}>
              <h3>Reflection Report Structure</h3>
              
              <div className={styles.pageCard}>
                <h4>Page 1: Summary</h4>
                <p>Include the portfolio summary above. Capture a screenshot from MarketWatch platform.</p>
              </div>

              <div className={styles.pageCard}>
                <h4>Page 2: Reflection Content (4-5 paragraphs)</h4>
                <div className={styles.reflectionTopics}>
                  <strong>Consider discussing:</strong>
                  <ul>
                    <li><strong>Depth of insights:</strong> What did you learn about trading and markets?</li>
                    <li><strong>Application of principles:</strong> How did you apply diversification, risk management?</li>
                    <li><strong>Critical analysis:</strong> What went well? What would you do differently?</li>
                    <li><strong>Personal growth:</strong> How did this experience change your understanding?</li>
                    <li><strong>Future application:</strong> How will you use these skills going forward?</li>
                  </ul>
                </div>
              </div>

              <div className={styles.pageCard}>
                <h4>Page 3: Screenshot</h4>
                <p>Attach the captured screen of your trading summary from MarketWatch platform.</p>
              </div>
            </div>

            <div className={styles.formattingNote}>
              <strong>Formatting Requirements:</strong>
              <ul>
                <li>Font size: 12</li>
                <li>Line spacing: 1.5</li>
                <li>Length: Limited to one page for reflection content</li>
                <li>Submission: Blackboard, March 29, 2026 (Sunday), 11:59 pm</li>
              </ul>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.printButton} onClick={() => window.print()}>
            Print / Save as PDF
          </button>
          <button className={styles.exportButton} onClick={() => {
            const data = {
              summary: metrics,
              trades: trades,
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'fina3010-trading-data.json';
            a.click();
          }}>
            Export Data (JSON)
          </button>
        </div>
      </div>
    </div>
  );
}

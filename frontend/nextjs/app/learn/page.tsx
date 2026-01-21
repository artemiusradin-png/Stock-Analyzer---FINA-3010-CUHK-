'use client';

import Link from 'next/link';
import styles from './Learn.module.css';

export default function LearnPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Learning Center</h1>
          <p>Essential trading concepts for FINA3010</p>
        </div>
        <div className={styles.logo}>ARQAM</div>
      </header>

      <div className={styles.mainContent}>
        <section className={styles.section}>
          <h2>📋 Order Types</h2>
          
          <div className={styles.card}>
            <h3>Market Order</h3>
            <p>Buy or sell immediately at the current market price.</p>
            <div className={styles.details}>
              <strong>When to use:</strong> When you want immediate execution and price is less important than speed.
              <br />
              <strong>Risk:</strong> You may get a different price than expected, especially in volatile markets.
            </div>
          </div>

          <div className={styles.card}>
            <h3>Limit Buy Order</h3>
            <p>Buy only if the price reaches or falls below your specified limit price.</p>
            <div className={styles.details}>
              <strong>When to use:</strong> When you want to buy at a specific maximum price or better.
              <br />
              <strong>Example:</strong> Set limit at $100 to buy AAPL only if it drops to $100 or below.
            </div>
          </div>

          <div className={styles.card}>
            <h3>Limit Sell Order</h3>
            <p>Sell only if the price reaches or exceeds your specified limit price.</p>
            <div className={styles.details}>
              <strong>When to use:</strong> When you want to sell at a specific minimum price or better.
              <br />
              <strong>Example:</strong> Set limit at $110 to sell AAPL only if it rises to $110 or above.
            </div>
          </div>

          <div className={styles.card}>
            <h3>Stop-Loss Order</h3>
            <p>A sell order that becomes a market order once the price falls to your stop price.</p>
            <div className={styles.details}>
              <strong>When to use:</strong> To limit losses by automatically selling if price drops too much.
              <br />
              <strong>Example:</strong> Buy AAPL at $100, set stop-loss at $95 to automatically sell if it drops 5%.
              <br />
              <strong>Note:</strong> Protects against large losses, but doesn't guarantee the exact stop price in volatile markets.
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>💼 Portfolio Construction</h2>
          
          <div className={styles.card}>
            <h3>Diversification Principles</h3>
            <p>A well-diversified portfolio reduces risk by spreading investments across different assets.</p>
            <div className={styles.details}>
              <strong>Key Rules for FINA3010:</strong>
              <ul>
                <li>Each position: 5-10% of portfolio (minimum 5%, maximum 10%)</li>
                <li>Minimum 20 trades required</li>
                <li>Maximum 200 trades allowed</li>
                <li>Must trade across multiple days (not just 1-2 days)</li>
                <li>Must trade throughout the period (not just last week)</li>
              </ul>
            </div>
          </div>

          <div className={styles.card}>
            <h3>Position Sizing</h3>
            <p>How to calculate position size to meet 5-10% requirement:</p>
            <div className={styles.details}>
              <strong>Example:</strong> Portfolio value = $100,000
              <br />
              • Minimum per position: $5,000 (5%)
              <br />
              • Maximum per position: $10,000 (10%)
              <br />
              <br />
              If AAPL is $150/share:
              <br />
              • Minimum shares: $5,000 / $150 = ~33 shares
              <br />
              • Maximum shares: $10,000 / $150 = ~66 shares
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>📊 Trading Strategies</h2>
          
          <div className={styles.card}>
            <h3>Arbitrage Trading</h3>
            <p>Buying and selling the same security in different markets to profit from price differences.</p>
            <div className={styles.details}>
              <strong>Note:</strong> True arbitrage requires near-instant execution and is rare for retail traders.
              <br />
              <strong>For simulation:</strong> Look for price differences between related securities or ETFs tracking the same index.
            </div>
          </div>

          <div className={styles.card}>
            <h3>Short-Term Speculation</h3>
            <p>Trading based on price movements over short time periods (days to weeks).</p>
            <div className={styles.details}>
              <strong>Strategies:</strong>
              <ul>
                <li>Momentum trading: Buy stocks trending upward</li>
                <li>Mean reversion: Buy stocks that have dropped too much</li>
                <li>News-based: Trade on earnings, announcements, or events</li>
              </ul>
              <strong>Remember:</strong> Day trading is prohibited in the simulation.
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>⚠️ Trading Rules & Constraints</h2>
          
          <div className={styles.warningCard}>
            <h3>FINA3010 Simulation Rules</h3>
            <ul className={styles.rulesList}>
              <li>✅ Starting portfolio: $100,000 USD</li>
              <li>✅ Minimum trade price: $2 per share</li>
              <li>✅ Minimum trades: 20</li>
              <li>✅ Maximum trades: 200</li>
              <li>✅ Commission: $5 per trade</li>
              <li>✅ Position size: 5-10% of portfolio per asset</li>
              <li>✅ Short selling: Allowed</li>
              <li>❌ Day trading: Prohibited</li>
              <li>❌ Margin trading: Prohibited</li>
              <li>❌ Limit trade to 50% of daily volume</li>
            </ul>
          </div>

          <div className={styles.card}>
            <h3>You Will Lose Score If:</h3>
            <ul className={styles.rulesList}>
              <li>You open more than one account</li>
              <li>You only trade in the last week</li>
              <li>You trade only in one or two days</li>
              <li>You violate any trading rules</li>
            </ul>
          </div>
        </section>

        <section className={styles.section}>
          <h2>📈 Performance Metrics</h2>
          
          <div className={styles.card}>
            <h3>Outperforming S&P 500</h3>
            <p>Students who outperform the S&P 500 Index during the simulation period receive a 1% bonus.</p>
            <div className={styles.details}>
              <strong>Tip:</strong> Track your portfolio performance regularly and compare it to the S&P 500.
              <br />
              You can find S&P 500 data on MarketWatch (ticker: SPY).
            </div>
          </div>
        </section>

        <div className={styles.footer}>
          <p>
            <strong>Need help?</strong> Review the{' '}
            <a href="https://www.marketwatch.com/document/vse-sample-course-material.pdf" target="_blank" rel="noopener noreferrer">
              MarketWatch Student Guide
            </a>
            {' '}or check the{' '}
            <Link href="/reports">Reports section</Link> for presentation templates.
          </p>
        </div>
      </div>
    </div>
  );
}

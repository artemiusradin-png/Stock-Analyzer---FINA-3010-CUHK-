# FINA3010 Trading Simulation - Website Structure

## Purpose
Support tool for MarketWatch trading simulation, helping students:
- Research stocks before trading
- Track and analyze trading activities
- Build diversified portfolios
- Prepare presentations and reports

## Proposed Structure

### 1. 📊 STOCK RESEARCH (`/research`)
**Purpose:** Research stocks before trading on MarketWatch

**Features:**
- Stock lookup and company analysis
- DCF Valuation (existing - intrinsic value analysis)
- Sentiment Analysis (existing - news sentiment)
- Risk Metrics (existing - assess stock risk)
- Technical Analysis (NEW - price trends, indicators)

**Use Case:** "Should I buy AAPL?" → Research here before placing order on MarketWatch

---

### 2. 💼 MY TRADING PORTFOLIO (`/portfolio` or `/trading`)
**Purpose:** Track your MarketWatch simulation trades and portfolio

**Features:**
- **Trade Journal** (NEW)
  - Log trades manually (date, ticker, order type, quantity, price)
  - Categorize: Market order, Limit order, Stop-loss order
  - Track: Buy, Sell, Short-sale
  - View all trades in a table

- **Portfolio Dashboard** (NEW)
  - Current holdings (from logged trades)
  - Portfolio value tracking
  - Diversification analysis (check if 5-10% constraints met)
  - Performance vs S&P 500 (bonus tracking)
  - Position sizes visualization

- **Portfolio Optimizer** (existing - enhanced)
  - Diversification suggestions
  - Optimal allocation calculator
  - Constraint checker (5-10% per position)

- **Performance Analytics** (NEW)
  - Total return calculation
  - Sharpe ratio, volatility
  - Trade statistics (total trades, avg trade size)
  - Weekly performance summaries (for presentations)

---

### 3. 📈 PORTFOLIO BUILDER (`/builder`)
**Purpose:** Plan and test portfolio construction before trading

**Features:**
- Add/remove stocks to test portfolio
- Check diversification (5-10% constraints)
- Calculate expected portfolio metrics
- Compare different portfolio compositions
- Export portfolio plan

---

### 4. 📚 LEARNING CENTER (`/learn`)
**Purpose:** Educational content about trading concepts

**Sections:**
- **Order Types Explained**
  - Market Order
  - Limit Order (Buy/Sell)
  - Stop-Loss Order
  - Visual examples

- **Trading Strategies**
  - Diversification principles
  - Arbitrage opportunities
  - Short-term speculation
  - Risk management

- **Trading Rules Summary**
  - All rules from syllabus
  - Constraint checker
  - Common mistakes to avoid

---

### 5. 📊 REPORTS & PRESENTATIONS (`/reports`)
**Purpose:** Generate materials for class presentations and final report

**Features:**
- **Weekly Summary Report** (for presentations)
  - Trades made this week
  - Performance summary
  - Key decisions and rationale
  - Charts and visualizations

- **Final Reflection Helper** (for report)
  - Portfolio summary (start/end value, trades count)
  - Performance metrics
  - Screenshot-ready dashboard
  - Template for reflection content

---

### 6. ⚙️ SETTINGS (`/settings`)
- Simulation parameters (starting value: $100,000)
- Trading constraints configuration
- Alert preferences

## Implementation Priority

### Phase 1: Essential (Week 1)
1. ✅ Stock Research page (DCF, Sentiment) - mostly done
2. ⏳ Trade Journal (manual entry)
3. ⏳ Portfolio Dashboard (from journal entries)

### Phase 2: Important (Week 2)
4. ⏳ Portfolio Builder tool
5. ⏳ Performance analytics
6. ⏳ Diversification checker

### Phase 3: Enhanced (Week 3+)
7. ⏳ Reports generator
8. ⏳ Learning center content
9. ⏳ Advanced analytics

## Database Schema (for Trade Journal)

```typescript
Trade {
  id: string
  date: Date
  ticker: string
  orderType: 'market' | 'limit_buy' | 'limit_sell' | 'stop_loss'
  action: 'buy' | 'sell' | 'short_sell'
  quantity: number
  price: number
  commission: number  // $5 per trade
  totalCost: number
  notes?: string
}

PortfolioSnapshot {
  date: Date
  totalValue: number
  positions: Position[]
  cash: number
}

Position {
  ticker: string
  quantity: number
  avgPrice: number
  currentValue: number
  percentage: number  // % of portfolio
}
```

# Proposed Trading-Focused Website Structure for FINA3010

## Overview
Reorganize the application around trading and stock analysis workflows aligned with FINA3010 course requirements.

## Proposed Navigation Structure

### Main Sections:

```
┌─────────────────────────────────────────────────────────────┐
│                    STOCK ANALYSIS SYSTEM                     │
│                    (FINA3010 Trading Module)                 │
└─────────────────────────────────────────────────────────────┘

1. 📊 STOCK ANALYSIS
   ├── Company Overview
   ├── DCF Valuation
   ├── Technical Analysis
   └── Fundamental Analysis

2. 💼 PORTFOLIO MANAGEMENT
   ├── Portfolio Builder
   ├── Optimization
   ├── Performance Tracking
   └── Risk Analysis

3. 📈 TRADING TOOLS
   ├── Watchlist
   ├── Trade Signals
   ├── Backtesting
   └── Strategy Builder

4. 📰 MARKET INTELLIGENCE
   ├── News & Sentiment
   ├── Market Overview
   ├── Sector Analysis
   └── Economic Indicators

5. 💰 ACCOUNT MANAGEMENT
   ├── My Funds
   ├── Trade History
   └── Settings
```

## Detailed Structure

### 1. STOCK ANALYSIS (`/analysis` or `/stocks/:ticker`)

**Main Landing:** `/analysis`
- Ticker search bar (prominent)
- Quick stock lookup
- Recent searches
- Featured stocks

**Stock Detail Page:** `/analysis/[ticker]`
**Tabs:**
- **Overview Tab**
  - Company profile (name, sector, industry, description)
  - Key metrics (market cap, P/E, Beta, EPS)
  - Price chart (1D, 5D, 1M, 3M, 1Y, 5Y)
  - Real-time quote (current price, change, volume)

- **Valuation Tab** (Current DCF)
  - DCF calculator
  - Multi-scenario analysis
  - Sensitivity analysis
  - Fair value vs market price comparison

- **Technical Analysis Tab** (NEW)
  - Price charts with indicators
  - Moving averages (SMA, EMA)
  - RSI, MACD, Bollinger Bands
  - Support/Resistance levels
  - Trading signals (Buy/Sell/Hold)

- **Fundamental Analysis Tab** (NEW)
  - Financial statements summary
  - Key ratios (P/E, P/B, ROE, ROA, Debt/Equity)
  - Growth metrics
  - Competitive comparison

### 2. PORTFOLIO MANAGEMENT (`/portfolio`)

**Main Page:** `/portfolio`
**Tabs:**
- **My Portfolio**
  - Current holdings table
  - Asset allocation pie chart
  - Portfolio value over time
  - Daily/weekly/monthly performance

- **Optimization**
  - Modern Portfolio Theory
  - Efficient frontier visualization
  - Rebalancing suggestions
  - Risk-return optimization

- **Risk Analysis**
  - Portfolio risk metrics (VaR, Beta, Sharpe)
  - Risk decomposition
  - Correlation matrix
  - Stress testing

### 3. TRADING TOOLS (`/trading`)

**Main Page:** `/trading`
**Tabs:**
- **Watchlist**
  - Create/edit watchlists
  - Custom alerts (price, volume, news)
  - Quick analysis links

- **Trade Signals** (NEW)
  - Technical indicators signals
  - Pattern recognition
  - Entry/exit suggestions
  - Signal strength

- **Backtesting** (NEW)
  - Strategy backtesting engine
  - Historical performance
  - Risk metrics
  - Strategy comparison

- **Strategy Builder** (NEW - Optional Advanced)
  - Custom strategy creation
  - Rule-based trading logic
  - Paper trading simulation

### 4. MARKET INTELLIGENCE (`/market`)

**Main Page:** `/market`
**Tabs:**
- **News & Sentiment**
  - Market news feed
  - Sentiment analysis by ticker
  - Sector sentiment
  - News impact on prices

- **Market Overview**
  - Major indices (S&P 500, Dow, NASDAQ)
  - Sector performance
  - Top gainers/losers
  - Volume leaders

- **Economic Indicators** (NEW)
  - Key economic data
  - Interest rates
  - Inflation metrics
  - GDP data

### 5. ACCOUNT MANAGEMENT (`/account`)

- **My Funds** (current `/my-funds`)
- **Trade History** (NEW)
- **Settings & Preferences** (NEW)

## Implementation Priority

### Phase 1: Core Trading Features (Essential)
1. ✅ Stock Analysis page with DCF (partially done)
2. ✅ Portfolio optimization (API exists)
3. ✅ Sentiment analysis (API exists)
4. ⏳ Technical Analysis page (NEW)
5. ⏳ Watchlist feature (NEW)

### Phase 2: Enhanced Trading Tools
1. ⏳ Trade signals
2. ⏳ Backtesting engine
3. ⏳ Enhanced risk analysis UI
4. ⏳ Market overview dashboard

### Phase 3: Advanced Features
1. ⏳ Strategy builder
2. ⏳ Paper trading
3. ⏳ Economic indicators integration
4. ⏳ Advanced charting

## File Structure Proposal

```
frontend/nextjs/app/
├── page.tsx                    # Landing/Dashboard
├── analysis/
│   ├── page.tsx                # Stock search/list
│   └── [ticker]/
│       └── page.tsx            # Stock detail with tabs
├── portfolio/
│   ├── page.tsx                # Portfolio overview
│   ├── optimization/
│   └── risk/
├── trading/
│   ├── page.tsx                # Trading tools hub
│   ├── watchlist/
│   ├── signals/
│   └── backtesting/
├── market/
│   ├── page.tsx                # Market overview
│   ├── news/
│   └── sentiment/
├── account/
│   ├── my-funds/               # Existing
│   ├── history/
│   └── settings/
└── api/                        # Existing API routes
```

## Key Features to Add

### Technical Analysis Components:
- Chart.js or Recharts for price charts
- Technical indicators library
- Pattern recognition algorithms
- Signal generation logic

### Watchlist System:
- Add/remove stocks
- Multiple watchlists
- Alerts system
- Quick action buttons

### Backtesting Engine:
- Historical data integration
- Strategy evaluation
- Performance metrics
- Visualization of results

---

**Next Steps:**
1. Confirm which features are required for FINA3010 trading section
2. Share the trading section requirements from the PDF
3. Implement based on priority and course requirements

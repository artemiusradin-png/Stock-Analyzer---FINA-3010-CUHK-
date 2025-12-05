# Portfolio Optimization Engine - Implementation Plan
**Version:** 1.0
**Date:** December 3, 2025
**Status:** In Progress

---

## Current State Analysis

### ✅ Already Implemented (Backend)
1. **Optimization Strategies** (4/4)
   - Maximum Sharpe Ratio ✅
   - Minimum Variance ✅
   - Risk Parity ✅
   - Equal Weight ✅

2. **Core Calculations**
   - Mean-Variance Optimization (MVO) ✅
   - Efficient Frontier Generation ✅
   - Portfolio metrics (return, volatility, Sharpe) ✅
   - Correlation/covariance matrices ✅

3. **Additional Features**
   - DCF-weighted strategy ✅
   - Target return optimization ✅
   - Flexible constraints (min/max weights) ✅

### ❌ Missing from PRD Requirements

#### Frontend Enhancements Needed:
1. **Risk Parity Strategy** - Not in dropdown (backend exists)
2. **Theory Tab** - Educational content for 6 MPT concepts
3. **Advanced Metrics Display**:
   - Individual asset risk contributions
   - CAPM expected returns per asset
   - Correlation matrix visualization
   - Asset-level volatilities
4. **Efficient Frontier Chart** - Visual plot with optimal point marked
5. **Strategy Comparison View** - Side-by-side comparison of all 4 strategies
6. **CSV Export** - Download weights and metrics
7. **CAPM Integration** - Asset return forecasting using beta

#### Backend Enhancements Needed:
1. **CAPM Calculation Endpoint** - Compute E(Ri) = Rf + β(Rm - Rf)
2. **Risk Contribution Metrics** - Per-asset risk contribution calculation
3. **Efficient Frontier API Enhancement** - Return data ready for charting
4. **Error Handling** - Fix 500 errors in optimization endpoint

---

## Implementation Phases

### Phase 1: Critical Fixes & Core Features (Priority: HIGH)
**Timeline:** Immediate
**Goal:** Make existing features work correctly + add missing strategies

1. **Fix 500 Errors in Portfolio Optimization**
   - Debug backend logs
   - Handle edge cases (failed ticker downloads, insufficient data)
   - Add proper error messages

2. **Add Risk Parity to Frontend Dropdown**
   - Update HTML select options
   - Test Risk Parity calculation

3. **Enhanced Results Display**
   - Show individual asset contributions
   - Display correlation matrix
   - Show risk contribution per asset

### Phase 2: Educational & Visualization (Priority: MEDIUM)
**Timeline:** After Phase 1
**Goal:** Add Theory tab and efficient frontier chart

4. **Theory Tab Implementation**
   - Create new tab in HTML
   - Add 6 MPT concept explanations:
     - CAPM Formula with examples
     - Mean-Variance Optimization (MVO)
     - Modern Portfolio Theory (MPT)
     - Risk Parity Strategy
     - Black-Litterman framework (foundation)
     - Monte Carlo simulation capability
   - Include formulas, diagrams, examples

5. **Efficient Frontier Visualization**
   - Add Chart.js or Plotly
   - Plot risk vs return curve
   - Mark optimal portfolio point
   - Add hover tooltips with weights

### Phase 3: Advanced Features (Priority: LOW)
**Timeline:** After Phase 2
**Goal:** Strategy comparison, CAPM integration, export

6. **Strategy Comparison View**
   - Run all 4 strategies simultaneously
   - Display side-by-side table
   - Highlight differences in weights/metrics

7. **CAPM Integration**
   - Add beta input per asset (optional)
   - Calculate CAPM expected returns
   - Display alongside historical returns

8. **CSV Export**
   - Export optimal weights
   - Export portfolio metrics
   - Export efficient frontier data

---

## Technical Specifications

### Phase 1 Implementation Details

#### 1.1 Fix Portfolio Optimization Errors

**Issue:** 500 Internal Server Error when optimizing

**Root Cause Analysis:**
- Check backend logs for stack traces
- Likely causes:
  - Failed ticker downloads (delisted stocks: LDO, MTU)
  - Insufficient historical data
  - Singular covariance matrix
  - Division by zero in Sharpe calculation

**Solution:**
```python
# Add error handling in portfolios.py
try:
    returns = fetch_returns_data(tickers, request.lookback_days)

    # Filter out tickers with insufficient data
    valid_tickers = [t for t in returns.columns if len(returns[t].dropna()) > 20]

    if len(valid_tickers) < 2:
        raise HTTPException(400, "Insufficient data for optimization")

    # Use only valid tickers
    returns = returns[valid_tickers]

except Exception as e:
    raise HTTPException(400, f"Data fetch failed: {str(e)}")
```

#### 1.2 Add Risk Parity to Dropdown

**File:** `frontend/public/project-npv.html` (line ~1435)

**Change:**
```html
<select class="input" id="portfolio-strategy">
    <option value="max_sharpe">Maximum Sharpe Ratio</option>
    <option value="min_variance">Minimum Variance</option>
    <option value="risk_parity">Risk Parity</option>
    <option value="equal_weight">Equal Weight</option>
    <option value="target_return">Target Return</option>
</select>
```

#### 1.3 Enhanced Results Display

**File:** `frontend/public/js/portfolio-module.js` (displayPortfolioResults function)

**Add:**
- Correlation matrix table
- Risk contribution per asset
- Individual asset statistics (return, volatility, weight)

**Example Output:**
```
Portfolio Metrics:
- Expected Return: 12.5% annually
- Volatility: 18.3%
- Sharpe Ratio: 0.68

Individual Assets:
┌─────────┬────────┬──────────┬────────────┬─────────────────┐
│ Ticker  │ Weight │ Return   │ Volatility │ Risk Contrib    │
├─────────┼────────┼──────────┼────────────┼─────────────────┤
│ AAPL    │ 25.3%  │ 15.2%    │ 24.1%      │ 4.8% (26%)      │
│ MSFT    │ 22.1%  │ 13.8%    │ 22.5%      │ 4.2% (23%)      │
│ GOOGL   │ 18.6%  │ 14.1%    │ 26.3%      │ 4.1% (22%)       │
│ JNJ     │ 34.0%  │ 8.5%     │ 16.2%      │ 5.2% (29%)      │
└─────────┴────────┴──────────┴────────────┴─────────────────┘

Correlation Matrix:
┌─────────┬────────┬────────┬────────┬─────┐
│         │ AAPL   │ MSFT   │ GOOGL  │ JNJ │
├─────────┼────────┼────────┼────────┼─────┤
│ AAPL    │ 1.00   │ 0.82   │ 0.76   │ 0.15│
│ MSFT    │ 0.82   │ 1.00   │ 0.79   │ 0.12│
│ GOOGL   │ 0.76   │ 0.79   │ 1.00   │ 0.08│
│ JNJ     │ 0.15   │ 0.12   │ 0.08   │ 1.00│
└─────────┴────────┴────────┴────────┴─────┘
```

### Phase 2 Implementation Details

#### 2.1 Theory Tab Content Structure

**File:** `frontend/public/project-npv.html` (new tab)

**Content Outline:**
```html
<div id="theory-tab" class="npv-tab-content">
    <h2>Modern Portfolio Theory Concepts</h2>

    <section id="capm-section">
        <h3>1. Capital Asset Pricing Model (CAPM)</h3>
        <p>Formula: E(Ri) = Rf + βi(E(Rm) - Rf)</p>
        <ul>
            <li>Rf = Risk-free rate (e.g., 10-year Treasury yield)</li>
            <li>βi = Beta coefficient (systematic risk)</li>
            <li>E(Rm) - Rf = Market risk premium (~5-7% historically)</li>
        </ul>
        <p><strong>Purpose:</strong> Establishes theoretically appropriate return for each security based on systematic risk.</p>
        <p><strong>Example:</strong> If Rf = 4.5%, β = 1.2, market premium = 6%, then E(R) = 4.5% + 1.2(6%) = 11.7%</p>
    </section>

    <section id="mvo-section">
        <h3>2. Mean-Variance Optimization (MVO)</h3>
        <p>Maximize Sharpe Ratio subject to portfolio constraints</p>
        <p>Formula: max SR = (Rp - Rf) / σp</p>
        <p><strong>Constraint:</strong> Σ wi = 1, wi ≥ 0</p>
        <p><strong>Purpose:</strong> Find optimal risk-adjusted allocation using quadratic programming.</p>
    </section>

    <!-- ... more sections for MPT, Risk Parity, Black-Litterman, Monte Carlo -->
</div>
```

#### 2.2 Efficient Frontier Chart

**Library:** Chart.js (already available)

**Implementation:**
```javascript
function plotEfficientFrontier(frontierData, optimalPoint) {
    const ctx = document.getElementById('efficient-frontier-chart').getContext('2d');

    new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Efficient Frontier',
                data: frontierData.map(p => ({x: p.volatility * 100, y: p.return * 100})),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                showLine: true,
                pointRadius: 3
            }, {
                label: 'Optimal Portfolio',
                data: [{x: optimalPoint.volatility * 100, y: optimalPoint.return * 100}],
                backgroundColor: '#10b981',
                pointRadius: 8,
                pointStyle: 'star'
            }]
        },
        options: {
            scales: {
                x: {title: {display: true, text: 'Volatility (%)'}},
                y: {title: {display: true, text: 'Expected Return (%)'}}
            }
        }
    });
}
```

### Phase 3 Implementation Details

#### 3.1 Strategy Comparison

**API Call:** Run all strategies in parallel
```javascript
async function compareStrategies() {
    const strategies = ['max_sharpe', 'min_variance', 'risk_parity', 'equal_weight'];

    const results = await Promise.all(
        strategies.map(s => optimizePortfolioWithStrategy(s))
    );

    displayComparisonTable(results);
}
```

**Display:** Side-by-side table with weights, metrics, differences highlighted

#### 3.2 CSV Export

**Implementation:**
```javascript
function exportToCSV() {
    const data = window.portfolioResults;

    let csv = 'Ticker,Weight,Expected Return,Volatility,Risk Contribution\n';
    data.holdings.forEach(h => {
        csv += `${h.ticker},${h.weight},${h.expected_return},${h.volatility},${h.risk_contribution}\n`;
    });

    // Download
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio_${data.strategy}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}
```

---

## Testing Checklist

### Phase 1 Tests
- [ ] Portfolio optimization completes without 500 errors
- [ ] Risk Parity strategy produces equal risk contributions (±1%)
- [ ] Correlation matrix displays correctly
- [ ] All 4 strategies run successfully on sample portfolio (AAPL, MSFT, GOOGL, JNJ)

### Phase 2 Tests
- [ ] Theory tab content loads and displays all 6 concepts
- [ ] Efficient frontier chart plots correctly
- [ ] Optimal portfolio point marked on chart
- [ ] Chart tooltips show portfolio weights

### Phase 3 Tests
- [ ] Strategy comparison runs all 4 strategies in <2 seconds
- [ ] CSV export downloads valid file
- [ ] CAPM returns calculated correctly (manual verification)

---

## Sample Data for Testing

### Default Portfolio Universe
```javascript
const sampleAssets = [
    {ticker: 'AAPL', beta: 1.2},
    {ticker: 'MSFT', beta: 1.1},
    {ticker: 'GOOGL', beta: 1.15},
    {ticker: 'NVDA', beta: 1.5},
    {ticker: 'TSLA', beta: 2.0},
    {ticker: 'JNJ', beta: 0.7},
    {ticker: 'PG', beta: 0.6},
    {ticker: 'KO', beta: 0.5}
];
```

### Expected Results (Max Sharpe, Rf=4.5%)
```
AAPL: 18.2%
MSFT: 22.1%
GOOGL: 14.3%
NVDA: 8.7%
TSLA: 3.2%
JNJ: 15.8%
PG: 10.2%
KO: 7.5%

Portfolio Return: 13.2%
Portfolio Vol: 16.8%
Sharpe Ratio: 0.52
```

---

## Next Steps

1. **Immediate:** Fix 500 errors and add Risk Parity dropdown
2. **Short-term:** Enhance results display with correlation matrix
3. **Medium-term:** Add Theory tab and efficient frontier chart
4. **Long-term:** Complete strategy comparison and CSV export

**Current Priority:** Phase 1 - Fix errors and add missing UI elements

---

**Document Owner:** Development Team
**Last Updated:** December 3, 2025

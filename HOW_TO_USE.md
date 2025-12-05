# 🎯 How to Use Your Portfolio Management Platform

## The Simple Way (Recommended)

### Step 1: Just Click
```bash
open /Users/artem/Desktop/PythonProject/frontend/public/project-npv.html
```

**That's it!** The page automatically:
- Detects the backend at http://localhost:8000 ✅
- Connects to all APIs ✅
- Loads all 4 tabs ready to use ✅

---

## What You Can Do Right Now

### Tab 1: NPV Calculator
**Use Case**: Calculate Net Present Value for any project

**How to Use:**
1. Click "Tab 1: NPV Calculator"
2. Enter initial investment (negative number, e.g., -100000)
3. Enter required return % (e.g., 10)
4. Add cash flows year by year
5. Click "Calculate NPV"

**Example:**
- Initial Cost: -$100,000
- Required Return: 10%
- Year 1-5 Cash Flows: $25,000 each
- Result: NPV = $5,790

---

### Tab 2: DCF Valuation
**Use Case**: Value a company using Discounted Cash Flow

**How to Use:**
1. Click "Tab 2: DCF Valuation"
2. Enter ticker symbol (e.g., AAPL, MSFT, GOOGL, TSLA)
3. Adjust parameters if desired:
   - Forecast Period (default: 10 years)
   - Terminal Growth (default: 2.5%)
   - Revenue Growth (default: 8%)
   - EBIT Margin (default: 30%)
4. Click "Calculate Valuation"

**What You Get:**
- Estimated intrinsic value
- Current price vs. estimated value
- Bull/Base/Bear scenarios
- Sensitivity analysis chart
- Full DCF breakdown

**Try It:**
```
Ticker: AAPL
Forecast Period: 10 years
→ Click "Calculate Valuation"
```

---

### Tab 3: Portfolio Optimization
**Use Case**: Find optimal portfolio allocation

**How to Use:**
1. Click "Tab 3: Portfolio Optimization"
2. Add tickers (e.g., AAPL, MSFT, GOOGL)
3. Choose strategy:
   - **Max Sharpe**: Best risk-adjusted returns
   - **Min Variance**: Lowest volatility
   - **Risk Parity**: Equal risk contribution
   - **Max Return**: Highest returns (ignores risk)
   - **Target Risk**: Specific volatility target
   - **Target Return**: Specific return target
4. Click "Optimize Portfolio"

**What You Get:**
- Optimal weights for each asset
- Expected return
- Expected volatility
- Sharpe ratio
- Efficient frontier chart

**Try It:**
```
Tickers: AAPL, MSFT, GOOGL
Strategy: Max Sharpe
→ Click "Optimize Portfolio"
```

---

### Tab 4: Sentiment Analysis
**Use Case**: Analyze market sentiment from news

**How to Use:**
1. Click "Tab 4: Sentiment Analysis"
2. Enter ticker symbol (e.g., TSLA, AAPL, NVDA)
3. Select days to analyze (default: 30)
4. Click "Analyze Sentiment"

**What You Get:**
- Overall sentiment score (-1 to +1)
- Positive/Negative/Neutral article counts
- Sentiment trend over time
- Recent news articles with sentiment scores

**Try It:**
```
Ticker: TSLA
Days: 30
→ Click "Analyze Sentiment"
```

---

## Browser Console Testing

### Open Console (F12) and try:

**Check Connection:**
```javascript
console.log('API URL:', API.getBaseUrl());
// Should show: http://localhost:8000
```

**Test Health:**
```javascript
fetch(`${API.getBaseUrl()}/health`)
  .then(r => r.json())
  .then(d => console.log(d));
// Should return: {status: "healthy", service: "Portfolio Management API"}
```

**Test DCF:**
```javascript
API.valuations.calculate({
  ticker: 'AAPL',
  forecast_period: 10,
  terminal_growth: 0.025
}).then(r => console.log('DCF Result:', r));
```

**Test Portfolio:**
```javascript
API.portfolios.optimize({
  assets: [
    {ticker: 'AAPL'},
    {ticker: 'MSFT'},
    {ticker: 'GOOGL'}
  ],
  strategy: 'max_sharpe',
  lookback_days: 252
}).then(r => console.log('Portfolio:', r));
```

**Test Sentiment:**
```javascript
API.sentiment.analyze('TSLA', 30)
  .then(r => console.log('Sentiment:', r));
```

---

## Backend Management

### Check if Backend is Running
```bash
curl http://localhost:8000/health
```

**Expected Response:**
```json
{"status":"healthy","service":"Portfolio Management API"}
```

### View API Documentation
```bash
open http://localhost:8000/docs
```

This opens the interactive Swagger UI where you can:
- See all 10 endpoints
- Test endpoints directly
- View request/response schemas

### Start Backend (if not running)
```bash
cd /Users/artem/Desktop/PythonProject/backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
```

### Stop Backend
```bash
lsof -ti:8000 | xargs kill
```

---

## API Endpoints Reference

### Valuation Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/valuations/calculate` | POST | DCF valuation |
| `/api/valuations/scenarios` | POST | Bull/Base/Bear scenarios |
| `/api/valuations/sensitivity` | POST | Sensitivity analysis |

### Portfolio Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/portfolios/optimize` | POST | Portfolio optimization |
| `/api/portfolios/efficient-frontier` | POST | Efficient frontier |

### Sentiment Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sentiment/analyze` | POST | Sentiment analysis |
| `/api/sentiment/news/{ticker}` | GET | Recent news articles |

### Risk Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/risk/analyze` | POST | Risk metrics (VaR, Sharpe, etc.) |
| `/api/risk/portfolio-decomposition` | POST | Risk attribution |

### Asset Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/assets/{ticker}` | GET | Company information |

---

## Troubleshooting

### Problem: "Backend not detected"

**Solution 1:** Start the backend
```bash
cd /Users/artem/Desktop/PythonProject/backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
```

**Solution 2:** Check if port 8000 is in use
```bash
lsof -ti:8000
```

If something is using it:
```bash
lsof -ti:8000 | xargs kill
```

Then restart the backend.

---

### Problem: "API calls fail"

**Check 1:** Backend is running
```bash
curl http://localhost:8000/health
```

**Check 2:** Open browser console (F12) and look for errors

**Check 3:** Verify API URL
```javascript
console.log(window.API_BASE_URL);
// Should be: http://localhost:8000
```

---

### Problem: "No data returned"

**For DCF/Portfolio:**
- Make sure ticker is valid (e.g., AAPL, MSFT, GOOGL)
- Use major US stocks (better data availability)
- Check backend logs for errors

**For Sentiment:**
- Finnhub API has rate limits (60 calls/minute)
- Some tickers may not have recent news
- Try a popular ticker like TSLA, AAPL, NVDA

---

## Example Workflows

### Workflow 1: Value a Company
1. Open project-npv.html
2. Go to Tab 2 (DCF Valuation)
3. Enter: AAPL
4. Click "Calculate Valuation"
5. Review estimated value vs. current price
6. Check sensitivity analysis
7. View bull/base/bear scenarios

---

### Workflow 2: Build a Portfolio
1. Open project-npv.html
2. Go to Tab 3 (Portfolio Optimization)
3. Add tickers: AAPL, MSFT, GOOGL, NVDA
4. Select strategy: Max Sharpe
5. Click "Optimize Portfolio"
6. Review optimal weights
7. View efficient frontier

---

### Workflow 3: Analyze Market Sentiment
1. Open project-npv.html
2. Go to Tab 4 (Sentiment Analysis)
3. Enter ticker: TSLA
4. Days: 30
5. Click "Analyze Sentiment"
6. Review sentiment score
7. Read recent news articles

---

### Workflow 4: Evaluate a Project
1. Open project-npv.html
2. Go to Tab 1 (NPV Calculator)
3. Enter initial cost: -$500,000
4. Required return: 12%
5. Add 5 years of cash flows
6. Click "Calculate NPV"
7. Review NPV and decide if project is viable

---

## Tips for Best Results

### DCF Valuation
- Use established companies (AAPL, MSFT, GOOGL)
- Adjust terminal growth conservatively (2-3%)
- Review multiple scenarios (Bull/Base/Bear)
- Compare estimated value to current price

### Portfolio Optimization
- Use 3-10 stocks for best results
- Max Sharpe is a good starting strategy
- Review the efficient frontier
- Consider transaction costs in real implementation

### Sentiment Analysis
- Use popular tickers (more news coverage)
- Analyze 7-30 days for current sentiment
- Look at sentiment trend over time
- Read actual articles for context

### NPV Calculator
- Use realistic cash flow projections
- Include all costs in initial investment
- Use appropriate discount rate (WACC or required return)
- Consider sensitivity to different scenarios

---

## Your Data Sources

All data comes from reliable sources:

**Market Data:** yfinance (Yahoo Finance)
**News:** Finnhub (API key configured)
**Economic Data:** FRED (Federal Reserve)
**Company Data:** EOD Historical Data (API key configured)

Your API keys are configured in:
- `/backend/.env`
- `/backend/app/config.py`

---

## Summary

**To Use:**
1. Backend is already running at http://localhost:8000
2. Just open project-npv.html
3. Use any of the 4 tabs
4. Everything connects automatically!

**No configuration needed - it just works! 🚀**

---

## Quick Links

- **Frontend**: [project-npv.html](file:///Users/artem/Desktop/PythonProject/frontend/public/project-npv.html)
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Setup Guide**: [SETUP_COMPLETE.md](SETUP_COMPLETE.md)
- **Quick Ref**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

---

**Happy analyzing! 📈**

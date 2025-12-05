# ⚡ Quick Test Guide - What Works Now

## 🚀 Quick Start (3 Steps)

### Step 1: Backend is Already Running ✅
```bash
curl http://localhost:8000/health
# Response: {"status":"healthy","service":"Portfolio Management API"}
```

### Step 2: Open Frontend
```bash
open /Users/artem/Desktop/PythonProject/frontend/public/project-npv.html
```

### Step 3: Open Browser Console (F12)
Look for:
```
✅ Backend connected: http://localhost:8000
```

---

## 🎯 What to Test

### ✅ Tab 1: NPV Calculator - WORKS
**No API needed - pure frontend calculation**

1. Click "Tab 1: Project NPV"
2. Enter:
   - Initial Cost: `-100000`
   - Required Return: `10`
   - Year 1-5 Cash Flows: `25000` each
3. Click "Calculate NPV"
4. **Expected**: Shows NPV value, IRR, decision

---

### ✅ Tab 2: DCF Valuation - WORKS

1. Click "Tab 2: DCF Valuation"
2. Enter ticker: `AAPL`
3. Click "Calculate Valuation"
4. **Expected Result**:
   ```
   ✅ Enterprise Value: $1.01T
   ✅ Equity Value: $948.28B
   ✅ WACC: 10.43%
   ✅ Intrinsic Value/Share: $64.18
   ✅ FCF Projections table (10 years)
   ```

**Try These Tickers**:
- `AAPL` - Apple ✅
- `MSFT` - Microsoft ✅
- `GOOGL` - Google ✅
- `TSLA` - Tesla ✅
- `NVDA` - Nvidia ✅

---

### ✅ Tab 4: Sentiment Analysis - WORKS

1. Click "Tab 4: Sentiment Analysis"
2. Enter ticker: `AAPL`
3. Click "Analyze Sentiment"
4. **Expected Result**:
   ```
   ✅ Overall Sentiment: Positive (0.11)
   ✅ Sentiment Trend: bullish
   ✅ 7d News Volume: 192 articles
   ✅ 30d Avg Sentiment: 0.23
   ✅ Positive Ratio: 70%
   ```

**Try These Tickers**:
- `TSLA` - Usually lots of news ✅
- `AAPL` - Steady positive ✅
- `NVDA` - AI hype ✅

---

### ⚠️ Tab 3: Portfolio Optimization - Backend Bug

1. Click "Tab 3: Portfolio Optimization"
2. Add tickers: `AAPL`, `MSFT`
3. Click "Optimize Portfolio"
4. **Current Result**: ⚠️ Error message

**Status**: Frontend is correct, backend has a data fetching bug

---

## 🧪 Test from Command Line

### Test DCF API
```bash
curl -X POST 'http://localhost:8000/api/valuations/calculate' \
  -H 'Content-Type: application/json' \
  -d '{"ticker": "AAPL", "forecast_period": 10}'
```

### Test Sentiment API
```bash
curl -X POST 'http://localhost:8000/api/sentiment/analyze' \
  -H 'Content-Type: application/json' \
  -d '{"ticker": "AAPL", "days": 30}'
```

### Test Backend Health
```bash
curl http://localhost:8000/health
```

---

## 🎨 What the UI Looks Like

### Theme: Clean Light Design ✨
- White background
- Black text
- Clean borders
- Minimalist aesthetic

### Layout: 4 Tabs
```
┌─────────────────────────────────────────────┐
│  Project NPV Analytics          [ARQAM]     │
├─────────────────────────────────────────────┤
│ [Project NPV] [DCF Valuation] [Portfolio]  │
│              [Sentiment Analysis]           │
├─────────────────────────────────────────────┤
│                                             │
│  Active tab content displays here          │
│  - Input forms                              │
│  - Calculate buttons                        │
│  - Results cards                            │
│  - Data tables                              │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🔍 Browser Console Testing

### Open Console (F12), then run:

```javascript
// Check API connection
console.log('API URL:', window.API_BASE_URL);
// Should show: http://localhost:8000

// Test DCF
calculateDCF(); // After filling in ticker

// Test Sentiment
analyzeSentiment(); // After filling in ticker

// Test with API client
if (window.API) {
  API.valuations.calculate({
    ticker: 'AAPL',
    forecast_period: 10
  }).then(r => console.log('DCF:', r));
}
```

---

## 📊 What Each Tab Shows

### Tab 1: Project NPV
**Inputs:**
- Initial Cost
- Required Return
- Annual Cash Flows

**Outputs:**
- NPV Value (big number)
- Decision: Accept/Reject
- IRR
- Discount Table

---

### Tab 2: DCF Valuation
**Inputs:**
- Ticker Symbol
- Forecast Period
- Revenue, Growth Rates
- WACC parameters

**Outputs:**
- 4 Summary Cards (Enterprise Value, Equity Value, WACC, Intrinsic Value)
- FCF Projections Table (10 years)
- Year-by-year breakdown

---

### Tab 3: Portfolio Optimization
**Inputs:**
- Asset Tickers (AAPL, MSFT, etc.)
- Strategy (Max Sharpe, Min Variance, etc.)
- Constraints

**Outputs:**
- Expected Return
- Volatility
- Sharpe Ratio
- Optimal Weights Table

---

### Tab 4: Sentiment Analysis
**Inputs:**
- Ticker Symbol

**Outputs:**
- Large Sentiment Score with color
- Sentiment Trend
- News Volumes (7d, 30d)
- Recent News Articles (if available)

---

## ✅ Success Checklist

After opening project-npv.html, you should see:

- [ ] Page loads with light theme
- [ ] 4 tabs visible at top
- [ ] "API Connected" status in nav bar
- [ ] Browser console shows `✅ Backend connected: http://localhost:8000`
- [ ] Tab 1 (NPV) works with manual input
- [ ] Tab 2 (DCF) returns results for AAPL
- [ ] Tab 4 (Sentiment) returns results for AAPL
- [ ] Tab 3 (Portfolio) shows error (known backend issue)

---

## 🐛 Troubleshooting

### Problem: "API not connected"
**Solution:**
```bash
# Check backend is running
curl http://localhost:8000/health

# If not running, start it:
cd /Users/artem/Desktop/PythonProject/backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
```

### Problem: "DCF returns no data"
**Check:**
- Is ticker valid? (Try AAPL, MSFT, GOOGL)
- Check browser console for errors (F12)
- Verify API response: `curl -X POST 'http://localhost:8000/api/valuations/calculate' -H 'Content-Type: application/json' -d '{"ticker":"AAPL","forecast_period":10}'`

### Problem: "Sentiment returns no articles"
**Note:** This is normal! Sentiment API returns overall score but may not include individual articles. The sentiment score and metrics are the main output.

---

## 📈 Example Test Session

```
1. Open project-npv.html
   ✅ Light theme loads
   ✅ Console shows "Backend connected"

2. Click Tab 2 (DCF Valuation)
   ✅ Input form visible

3. Enter "AAPL" and click Calculate
   ✅ Loading state appears
   ✅ Results load in 2-3 seconds
   ✅ Cards show values
   ✅ Table shows 10 years of projections

4. Click Tab 4 (Sentiment Analysis)
   ✅ Input form visible

5. Enter "AAPL" and click Analyze
   ✅ Loading state appears
   ✅ Sentiment score appears: "Positive"
   ✅ Metrics show: trend, volumes, ratios

6. Click Tab 1 (NPV Calculator)
   ✅ Enter cash flows manually
   ✅ Calculate NPV
   ✅ Results appear instantly (no API call)

SUCCESS! 🎉
```

---

## 🎯 Bottom Line

### What Works:
1. ✅ DCF Valuation (Tab 2) - **Try it with AAPL**
2. ✅ Sentiment Analysis (Tab 4) - **Try it with AAPL**
3. ✅ NPV Calculator (Tab 1) - **Works offline**
4. ✅ Backend API at port 8000
5. ✅ Automatic connection detection
6. ✅ Clean light-themed UI

### What Doesn't:
1. ⚠️ Portfolio Optimization (Tab 3) - Backend bug, not frontend

### How to See It:
```bash
open /Users/artem/Desktop/PythonProject/frontend/public/project-npv.html
```

**Then try DCF for AAPL - it will work! 🚀**

---

## 📝 Quick Command Reference

```bash
# Start backend
cd /Users/artem/Desktop/PythonProject/backend && python3 -m uvicorn app.main:app --reload &

# Open frontend
open /Users/artem/Desktop/PythonProject/frontend/public/project-npv.html

# Check health
curl http://localhost:8000/health

# Stop backend
lsof -ti:8000 | xargs kill

# View API docs
open http://localhost:8000/docs
```

---

**Everything is connected now! The UI existed, it just wasn't talking to the right APIs. Now it is! 🎊**

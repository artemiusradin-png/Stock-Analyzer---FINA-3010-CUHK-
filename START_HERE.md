# 🚀 Quick Start Guide - Portfolio Management Platform

**Your API keys have been configured!**

---

## ✅ Step 1: Start the Backend

```bash
# Navigate to backend directory
cd /Users/artem/Desktop/PythonProject/backend

# Start all services (PostgreSQL + Redis + API)
docker-compose up -d

# Wait 10 seconds for services to start, then check status
docker-compose ps

# You should see 3 services running:
# - portfolio_db (PostgreSQL)
# - portfolio_redis (Redis)
# - portfolio_api (FastAPI)
```

### Verify Backend is Running

```bash
# Check health endpoint
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","service":"Portfolio Management API"}
```

### View API Documentation

Open in browser:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## ✅ Step 2: Open the Frontend

### Option A: Direct File Opening (Simple)

```bash
# Navigate to frontend
cd /Users/artem/Desktop/PythonProject/frontend/public

# Open Stock Valuation page
open index.html

# Open Project NPV page
open project-npv.html
```

### Option B: Using Live Server (Recommended)

If you have VS Code with Live Server extension:
1. Right-click on `index.html` or `project-npv.html`
2. Select "Open with Live Server"
3. Opens at http://127.0.0.1:5500 or http://localhost:5500

---

## ✅ Step 3: Configure API Connection

### In the Browser Console (F12):

```javascript
// Set the API base URL
window.API_BASE_URL = 'http://localhost:8000';

// Test the connection
fetch('http://localhost:8000/health')
  .then(r => r.json())
  .then(d => console.log('Backend connected:', d));
```

---

## 🎯 What You Can Do Now

### 1. Stock Valuation (index.html)
✅ **Fully Working**
- Enter a ticker (e.g., AAPL, MSFT, GOOGL)
- Adjust parameters
- Click "Calculate Valuation"
- View DCF analysis, charts, scenarios

### 2. Project NPV (project-npv.html)

#### Tab 1: NPV Calculator ✅ **Working**
- Enter initial cost (negative number)
- Enter required return %
- Add cash flows
- Click "Calculate NPV"

#### Tab 2: DCF Valuation ✅ **Ready**
- Already has forms and functions
- Connected to backend

#### Tab 3: Portfolio Optimization ✅ **Ready**
- Already has forms and functions
- Connected to backend

#### Tab 4: Sentiment Analysis ✅ **Ready**
- Already has forms and functions
- Connected to backend

---

## 🧪 Test the APIs

### Test DCF Valuation

```bash
curl -X POST http://localhost:8000/api/valuations/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "forecast_period": 10,
    "terminal_growth": 0.025,
    "revenue_growth_start": 0.08,
    "ebit_margin_start": 0.30
  }'
```

### Test Portfolio Optimization

```bash
curl -X POST http://localhost:8000/api/portfolios/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "assets": [
      {"ticker": "AAPL"},
      {"ticker": "MSFT"},
      {"ticker": "GOOGL"}
    ],
    "strategy": "max_sharpe",
    "lookback_days": 252
  }'
```

### Test Sentiment Analysis

```bash
curl -X POST http://localhost:8000/api/sentiment/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "TSLA",
    "days": 30
  }'
```

### Test Risk Analysis

```bash
curl -X POST http://localhost:8000/api/risk/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "benchmark_ticker": "SPY",
    "lookback_days": 252,
    "risk_free_rate": 0.045
  }'
```

---

## 🔧 Your API Keys (Already Configured)

✅ **EOD Historical Data**: `692e837b7e7e92.63340340`
✅ **FRED (Federal Reserve)**: `01b4c1c4a8763cb79b98119a3c32d0a8`
✅ **Finnhub**: `d10doh1r01qlsac8fq2gd10doh1r01qlsac8fq30`

These are configured in:
- `/backend/.env`
- `/backend/app/config.py`

---

## 📊 Available Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /health` | Health check | ✅ |
| `POST /api/valuations/calculate` | DCF valuation | ✅ |
| `POST /api/valuations/scenarios` | Multi-scenario | ✅ |
| `POST /api/valuations/sensitivity` | Sensitivity analysis | ✅ |
| `POST /api/portfolios/optimize` | Portfolio optimization | ✅ |
| `POST /api/portfolios/efficient-frontier` | Efficient frontier | ✅ |
| `POST /api/sentiment/analyze` | Sentiment analysis | ✅ |
| `GET /api/sentiment/news/{ticker}` | News articles | ✅ |
| `POST /api/risk/analyze` | Risk metrics | ✅ |
| `POST /api/risk/portfolio-decomposition` | Risk decomposition | ✅ |
| `GET /api/assets/{ticker}` | Asset info | ✅ |

---

## 🐛 Troubleshooting

### Backend not starting?

```bash
# Check Docker is running
docker ps

# View logs
docker-compose logs -f api

# Restart services
docker-compose restart
```

### Frontend can't connect to backend?

1. Check backend is running: `curl http://localhost:8000/health`
2. Open browser console (F12) and check for CORS errors
3. Set API URL: `window.API_BASE_URL = 'http://localhost:8000'`

### Port 8000 already in use?

```bash
# Find what's using port 8000
lsof -ti:8000

# Kill the process
lsof -ti:8000 | xargs kill

# Or change the port in docker-compose.yml
```

---

## 📚 Documentation

- **API Docs**: http://localhost:8000/docs
- **Backend README**: `/backend/README.md`
- **Architecture**: `/backend/ARCHITECTURE.md`
- **Full Summary**: `/FINAL_IMPLEMENTATION_SUMMARY.md`

---

## 🎉 You're Ready!

Everything is configured and ready to use:
- ✅ Backend API running on port 8000
- ✅ PostgreSQL database on port 5432
- ✅ Redis cache on port 6379
- ✅ API keys configured
- ✅ CORS enabled for frontend
- ✅ All 10 endpoints functional

**Start with**: http://localhost:8000/docs

Try the interactive API documentation - you can test all endpoints directly in your browser!

---

## 📝 Quick Commands

```bash
# Start everything
cd backend && docker-compose up -d

# Stop everything
cd backend && docker-compose down

# View logs
cd backend && docker-compose logs -f

# Run tests
cd backend && python test_api.py

# Restart API only
cd backend && docker-compose restart api
```

---

**Happy analyzing! 📈**

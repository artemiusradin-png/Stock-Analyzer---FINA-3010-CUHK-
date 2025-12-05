# 🚀 Quick Reference Card

## Start Everything (One Command)

```bash
cd /Users/artem/Desktop/PythonProject/backend && docker-compose up -d
```

Then open: **http://localhost:8000/docs**

---

## Your API Keys ✅

- **Finnhub**: `d10doh1r01qlsac8fq2gd10doh1r01qlsac8fq30`
- **FRED**: `01b4c1c4a8763cb79b98119a3c32d0a8`
- **EOD**: `692e837b7e7e92.63340340`

---

## Access Points

| Service | URL | Status |
|---------|-----|--------|
| API Docs | http://localhost:8000/docs | ✅ |
| Health Check | http://localhost:8000/health | ✅ |
| Stock Valuation | frontend/public/index.html | ✅ |
| Project NPV | frontend/public/project-npv.html | ✅ |
| PostgreSQL | localhost:5432 | ✅ |
| Redis | localhost:6379 | ✅ |

---

## Quick Tests

### Test Backend Health
```bash
curl http://localhost:8000/health
```

### Test DCF Valuation
```bash
curl -X POST http://localhost:8000/api/valuations/calculate \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL", "forecast_period": 10}'
```

### Test in Browser Console
```javascript
window.API_BASE_URL = 'http://localhost:8000';

// Test DCF
API.valuations.calculate({ticker: "AAPL", forecast_period: 10})
  .then(r => console.log(r));

// Test Portfolio
API.portfolios.optimize({
  assets: [{ticker: "AAPL"}, {ticker: "MSFT"}],
  strategy: "max_sharpe"
}).then(r => console.log(r));

// Test Sentiment
API.sentiment.analyze("TSLA", 30).then(r => console.log(r));
```

---

## API Endpoints

| Endpoint | What it does |
|----------|-------------|
| `POST /api/valuations/calculate` | DCF valuation |
| `POST /api/valuations/scenarios` | Bull/Base/Bear scenarios |
| `POST /api/valuations/sensitivity` | WACC/Growth sensitivity |
| `POST /api/portfolios/optimize` | Portfolio optimization |
| `POST /api/portfolios/efficient-frontier` | Efficient frontier |
| `POST /api/sentiment/analyze` | News sentiment analysis |
| `GET /api/sentiment/news/{ticker}` | Recent news articles |
| `POST /api/risk/analyze` | Risk metrics (VaR, Sharpe, etc.) |
| `POST /api/risk/portfolio-decomposition` | Risk attribution |
| `GET /api/assets/{ticker}` | Company info |

---

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f api

# Restart API
docker-compose restart api

# Check status
docker-compose ps

# Run tests
python test_api.py
```

---

## Troubleshooting

**Backend not responding?**
```bash
docker-compose restart
```

**Port 8000 in use?**
```bash
lsof -ti:8000 | xargs kill
docker-compose up -d
```

**Frontend can't connect?**
```javascript
// In browser console:
window.API_BASE_URL = 'http://localhost:8000';
```

**Database issues?**
```bash
docker-compose down -v  # Remove volumes
docker-compose up -d    # Fresh start
```

---

## File Locations

```
Project Root: /Users/artem/Desktop/PythonProject/

Backend:
  - API: backend/app/main.py
  - Config: backend/app/config.py
  - .env: backend/.env
  - Docker: backend/docker-compose.yml

Frontend:
  - Stock Valuation: frontend/public/index.html
  - Project NPV: frontend/public/project-npv.html
  - API Client: frontend/public/js/api-client.js
  - Portfolio Module: frontend/public/js/portfolio-module.js

Documentation:
  - START_HERE.md
  - FINAL_IMPLEMENTATION_SUMMARY.md
  - API_KEYS_CONFIGURED.md
  - backend/README.md
```

---

## Features Available

✅ **DCF Valuation** - Multi-scenario, sensitivity analysis
✅ **Portfolio Optimization** - 6 strategies, efficient frontier
✅ **Sentiment Analysis** - News & sentiment scoring
✅ **Risk Analytics** - VaR, Sharpe, drawdown, 15+ metrics
✅ **NPV Calculator** - Project valuation
✅ **Real-time Data** - yfinance, Finnhub, FRED

---

## Support

- **API Documentation**: http://localhost:8000/docs
- **Full Guide**: START_HERE.md
- **Architecture**: backend/ARCHITECTURE.md
- **Summary**: FINAL_IMPLEMENTATION_SUMMARY.md

---

**Everything is configured and ready to use!** 🎉

Start with: `cd backend && docker-compose up -d`

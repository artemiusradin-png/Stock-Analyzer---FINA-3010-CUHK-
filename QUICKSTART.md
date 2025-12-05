# Portfolio Management Backend - Quick Start Guide

## Prerequisites

1. **Docker & Docker Compose** (recommended)
   - OR Python 3.10+ and PostgreSQL 15

2. **API Keys** (optional but recommended)
   - [Finnhub](https://finnhub.io) - for news sentiment
   - [FRED](https://fred.stlouisfed.org/docs/api/api_key.html) - for risk-free rate

## Setup Steps

### Option 1: Docker (Recommended)

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Edit .env with your API keys** (optional)
   ```bash
   # Open .env in your editor
   nano .env

   # Add your API keys:
   FINNHUB_API_KEY=your_key_here
   FRED_API_KEY=your_key_here
   ```

4. **Start all services**
   ```bash
   docker-compose up -d
   ```

5. **Check logs**
   ```bash
   docker-compose logs -f api
   ```

6. **Access the API**
   - API: [http://localhost:8000](http://localhost:8000)
   - Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
   - Health: [http://localhost:8000/health](http://localhost:8000/health)

### Option 2: Local Development

1. **Install Python dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Set up PostgreSQL**
   ```bash
   # Install PostgreSQL 15
   # Create database:
   createdb portfolio_db
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and API keys
   ```

4. **Run the application**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

## Test the API

### Method 1: Interactive Docs
Visit [http://localhost:8000/docs](http://localhost:8000/docs) and use the built-in Swagger UI

### Method 2: Test Script
```bash
cd backend
python test_api.py
```

### Method 3: cURL Examples

**DCF Valuation:**
```bash
curl -X POST "http://localhost:8000/api/valuations/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "revenue_growth_start": 0.08,
    "ebit_margin_start": 0.30,
    "forecast_period": 10,
    "terminal_growth": 0.025
  }'
```

**Portfolio Optimization:**
```bash
curl -X POST "http://localhost:8000/api/portfolios/optimize" \
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

**Sentiment Analysis:**
```bash
curl -X POST "http://localhost:8000/api/sentiment/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "TSLA",
    "days": 30
  }'
```

**Risk Analysis:**
```bash
curl -X POST "http://localhost:8000/api/risk/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "lookback_days": 252,
    "benchmark_ticker": "SPY"
  }'
```

## Common Commands

### Docker
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f api

# Rebuild after code changes
docker-compose up -d --build

# Access database
docker-compose exec postgres psql -U portfolio_user -d portfolio_db
```

### Local Development
```bash
# Run with auto-reload
uvicorn app.main:app --reload

# Run on different port
uvicorn app.main:app --port 8080

# Run tests
pytest
```

## Troubleshooting

### Port Already in Use
```bash
# Change ports in docker-compose.yml or kill existing process
lsof -ti:8000 | xargs kill
```

### Database Connection Error
```bash
# Check PostgreSQL is running
docker-compose ps
# Or for local: pg_isready
```

### Missing API Keys
- Finnhub sentiment will use fallback if key is missing
- FRED will use default risk-free rate if key is missing
- App will still work without API keys

## Next Steps

1. **Explore the API** at [http://localhost:8000/docs](http://localhost:8000/docs)
2. **Read the full README** at [backend/README.md](backend/README.md)
3. **Review the architecture** in the main spec document
4. **Integrate with frontend** (coming soon)

## Key Features to Try

1. **DCF Valuation**
   - Calculate intrinsic value for any stock
   - Run multi-scenario analysis (Bull/Base/Bear)
   - Generate sensitivity tables

2. **Portfolio Optimization**
   - Optimize allocations with different strategies
   - Generate efficient frontier
   - Analyze risk contributions

3. **Sentiment Analysis**
   - Get news sentiment for any ticker
   - See aggregated sentiment trends
   - Apply sentiment adjustments to valuations

4. **Risk Analytics**
   - Calculate VaR, CVaR, Max Drawdown
   - Compute Sharpe, Sortino ratios
   - Analyze portfolio risk decomposition

## Support

For issues or questions:
- Check the logs: `docker-compose logs -f`
- Review the README: `backend/README.md`
- Open an issue on GitHub

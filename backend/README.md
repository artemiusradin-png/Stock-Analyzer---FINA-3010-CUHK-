# Portfolio Management Backend v2.0

A comprehensive Python/FastAPI backend for portfolio management with:
- DCF Valuation with multi-scenario & sensitivity analysis
- Portfolio Optimization using Modern Portfolio Theory
- Finnhub News & Sentiment Integration
- Advanced Risk Analytics (VaR, CVaR, Drawdown, Sharpe, etc.)
- PostgreSQL database for persistence
- RESTful API design

## Features

### 1. DCF Valuation Engine
- Free Cash Flow projection with customizable assumptions
- WACC calculation with CAPM
- Terminal value calculation
- Multi-scenario analysis (Base/Bull/Bear)
- 2D sensitivity analysis (WACC vs Terminal Growth)

### 2. Portfolio Optimization
- Multiple strategies:
  - Maximum Sharpe Ratio
  - Minimum Variance
  - Target Return
  - Risk Parity
  - DCF-Weighted
  - Equal Weight
- Efficient Frontier calculation
- Portfolio risk decomposition

### 3. Sentiment Analysis
- Finnhub news integration
- VADER and TextBlob sentiment scoring
- Recency-weighted aggregation
- Valuation impact adjustment

### 4. Risk Analytics
- Volatility & downside volatility
- Beta, Alpha, R-squared
- Value at Risk (VaR) - 95% & 99%
- Conditional VaR (CVaR/Expected Shortfall)
- Maximum Drawdown
- Sharpe, Sortino, Calmar ratios
- Skewness & Kurtosis

## Tech Stack

- **Framework**: FastAPI 0.109
- **Database**: PostgreSQL 15 + SQLAlchemy
- **Math/Optimization**: NumPy, Pandas, SciPy, CVXPY
- **Data Sources**: yfinance, Finnhub, FRED
- **NLP**: VADER Sentiment, TextBlob
- **Caching**: Redis (optional)
- **Deployment**: Docker, Docker Compose

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys
# - FINNHUB_API_KEY (get from https://finnhub.io)
# - FRED_API_KEY (get from https://fred.stlouisfed.org)
```

### 2. Docker Deployment (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

The API will be available at [http://localhost:8000](http://localhost:8000)

### 3. Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Start PostgreSQL (if not using Docker)
# Update DATABASE_URL in .env

# Run the application
uvicorn app.main:app --reload --port 8000
```

## API Documentation

Once running, visit:
- **Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

## API Endpoints

### Valuations

- `POST /api/valuations/calculate` - Calculate DCF valuation
- `POST /api/valuations/scenarios` - Multi-scenario analysis
- `POST /api/valuations/sensitivity` - Sensitivity analysis

### Portfolios

- `POST /api/portfolios/optimize` - Optimize portfolio
- `POST /api/portfolios/efficient-frontier` - Calculate efficient frontier

### Sentiment

- `POST /api/sentiment/analyze` - Analyze sentiment for ticker
- `GET /api/sentiment/news/{ticker}` - Get news with sentiment scores

### Risk Analytics

- `POST /api/risk/analyze` - Comprehensive risk analysis
- `POST /api/risk/portfolio-decomposition` - Portfolio risk decomposition

### Assets

- `GET /api/assets/{ticker}` - Get asset metadata

## Example Usage

### DCF Valuation

```python
import requests

response = requests.post('http://localhost:8000/api/valuations/calculate', json={
    "ticker": "AAPL",
    "revenue_growth_start": 0.08,
    "ebit_margin_start": 0.30,
    "forecast_period": 10,
    "terminal_growth": 0.025
})

result = response.json()
print(f"Implied Price: ${result['implied_price']:.2f}")
print(f"Upside: {result['upside_downside']:.1f}%")
```

### Portfolio Optimization

```python
response = requests.post('http://localhost:8000/api/portfolios/optimize', json={
    "assets": [
        {"ticker": "AAPL"},
        {"ticker": "MSFT"},
        {"ticker": "GOOGL"},
        {"ticker": "AMZN"}
    ],
    "strategy": "max_sharpe",
    "lookback_days": 252
})

portfolio = response.json()
print(f"Expected Return: {portfolio['expected_return']*100:.2f}%")
print(f"Volatility: {portfolio['volatility']*100:.2f}%")
print(f"Sharpe Ratio: {portfolio['sharpe_ratio']:.2f}")
```

### Sentiment Analysis

```python
response = requests.post('http://localhost:8000/api/sentiment/analyze', json={
    "ticker": "TSLA",
    "days": 30
})

sentiment = response.json()
print(f"Overall Sentiment: {sentiment['overall_sentiment']:.3f}")
print(f"Trend: {sentiment['sentiment_trend']}")
print(f"Sentiment Adjustment: {sentiment['sentiment_adjustment']:.2f}%")
```

## Database Schema

The application uses PostgreSQL with the following main tables:
- `assets` - Asset metadata
- `dcf_valuations` - DCF valuation results
- `scenario_valuations` - Multi-scenario results
- `portfolios` - Portfolio configurations
- `portfolio_holdings` - Portfolio positions
- `portfolio_performance` - Time-series performance
- `news_sentiment` - Individual news articles
- `sentiment_summary` - Aggregated sentiment
- `historical_prices` - Price history
- `asset_returns` - Calculated returns
- `covariance_matrix` - Covariance matrices

## Configuration

Key configuration options in `.env`:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/portfolio_db

# API Keys
FINNHUB_API_KEY=your_key
FRED_API_KEY=your_key

# Application
DEBUG=True
LOG_LEVEL=INFO

# Financial Defaults
DEFAULT_RISK_FREE_RATE=0.045
DEFAULT_ERP=0.055
DEFAULT_TAX_RATE=0.25
```

## Development

### Running Tests

```bash
pytest
```

### Code Structure

```
backend/
├── app/
│   ├── api/           # API endpoints
│   ├── models/        # Database models
│   ├── schemas/       # Pydantic schemas
│   ├── services/      # Business logic
│   ├── config.py      # Configuration
│   ├── database.py    # Database setup
│   └── main.py        # FastAPI app
├── tests/             # Test suite
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## Performance Considerations

- Use Redis caching for frequently accessed data
- Implement background tasks for expensive calculations
- Consider connection pooling for database
- Rate limit API requests to external services

## Security

- Never commit `.env` file with real API keys
- Use environment variables for sensitive data
- Implement authentication/authorization for production
- Validate all user inputs
- Use HTTPS in production

## License

MIT License

## Support

For issues or questions, please open an issue on GitHub.

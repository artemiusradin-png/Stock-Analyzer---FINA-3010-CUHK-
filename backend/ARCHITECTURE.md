# Portfolio Management Backend - Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                           │
│  (Frontend, Postman, cURL, Python Scripts)                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       FASTAPI APPLICATION                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                    API ROUTES                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐  │   │
│  │  │Valuations│ │Portfolios│ │Sentiment │ │  Risk   │  │   │
│  │  │          │ │          │ │          │ │         │  │   │
│  │  │/calculate│ │/optimize │ │/analyze  │ │/analyze │  │   │
│  │  │/scenarios│ │/frontier │ │/news     │ │/decomp  │  │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘  │   │
│  └───────┼────────────┼──────────────┼───────────┼────────┘   │
│          │            │              │           │             │
│  ┌───────▼────────────▼──────────────▼───────────▼────────┐   │
│  │                  SERVICE LAYER                          │   │
│  │  ┌────────────┐ ┌─────────────┐ ┌──────────────┐      │   │
│  │  │DCF Engine  │ │Portfolio    │ │Sentiment     │      │   │
│  │  │            │ │Optimizer    │ │Engine        │      │   │
│  │  │• FCF Proj  │ │• Max Sharpe │ │• News Fetch  │      │   │
│  │  │• WACC      │ │• Min Var    │ │• VADER       │      │   │
│  │  │• Terminal  │ │• Risk Parity│ │• TextBlob    │      │   │
│  │  │• Scenarios │ │• DCF Weight │ │• Aggregation │      │   │
│  │  └────────────┘ └─────────────┘ └──────────────┘      │   │
│  │  ┌────────────────────────────────────────────┐        │   │
│  │  │Risk Analytics                               │        │   │
│  │  │• Volatility • VaR • Drawdown • Sharpe      │        │   │
│  │  └────────────────────────────────────────────┘        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 DATABASE LAYER (SQLAlchemy)             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │Assets    │ │Valuations│ │Portfolios│ │Sentiment │  │   │
│  │  │          │ │          │ │          │ │          │  │   │
│  │  │Market    │ │Scenarios │ │Holdings  │ │News      │  │   │
│  │  │Data      │ │          │ │Perf      │ │Summary   │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────┬────────────────────┘
                     │                    │
                     ▼                    ▼
         ┌──────────────────┐  ┌──────────────────┐
         │   PostgreSQL     │  │      Redis       │
         │   (Persistence)  │  │    (Caching)     │
         └──────────────────┘  └──────────────────┘
                     │
                     ▼
         ┌──────────────────────────────┐
         │   EXTERNAL DATA SOURCES      │
         │                              │
         │  • yfinance (Market Data)    │
         │  • Finnhub (News)            │
         │  • FRED (Risk-Free Rate)     │
         └──────────────────────────────┘
```

## Request Flow

### 1. DCF Valuation Request

```
User → POST /api/valuations/calculate
  ↓
DCFParameters Schema Validation
  ↓
fetch_company_data(ticker)
  ↓ yfinance API
Market Data (prices, fundamentals, beta)
  ↓
Build DCFInputs
  ↓
DCFEngine.perform_dcf()
  ├─ calculate_wacc()
  ├─ build_projections()
  └─ calculate_terminal_value()
  ↓
DCFOutputs
  ↓
Convert to DCFResult Schema
  ↓
JSON Response to User
```

### 2. Portfolio Optimization Request

```
User → POST /api/portfolios/optimize
  ↓
PortfolioOptimizationRequest Schema
  ↓
fetch_returns_data(tickers)
  ↓ yfinance API
Historical Price Data
  ↓
Calculate Returns & Covariance
  ↓
PortfolioOptimizer.optimize()
  ├─ Strategy Selection
  │   ├─ max_sharpe_optimization()
  │   ├─ min_variance_optimization()
  │   ├─ target_return_optimization()
  │   ├─ risk_parity_optimization()
  │   └─ dcf_weighted_optimization()
  ↓
PortfolioMetrics
  ↓
Convert to PortfolioResponse
  ↓
JSON Response to User
```

### 3. Sentiment Analysis Request

```
User → POST /api/sentiment/analyze
  ↓
SentimentRequest Schema
  ↓
SentimentEngine.get_sentiment_summary()
  ↓
fetch_news(ticker)
  ↓ Finnhub API
News Articles
  ↓
For Each Article:
  analyze_sentiment()
    ├─ VADER Sentiment
    └─ TextBlob Polarity
  ↓
aggregate_sentiment()
  ├─ Recency Weighting
  ├─ Volume Metrics
  └─ Sentiment Adjustment
  ↓
AggregateSentiment
  ↓
Convert to SentimentSummaryResponse
  ↓
JSON Response to User
```

## Data Models

### Core Entities

```
Asset
├─ ticker (PK)
├─ name
├─ sector, industry
├─ market_cap
├─ beta
└─ financial metrics

DCFValuation
├─ id (PK)
├─ ticker (FK → Asset)
├─ scenario_type
├─ implied_price
├─ wacc, cost_of_equity
├─ enterprise_value
└─ projections (JSON)

Portfolio
├─ id (PK)
├─ name
├─ strategy
├─ expected_return
├─ volatility
└─ sharpe_ratio

PortfolioHolding
├─ id (PK)
├─ portfolio_id (FK → Portfolio)
├─ ticker (FK → Asset)
├─ weight
└─ contribution metrics

NewsSentiment
├─ id (PK)
├─ ticker (FK → Asset)
├─ headline, summary
├─ sentiment_score
└─ published_at

SentimentSummary
├─ ticker (PK, FK → Asset)
├─ overall_sentiment
├─ trend
├─ news_volume_7d/30d
└─ sentiment_adjustment
```

## Technology Stack

### Backend Framework
- **FastAPI** - Async web framework
- **Uvicorn** - ASGI server
- **Pydantic** - Data validation

### Database
- **PostgreSQL** - Primary database
- **SQLAlchemy** - ORM
- **Alembic** - Migrations

### Optimization & Math
- **CVXPY** - Convex optimization
- **SciPy** - Scientific computing
- **NumPy** - Numerical arrays
- **Pandas** - Data structures

### Data Sources
- **yfinance** - Market data
- **Finnhub** - News & fundamentals
- **FRED API** - Economic data

### NLP & Sentiment
- **VADER** - Sentiment analysis
- **TextBlob** - Text processing

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Redis** - Caching (optional)

## Key Algorithms

### 1. DCF Valuation

```python
# Free Cash Flow
FCF = NOPAT + D&A - CapEx - ΔNWC
NOPAT = EBIT × (1 - T)

# WACC
βL = βU × (1 + (1-T) × D/E)
Re = Rf + βL × ERP
Rd_after_tax = Rd × (1 - T)
WACC = (E/V × Re) + (D/V × Rd × (1-T))

# Terminal Value
TV = FCF_n+1 / (WACC - g)
PV(TV) = TV / (1 + WACC)^n

# Equity Value
EV = Σ PV(FCF) + PV(TV)
Equity = EV - Debt + Cash
Price = Equity / Shares
```

### 2. Portfolio Optimization

```python
# Maximum Sharpe Ratio
max (μ^T w - Rf) / √(w^T Σ w)
subject to:
  Σ w_i = 1
  0 ≤ w_i ≤ max_weight

# Minimum Variance
min w^T Σ w
subject to:
  Σ w_i = 1
  0 ≤ w_i ≤ max_weight

# Risk Parity
RC_i = w_i × (Σw)_i / σ_p
Minimize variance of RC across assets
```

### 3. Risk Metrics

```python
# VaR (Historical)
VaR_95 = percentile(returns, 5%)

# CVaR (Expected Shortfall)
CVaR_95 = E[R | R ≤ VaR_95]

# Sharpe Ratio
Sharpe = (R_p - R_f) / σ_p

# Sortino Ratio
Sortino = (R_p - R_f) / σ_downside

# Maximum Drawdown
DD = (Trough - Peak) / Peak
```

## Scaling Considerations

### Performance Optimization
1. **Caching**: Redis for expensive calculations
2. **Async Operations**: FastAPI async endpoints
3. **Database**: Connection pooling, indexes
4. **Background Jobs**: Celery for long-running tasks

### Horizontal Scaling
- Stateless API design
- Load balancer ready
- Multiple worker processes
- Database read replicas

### Monitoring
- Health checks
- Request logging
- Error tracking
- Performance metrics

## Security

### Authentication (Future)
- JWT tokens
- OAuth2 integration
- API key management

### Data Protection
- Environment variables
- No hardcoded secrets
- SQL injection protection (ORM)
- Input validation (Pydantic)

### Network Security
- HTTPS only (production)
- CORS configuration
- Rate limiting
- Request validation

## Deployment

### Development
```bash
uvicorn app.main:app --reload
```

### Docker
```bash
docker-compose up -d
```

### Production
- Kubernetes deployment
- Reverse proxy (Nginx)
- SSL/TLS certificates
- Monitoring & logging
- Auto-scaling

## API Design Principles

1. **RESTful**: Standard HTTP methods
2. **JSON**: Request/response format
3. **Versioning**: URL-based (/api/v1)
4. **Documentation**: Auto-generated (Swagger/ReDoc)
5. **Error Handling**: Consistent error responses
6. **Validation**: Pydantic schemas
7. **Async**: Non-blocking operations
8. **CORS**: Cross-origin support

## Maintenance

### Database Migrations
```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Dependency Updates
```bash
pip install --upgrade -r requirements.txt
```

### Logging
- Application logs: stdout
- Access logs: uvicorn
- Error logs: FastAPI exception handlers
- Database logs: SQLAlchemy echo

## Future Architecture Enhancements

1. **Microservices**: Split into separate services
2. **Event-Driven**: Message queues (RabbitMQ)
3. **GraphQL**: Alternative API interface
4. **WebSockets**: Real-time updates
5. **Caching Layer**: Redis/Memcached integration
6. **CDN**: Static asset delivery
7. **Multi-Region**: Geographic distribution
8. **Observability**: Prometheus, Grafana

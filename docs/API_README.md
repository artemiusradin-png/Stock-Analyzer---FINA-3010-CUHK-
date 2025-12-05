# DCF API Backend Integration

This document explains how to integrate the Python DCF calculation engine with your web application.

## Setup

### 1. Install Dependencies

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate  # On Windows

# Install required packages
pip install -r requirements.txt
```

### 2. Start the API Server

```bash
# Make the script executable (first time only)
chmod +x backend/scripts/start_api.sh

# Run the startup script (uses python3.11 if available)
./backend/scripts/start_api.sh
```

Or manually:
```bash
python3.11 backend/scripts/start_dcf_server.py  # or python3 if 3.11 is unavailable
```

The API will start on `http://localhost:8080`

## Usage

### Enable API Mode in Frontend

In `frontend/public/js/main.js`, change:
```javascript
let USE_API = true;  // Enable API mode
```

### API Endpoints

#### 1. Health Check
```
GET /api/health
```

Response:
```json
{
  "status": "healthy",
  "service": "DCF API"
}
```

#### 2. Calculate DCF
```
POST /api/dcf/calculate
```

Request Body:
```json
{
  "ticker": "CMG.US",
  "parameters": {
    "forecast_period": 10,
    "revenue_growth": 0.07,
    "ebit_margin": 0.23,
    "tax_rate": 0.21,
    "dna_ratio": 0.03,
    "capex_ratio": 0.05,
    "nwc_ratio": 0.05,
    "terminal_growth": 0.025,
    "cost_of_debt": 0.03885
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "ticker": "CMG.US",
    "current_price": 254.43,
    "implied_price": 312.56,
    "upside_downside": 22.85,
    "enterprise_value": 78.4,
    "equity_value": 76.2,
    "terminal_value": 45.3,
    "pv_terminal": 23.1,
    "wacc": 8.7,
    "cost_of_equity": 9.2,
    "cost_of_debt": 3.9,
    "beta": 1.04,
    "shares_outstanding": 27.7,
    "projections": [
      {
        "year": 2026,
        "revenue": 9.8,
        "revenue_growth": 7.0,
        "ebit": 2.25,
        "ebit_margin": 23.0,
        "fcf": 1.89,
        "pv_fcf": 1.74,
        "tax_rate": 21.0
      },
      ...
    ]
  }
}
```

## Features

### Real-Time Data
- Fetches actual financial data from EOD Historical Data API
- Automatically calculates:
  - Beta from market data
  - Risk-free rate from US 10Y Treasury
  - Equity Risk Premium from Damodaran dataset
  - WACC using actual debt and equity values

### Advanced DCF Model
- Multi-year projections with linear interpolation
- Terminal value calculation
- Present value discounting
- Complete financial statement projections

### Automatic Fallback
If the API is unavailable, the frontend automatically falls back to client-side calculations.

## Configuration

### API Key
The EOD Historical Data API key is configured in `backend/dcf_service/dcf_api.py`:
```python
API_KEY = "68da01419a5231.83867132"
```

### CORS Settings
CORS is enabled for all origins. In production, restrict to your domain:
```python
CORS(app, origins=['https://yourdomain.com'])
```

## Development

### Testing the API

```bash
# Health check
curl http://localhost:5000/api/health

# DCF calculation
curl -X POST http://localhost:5000/api/dcf/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "CMG.US",
    "parameters": {
      "forecast_period": 10,
      "revenue_growth": 0.07,
      "terminal_growth": 0.025
    }
  }'
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>
```

### Missing Dependencies
```bash
# Reinstall all dependencies
pip install --force-reinstall -r requirements.txt
```

### CORS Errors
Ensure the Flask-CORS package is installed and CORS is enabled in the API.

## Production Deployment

For production, consider:
1. Using Gunicorn or uWSGI instead of Flask's development server
2. Setting up proper authentication/API keys
3. Rate limiting
4. Caching frequently requested calculations
5. Using environment variables for configuration

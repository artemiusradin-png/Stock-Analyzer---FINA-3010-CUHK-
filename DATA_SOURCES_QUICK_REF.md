# 📊 DATA SOURCES & CALCULATIONS - QUICK REFERENCE

## 🎯 QUICK ANSWER

### **Where is data fetched from?**

| Module | External API | What's Fetched |
|--------|-------------|----------------|
| **Project NPV** | ❌ None | User enters all data manually |
| **AI NPV** | ✅ ChatGPT (OpenAI) | Cash flow scenarios (Low/Base/High) |
| **AI NPV** | ✅ Finnhub | Company info, stock price |
| **Company DCF** | ✅ yfinance (Yahoo) | Revenue, debt, cash, beta, market cap |
| **Portfolio** | ✅ yfinance (Yahoo) | Historical prices for all tickers |

---

### **What is calculated locally?**

| Calculation | Where | How |
|------------|-------|-----|
| **NPV** | Frontend (JavaScript) | `Σ(CF_t / (1+r)^t) - Initial Investment` |
| **IRR** | Frontend (JavaScript) | Newton-Raphson iterative method |
| **Payback Period** | Frontend (JavaScript) | Cumulative cash flow analysis |
| **WACC** | Backend (Python) | `(E/V × Re) + (D/V × Rd × (1-Tc))` |
| **Free Cash Flow** | Backend (Python) | `EBIT(1-Tax) + D&A - CapEx - ΔNWC` |
| **Terminal Value** | Backend (Python) | Gordon Growth: `FCF × (1+g) / (WACC-g)` |
| **Enterprise Value** | Backend (Python) | `Σ(PV of FCF) + PV(Terminal Value)` |
| **Portfolio Weights** | Backend (Python) | scipy.optimize (Markowitz) |
| **Sharpe Ratio** | Backend (Python) | `(R_p - R_f) / σ_p` |

---

## 🔑 API KEYS USED

```python
# From backend/app/config.py
FINNHUB_API_KEY = "d10doh1r01qlsac8fq2gd10doh1r01qlsac8fq30"  # ✅ Active
EOD_API_KEY = "692e837b7e7e92.63340340"  # ✅ Active (not currently used)
OPENAI_API_KEY = ""  # ⚠️ In .env but not loading properly
```

---

## 📥 DATA FLOW BY FEATURE

### **1. Project NPV Calculator**
```
User Input → Frontend JS → Calculate NPV/IRR/Payback → Display Results
```
**No external APIs used**

---

### **2. AI NPV (Stock Investment)**
```
User enters ticker
    ↓
Frontend → Backend API
    ↓
Backend calls ChatGPT API
    ↓
ChatGPT returns 3 scenarios (Low/Base/High)
    ↓
Backend calls Finnhub API for stock price
    ↓
Backend calculates NPV for each scenario
    ↓
Return results to frontend
```

**APIs Used:**
- ✅ OpenAI ChatGPT (cash flow scenarios)
- ✅ Finnhub (stock price, company info)

---

### **3. Company DCF Valuation**
```
User enters ticker
    ↓
Frontend → Backend API
    ↓
Backend calls yfinance
    ↓
yfinance returns: revenue, debt, cash, beta, shares
    ↓
Backend DCF Engine calculates:
  - WACC
  - Free Cash Flow (10 years)
  - Terminal Value
  - Enterprise Value
  - Equity Value
  - Intrinsic Price
    ↓
Return results to frontend
```

**APIs Used:**
- ✅ yfinance (Yahoo Finance)

**Calculations:**
- WACC, FCF, Terminal Value, EV, Intrinsic Price

---

### **4. Portfolio Optimization**
```
User enters tickers + weights
    ↓
Frontend → Backend API
    ↓
Backend calls yfinance for each ticker
    ↓
yfinance returns historical prices
    ↓
Backend calculates:
  - Returns
  - Covariance matrix
  - Optimal weights (scipy.optimize)
  - Efficient frontier
  - Sharpe ratio
    ↓
Return results to frontend
```

**APIs Used:**
- ✅ yfinance (Yahoo Finance)

**Calculations:**
- Portfolio optimization (Markowitz)
- Sharpe ratio
- Risk-return analysis

---

## 🧮 CALCULATION FORMULAS

### **NPV (Net Present Value)**
```javascript
NPV = Σ(CF_t / (1 + r)^t) - Initial Investment

Where:
  CF_t = Cash flow at time t
  r = Discount rate
  t = Time period
```

### **IRR (Internal Rate of Return)**
```javascript
Find r where: NPV = 0
Σ(CF_t / (1 + r)^t) - Initial Investment = 0

Solved using Newton-Raphson method
```

### **WACC (Weighted Average Cost of Capital)**
```python
WACC = (E/V × Re) + (D/V × Rd × (1 - Tc))

Where:
  E = Market value of equity
  D = Market value of debt
  V = E + D (total value)
  Re = Cost of equity (CAPM)
  Rd = Cost of debt
  Tc = Corporate tax rate
```

### **Cost of Equity (CAPM)**
```python
Re = Rf + β × (Rm - Rf)

Where:
  Rf = Risk-free rate
  β = Beta (systematic risk)
  Rm - Rf = Equity risk premium (ERP)
```

### **Free Cash Flow**
```python
FCF = EBIT × (1 - Tax Rate) + D&A - CapEx - ΔNWC

Where:
  EBIT = Earnings Before Interest & Tax
  D&A = Depreciation & Amortization
  CapEx = Capital Expenditures
  ΔNWC = Change in Net Working Capital
```

### **Terminal Value (Gordon Growth Model)**
```python
TV = FCF_terminal × (1 + g) / (WACC - g)

Where:
  FCF_terminal = Free cash flow in terminal year
  g = Perpetual growth rate
  WACC = Discount rate
```

### **Enterprise Value**
```python
EV = Σ(PV of FCF) + PV(Terminal Value)

PV = Future Value / (1 + WACC)^t
```

### **Equity Value**
```python
Equity Value = EV + Cash - Debt

Intrinsic Price = Equity Value / Shares Outstanding
```

### **Sharpe Ratio**
```python
Sharpe = (R_p - R_f) / σ_p

Where:
  R_p = Portfolio return
  R_f = Risk-free rate
  σ_p = Portfolio standard deviation (volatility)
```

---

## 🔍 WHICH MODULE USES WHICH API?

| Module | ChatGPT | Finnhub | yfinance | User Input |
|--------|---------|---------|----------|------------|
| **Project NPV** | ❌ | ❌ | ❌ | ✅ |
| **AI NPV** | ✅ | ✅ | ❌ | ✅ (ticker) |
| **Company DCF** | ❌ | ❌ | ✅ | ✅ (ticker) |
| **Portfolio** | ❌ | ❌ | ✅ | ✅ (tickers) |

---

## 📍 FILE LOCATIONS

### **Frontend Modules:**
- `frontend/public/js/npv-module.js` - Project NPV calculator
- `frontend/public/js/ai-npv-module.js` - AI-powered NPV
- `frontend/public/js/dcf-module.js` - Company DCF valuation
- `frontend/public/js/portfolio-module.js` - Portfolio optimization

### **Backend Services:**
- `backend/app/services/ai_npv_service.py` - OpenAI integration
- `backend/app/services/finnhub_service.py` - Finnhub integration
- `backend/app/services/dcf_engine.py` - DCF calculation engine
- `backend/app/services/portfolio_optimizer.py` - Portfolio optimization

### **Backend APIs:**
- `backend/app/api/ai_npv.py` - AI NPV endpoints
- `backend/app/api/valuations.py` - DCF endpoints
- `backend/app/api/portfolios.py` - Portfolio endpoints

---

## ✅ SUMMARY

**Data Fetching:**
- **ChatGPT**: Cash flow scenarios, forecasts
- **Finnhub**: Company metadata, stock quotes
- **yfinance**: Historical data, financials
- **User Input**: Tickers, parameters

**Calculations:**
- **Frontend**: NPV, IRR, Payback Period
- **Backend**: DCF, WACC, Portfolio Optimization, Risk Metrics

**All calculations use industry-standard financial formulas.**


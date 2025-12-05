# Front-End Product Requirements Document (PRD)
## Portfolio Management Platform v2.0

**Version:** 2.0  
**Date:** December 1, 2025  
**Status:** Ready for Development  
**Author:** ARQAM Development Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [User Personas & Use Cases](#user-personas--use-cases)
4. [Feature Requirements](#feature-requirements)
5. [UI/UX Specifications](#uiux-specifications)
6. [API Integration](#api-integration)
7. [Technical Specifications](#technical-specifications)
8. [Design System](#design-system)
9. [User Flows](#user-flows)
10. [Success Metrics](#success-metrics)
11. [Implementation Phases](#implementation-phases)

---

## 1. Executive Summary

### 1.1 Overview

This PRD defines the front-end requirements for a comprehensive Portfolio Management Platform that integrates with the existing FastAPI backend. The platform provides professional-grade financial analysis tools including DCF valuation, portfolio optimization, sentiment analysis, and risk analytics.

### 1.2 Objectives

- **Primary Goal**: Create an intuitive, responsive web application that makes complex financial analysis accessible to users
- **User Experience**: Deliver a modern, professional interface with real-time data visualization
- **Performance**: Ensure fast load times and smooth interactions with large datasets
- **Integration**: Seamlessly connect with the FastAPI backend (v2.0) for all calculations and data processing

### 1.3 Key Deliverables

1. **Stock Valuation Page** (`index.html`) - Dark theme with DCF analysis
2. **Project NPV Page** (`project-npv.html`) - Light theme with project analysis tools
3. **Unified Navigation** - Seamless switching between pages
4. **Real-time Data Visualization** - Charts, graphs, and interactive dashboards
5. **Responsive Design** - Mobile, tablet, and desktop support

---

## 2. Product Overview

### 2.1 Platform Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Front-End Application                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Stock        │  │ Project NPV  │  │ Shared       │  │
│  │ Valuation    │  │ Calculator   │  │ Components   │  │
│  │ (Dark Theme) │  │ (Light Theme)│  │ & Utils      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │      FastAPI Backend v2.0           │
          │  /api/valuations | /api/portfolios  │
          │  /api/sentiment  | /api/risk        │
          │  /api/assets                        │
          └─────────────────────────────────────┘
```

### 2.2 Core Modules

1. **DCF Valuation Engine** - Comprehensive stock valuation with multi-scenario analysis
2. **Portfolio Optimization** - Modern Portfolio Theory with 6 optimization strategies
3. **Sentiment Analysis** - Real-time news sentiment with Finnhub integration
4. **Risk Analytics** - 15+ risk metrics with portfolio decomposition
5. **Project NPV Calculator** - Project valuation and cash flow analysis

---

## 3. User Personas & Use Cases

### 3.1 Primary Personas

**Persona 1: Financial Analyst**
- **Needs**: Deep-dive DCF analysis, sensitivity testing, scenario planning
- **Use Cases**: 
  - Calculate intrinsic value for investment research
  - Compare Base/Bull/Bear scenarios
  - Analyze WACC sensitivity impact

**Persona 2: Portfolio Manager**
- **Needs**: Portfolio optimization, risk analysis, efficient frontier
- **Use Cases**:
  - Optimize portfolio allocation using multiple strategies
  - Analyze portfolio risk decomposition
  - Visualize efficient frontier

**Persona 3: Project Manager**
- **Needs**: Project NPV calculation, cash flow analysis
- **Use Cases**:
  - Evaluate project feasibility
  - Compare multiple project options
  - Analyze discount tables

**Persona 4: Investment Advisor**
- **Needs**: Sentiment analysis, risk metrics, quick valuations
- **Use Cases**:
  - Monitor market sentiment for client holdings
  - Assess risk-adjusted returns
  - Generate client reports

### 3.2 User Stories

**US-1**: As a financial analyst, I want to input a ticker symbol and see a complete DCF valuation with projections, so I can determine if a stock is undervalued.

**US-2**: As a portfolio manager, I want to add multiple assets and optimize my portfolio using different strategies, so I can maximize risk-adjusted returns.

**US-3**: As a project manager, I want to calculate NPV for a project with custom cash flows, so I can make go/no-go decisions.

**US-4**: As an investment advisor, I want to see sentiment analysis for a ticker, so I can understand market perception.

**US-5**: As a user, I want to see comprehensive risk metrics for my portfolio, so I can understand downside exposure.

---

## 4. Feature Requirements

### 4.1 Stock Valuation Page (`index.html`)

#### 4.1.1 DCF Valuation Module

**FR-1.1: Ticker Input & Company Info**
- **Input**: Ticker symbol (e.g., "AAPL")
- **Display**: 
  - Company name, sector, industry
  - Current market price
  - Market cap, shares outstanding
  - Beta, P/E ratio
- **API**: `GET /api/assets/{ticker}`

**FR-1.2: DCF Parameters Input**
- **Required Fields**:
  - Forecast period (5-20 years, default: 10)
  - Terminal growth rate (slider: -10% to 10%, default: 4%)
- **Optional Advanced Parameters**:
  - Revenue growth rate (start & terminal)
  - EBIT margin (start & terminal)
  - Tax rate
  - Risk-free rate
  - Market risk premium
  - Beta override
  - Cost of debt
- **UI**: Collapsible advanced parameters section

**FR-1.3: DCF Calculation & Results**
- **Trigger**: "Calculate Valuation" button
- **API**: `POST /api/valuations/calculate`
- **Display**:
  - **Valuation Summary Cards**:
    - Fair Value Per Share
    - Enterprise Value Per Share
    - PV of FCFF Per Share
    - Current Market Price
    - Upside/Downside percentage
  - **DCF Value Slider**:
    - Visual indicator showing Market Price vs DCF Value
    - Color-coded (red: overvalued, yellow: fair, green: undervalued)
    - Scenario tabs (Worst Case, Base Case, Best Case)
  - **Key Metrics Grid**:
    - WACC, Cost of Equity, Cost of Debt
    - Risk-Free Rate, ERP, Beta
    - Debt, Market Cap, Shares Outstanding
    - Forecast Period, Terminal Growth

**FR-1.4: Financial Projections**
- **Display**: Year-by-year projections table
- **Columns**: Year, Revenue, Growth %, EBIT Margin, EBIT, Tax Rate, NOPAT, Reinvestment, FCFF, Terminal Value, Present Value
- **Toggle**: Show/Hide detailed table button
- **Charts** (Tabbed interface):
  - Revenue Projection (line chart)
  - Revenue Growth % (line chart)
  - Free Cash Flow (bar chart)
  - Margins & ROIC (line chart)
  - Discount Rate (line chart)
  - Valuation Bridge (bar chart)

**FR-1.5: Multi-Scenario Analysis**
- **Trigger**: Scenario tabs (Worst/Base/Best)
- **API**: `POST /api/valuations/scenarios`
- **Display**:
  - Scenario comparison table
  - Implied prices for each scenario
  - Upside/downside percentages
  - Assumptions summary

**FR-1.6: Sensitivity Analysis**
- **Trigger**: "Run Analysis" button in Sensitivity section
- **API**: `POST /api/valuations/sensitivity`
- **Parameters**:
  - WACC range (default: 6% to 18%)
  - Terminal Growth range (default: 1% to 4%)
  - Grid size (default: 25×25)
- **Display**:
  - 3D surface plot (Plotly) showing price sensitivity
  - Interactive controls for rotation/zoom
  - Base case, Min, Max value summary cards
  - Color-coded heatmap overlay option

**FR-1.7: Financial Overview Chart**
- **Display**: Composite line chart showing:
  - Revenue (historical + projected)
  - Net Income (historical + projected)
  - Free Cash Flow (historical + projected)
- **Visual**: Shaded region indicating forecast period
- **Metrics**: Start → End values for each metric

#### 4.1.2 Key Data Panel
- **Display**: Real-time market data
- **Fields**: Previous Close, Open, Bid/Ask, Day's Range, 52 Week Range, Volume, Avg Volume, Market Cap, Beta, PE Ratio, EPS, Earnings Date, Dividend Yield, Ex-Dividend, 1y Target Est
- **Update**: On ticker change

### 4.2 Project NPV Page (`project-npv.html`)

#### 4.2.1 Project NPV Calculator Tab

**FR-2.1: Project Parameters Input**
- **Fields**:
  - Initial Cost (C₀) - negative value for cash outflow
  - Required Return (%) - discount rate
- **Validation**: Ensure required return > 0

**FR-2.2: Cash Flow Management**
- **Default**: 5 years of cash flows
- **Actions**:
  - Add Year button
  - Remove Year button (minimum 1 year required)
- **Input**: Annual cash flow for each year
- **Display**: Table with Year, Cash Flow ($), Remove button

**FR-2.3: NPV Calculation**
- **Trigger**: "Calculate NPV" button
- **API**: `POST /api/project/npv` (existing endpoint)
- **Results Display**:
  - **Large NPV Value** (prominent display)
  - **Decision Indicator**:
    - Green checkmark + "Project should be accepted (NPV > 0)"
    - Red X + "Project should be rejected (NPV ≤ 0)"
  - **Metrics Grid**:
    - IRR (Internal Rate of Return)
    - Initial Cost
    - Required Return
    - Project Duration
  - **Discount Table**:
    - Year-by-year breakdown
    - Columns: Year, Cash Flow, Discount Factor, Present Value
    - Includes Year 0 (initial cost)

#### 4.2.2 DCF Valuation Tab

**FR-2.4: Company Fundamentals Input**
- **Fields**:
  - Ticker Symbol
  - Forecast Period (Years)
  - Current Revenue ($B)
  - Revenue Growth Rate (%)
  - FCF Margin (%)
  - Terminal Growth Rate (%)

**FR-2.5: WACC Parameters Input**
- **Fields**:
  - Risk-Free Rate (%)
  - Market Risk Premium (%)
  - Beta
  - Cost of Debt (%)
  - Tax Rate (%)
  - Debt/Equity Ratio

**FR-2.6: DCF Results Display**
- **API**: `POST /api/valuations/calculate`
- **Display**:
  - Summary cards: Enterprise Value, Equity Value, WACC, Intrinsic Value/Share
  - FCF Projections table (if available)
  - Year-by-year breakdown

#### 4.2.3 Portfolio Optimization Tab

**FR-2.7: Asset Management**
- **Add Assets**:
  - Ticker input field
  - "Add Asset" button
  - Display list of added assets with remove option
- **Validation**: Minimum 2 assets required for optimization

**FR-2.8: Optimization Parameters**
- **Fields**:
  - Target Return (%)
  - Risk-Free Rate (%)
  - Max Weight per Asset (%)
  - Min Weight per Asset (%)
- **Strategy Selection**: Dropdown with options:
  - Maximum Sharpe Ratio (default)
  - Minimum Variance
  - Target Return
  - Risk Parity
  - DCF-Weighted
  - Equal Weight

**FR-2.9: Portfolio Optimization Results**
- **API**: `POST /api/portfolios/optimize`
- **Display**:
  - **Summary Metrics**:
    - Expected Return (%)
    - Volatility (%)
    - Sharpe Ratio
  - **Optimal Asset Weights Table**:
    - Ticker
    - Weight (%)
    - Expected Return
    - Volatility
    - Contribution to Return
    - Contribution to Risk
  - **Efficient Frontier Chart** (optional):
    - API: `POST /api/portfolios/efficient-frontier`
    - Scatter plot showing risk vs return
    - Highlight max Sharpe and min variance points

#### 4.2.4 Sentiment Analysis Tab

**FR-2.10: Sentiment Analysis Input**
- **Field**: Ticker symbol input
- **Trigger**: "Analyze Sentiment" button

**FR-2.11: Sentiment Results Display**
- **API**: `POST /api/sentiment/analyze`
- **Display**:
  - **Overall Sentiment Score**:
    - Large display with color coding
    - Label: Positive/Neutral/Negative
    - Score value (-1 to +1)
  - **Sentiment Metrics**:
    - Sentiment Trend (improving/declining/stable)
    - Average Sentiment (7d, 30d)
    - News Volume (7d, 30d)
    - Positive/Negative Ratio
    - Confidence Score
  - **Recent News Articles**:
    - API: `GET /api/sentiment/news/{ticker}`
    - Display top 5-10 articles
    - Each article shows:
      - Headline
      - Summary
      - Source
      - Published date
      - Sentiment score (color-coded)
      - Link to full article

### 4.3 Risk Analytics Module (New Feature)

**FR-3.1: Risk Analysis Input**
- **Mode Selection**: Single Asset or Portfolio
- **Single Asset Mode**:
  - Ticker input
  - Benchmark ticker (default: SPY)
  - Lookback days (default: 252)
  - Risk-free rate
- **Portfolio Mode**:
  - Multiple tickers with weights
  - Benchmark ticker
  - Lookback days
  - Risk-free rate

**FR-3.2: Risk Metrics Display**
- **API**: `POST /api/risk/analyze`
- **Display Sections**:
  - **Volatility Metrics**:
    - Volatility (annualized)
    - Downside Volatility
  - **Market Risk**:
    - Beta
    - Alpha
    - R-squared
  - **Downside Risk**:
    - VaR (95%, 99%)
    - CVaR (95%)
    - Maximum Drawdown
    - Max Drawdown Duration (days)
  - **Risk-Adjusted Returns**:
    - Sharpe Ratio
    - Sortino Ratio
    - Calmar Ratio
  - **Distribution**:
    - Skewness
    - Kurtosis

**FR-3.3: Portfolio Risk Decomposition**
- **API**: `POST /api/risk/portfolio-decomposition`
- **Display**:
  - Total Risk breakdown
  - Systematic vs Idiosyncratic Risk
  - Marginal VaR by asset
  - Component VaR by asset
  - Percent Contribution to Risk (pie chart or bar chart)

---

## 5. UI/UX Specifications

### 5.1 Design Themes

#### 5.1.1 Stock Valuation Page (Dark Theme)
- **Background**: Dark (#0a0a0a to #111827 gradient)
- **Text**: Light (#f8fafc, #e4e4e7)
- **Accents**: Indigo (#6366f1), Blue (#60a5fa)
- **Panels**: Dark with subtle borders (rgba(255, 255, 255, 0.1))
- **Animations**: Noise canvas background, smooth transitions

#### 5.1.2 Project NPV Page (Light Theme)
- **Background**: White (#ffffff)
- **Text**: Dark (#0f0f0f, #1f1f1f)
- **Accents**: Black (#0f0f0f) for primary actions
- **Panels**: Light gray (#fafafa) with black borders (#1a1a1a)
- **Animations**: Minimal, clean geometric patterns (disabled per user preference)

### 5.2 Component Library

#### 5.2.1 Input Components
- **Text Input**: Rounded borders, focus states, placeholder text
- **Number Input**: Step controls, validation feedback
- **Slider**: Custom styled with value display
- **Dropdown/Select**: Custom styled dropdowns
- **Button**: Primary (filled), Secondary (outlined), Tertiary (text)

#### 5.2.2 Display Components
- **Summary Cards**: 
  - 4-column grid on desktop
  - 2-column on tablet
  - 1-column on mobile
  - Color-coded (primary, success, warning, info)
- **Data Tables**:
  - Sortable columns
  - Hover states
  - Responsive (horizontal scroll on mobile)
- **Charts**:
  - Chart.js for 2D charts
  - Plotly for 3D visualizations
  - Responsive sizing
  - Dark/light theme variants

#### 5.2.3 Navigation
- **Header**: Fixed top, logo + title
- **Nav Bar**: Horizontal tabs with active state
- **Breadcrumbs**: (Optional) for deep navigation
- **Footer**: Links, copyright, social

### 5.3 Responsive Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px
- **Large Desktop**: > 1600px

### 5.4 Loading States

- **Global Loading Overlay**: Full-screen with "Calculating..." text
- **Section Loading**: Skeleton screens or spinners
- **Button Loading**: Disabled state with loading text
- **Chart Loading**: Placeholder with "Generating chart..." message

### 5.5 Error Handling

- **API Errors**: 
  - Toast notifications (non-blocking)
  - Inline error messages (form validation)
  - Error panels (critical errors)
- **Network Errors**: 
  - Retry button
  - Offline indicator
  - Fallback to cached data (if available)
- **Validation Errors**:
  - Real-time field validation
  - Error messages below inputs
  - Red border on invalid fields

---

## 6. API Integration

### 6.1 API Base Configuration

**Base URL**: Configurable via:
1. `window.API_BASE_URL` (JavaScript variable)
2. `<meta name="dcf-api-base">` tag
3. URL query parameter `?api=...`
4. LocalStorage key `dcfApiBase`
5. Default: `http://localhost:8000`

**Health Check**: `GET /health` on page load

### 6.2 Endpoint Mapping

#### 6.2.1 Valuations Endpoints

| Front-End Feature | API Endpoint | Method | Request Body | Response |
|------------------|--------------|--------|--------------|----------|
| DCF Calculation | `/api/valuations/calculate` | POST | `DCFParameters` | `DCFResult` |
| Multi-Scenario | `/api/valuations/scenarios` | POST | `DCFParameters` | `MultiScenarioResponse` |
| Sensitivity | `/api/valuations/sensitivity` | POST | `DCFParameters` + query params | `SensitivityResponse` |

#### 6.2.2 Portfolio Endpoints

| Front-End Feature | API Endpoint | Method | Request Body | Response |
|------------------|--------------|--------|--------------|----------|
| Optimize Portfolio | `/api/portfolios/optimize` | POST | `PortfolioOptimizationRequest` | `PortfolioResponse` |
| Efficient Frontier | `/api/portfolios/efficient-frontier` | POST | `EfficientFrontierRequest` | `EfficientFrontierResponse` |

#### 6.2.3 Sentiment Endpoints

| Front-End Feature | API Endpoint | Method | Request Body | Response |
|------------------|--------------|--------|--------------|----------|
| Analyze Sentiment | `/api/sentiment/analyze` | POST | `SentimentRequest` | `SentimentSummaryResponse` |
| Get News | `/api/sentiment/news/{ticker}` | GET | Query: `days` | `List[NewsArticleResponse]` |

#### 6.2.4 Risk Endpoints

| Front-End Feature | API Endpoint | Method | Request Body | Response |
|------------------|--------------|--------|--------------|----------|
| Risk Analysis | `/api/risk/analyze` | POST | `RiskAnalysisRequest` | `RiskMetricsResponse` |
| Risk Decomposition | `/api/risk/portfolio-decomposition` | POST | Query: `tickers`, `weights`, `lookback_days` | `PortfolioRiskResponse` |

#### 6.2.5 Assets Endpoints

| Front-End Feature | API Endpoint | Method | Request Body | Response |
|------------------|--------------|--------|--------------|----------|
| Asset Info | `/api/assets/{ticker}` | GET | - | Asset metadata object |

### 6.3 Request/Response Handling

**Request Format**:
```javascript
{
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(requestData)
}
```

**Response Handling**:
- Success: Parse JSON and update UI
- Error: Extract `detail` from error response, display user-friendly message
- Timeout: 30-second timeout, show retry option

**Error Response Format**:
```json
{
  "detail": "Error message here"
}
```

### 6.4 Data Transformation

**Front-End → Backend**:
- Convert percentages to decimals (divide by 100)
- Convert billions to raw values (multiply by 1e9) if needed
- Format dates as ISO strings

**Backend → Front-End**:
- Convert decimals to percentages (multiply by 100)
- Format large numbers (B for billions, M for millions, K for thousands)
- Format currency with $ symbol
- Format dates for display

---

## 7. Technical Specifications

### 7.1 Technology Stack

**Core**:
- HTML5, CSS3, JavaScript (ES6+)
- No framework dependencies (vanilla JS for performance)

**Libraries**:
- **Chart.js 3.9.1**: 2D charts (line, bar, scatter)
- **Plotly.js 2.27.0**: 3D visualizations (surface plots)
- **Simplex Noise**: Background animations (optional)

**Build Tools**:
- No build step required (vanilla JS)
- Optional: Minification for production

### 7.2 File Structure

```
frontend/public/
├── index.html                 # Stock Valuation page
├── project-npv.html          # Project NPV page
├── css/
│   ├── variables.css         # CSS variables
│   ├── base.css              # Base styles
│   ├── layout.css            # Layout styles
│   ├── components.css        # Component styles
│   ├── animations.css        # Animation styles
│   └── responsive.css        # Responsive styles
├── js/
│   ├── main.js               # Stock Valuation logic
│   ├── npv-module.js         # Project NPV calculator
│   ├── portfolio-module.js   # Portfolio & DCF integration
│   ├── ticker-handler.js     # Ticker input handling
│   └── lib/
│       └── simplex-noise.js  # Noise animation library
└── assets/                   # Images, icons, etc.
```

### 7.3 JavaScript Architecture

**Module Pattern**: Each feature in separate module file
- `main.js`: Stock Valuation page logic
- `npv-module.js`: Project NPV calculator
- `portfolio-module.js`: DCF, Portfolio, Sentiment integration
- `ticker-handler.js`: Ticker input and validation

**Global Functions**: Exposed via `window` object for inline handlers
- `calculateValuation()`
- `calculateNPV()`
- `calculateDCF()`
- `optimizePortfolio()`
- `analyzeSentiment()`

**State Management**: 
- `window.appState`: Global application state
- `localStorage`: User preferences, portfolio data
- `sessionStorage`: Temporary session data

### 7.4 Performance Requirements

- **Initial Load**: < 2 seconds
- **API Response**: Display loading state, timeout after 30s
- **Chart Rendering**: < 1 second for standard charts
- **3D Visualization**: Progressive loading, show placeholder first
- **Responsive**: Smooth transitions, no layout shift

### 7.5 Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Features Used**: 
  - ES6+ (async/await, arrow functions, destructuring)
  - CSS Grid, Flexbox
  - Fetch API
  - LocalStorage/SessionStorage

---

## 8. Design System

### 8.1 Color Palette

#### Dark Theme (Stock Valuation)
- **Background**: `#0a0a0a`, `#111827`, `#1f2937`
- **Surface**: `#111827`, `#1f2937`
- **Text Primary**: `#f8fafc`, `#e4e4e7`
- **Text Secondary**: `#a1a1aa`, `#71717a`
- **Accent Primary**: `#6366f1` (Indigo)
- **Accent Secondary**: `#60a5fa` (Blue)
- **Success**: `#10b981` (Green)
- **Warning**: `#fbbf24` (Yellow)
- **Error**: `#ef4444` (Red)

#### Light Theme (Project NPV)
- **Background**: `#ffffff`
- **Surface**: `#fafafa`, `#fdfdfd`
- **Text Primary**: `#0f0f0f`, `#1f1f1f`
- **Text Secondary**: `#5a5a5a`
- **Accent Primary**: `#0f0f0f` (Black)
- **Borders**: `#1a1a1a`, `#e5e5e5`
- **Success**: `#10b981`
- **Warning**: `#fbbf24`
- **Error**: `#ef4444`

### 8.2 Typography

- **Font Family**: 'Inter', system-ui, -apple-system, sans-serif
- **Headings**:
  - H1: 2rem, weight 700
  - H2: 1.5rem, weight 600
  - H3: 1.125rem, weight 600
- **Body**: 0.875rem, weight 400
- **Labels**: 0.75rem, weight 500, uppercase, letter-spacing 0.05em

### 8.3 Spacing

- **Base Unit**: 0.25rem (4px)
- **Common Spacings**: 0.5rem, 0.75rem, 1rem, 1.5rem, 2rem, 3rem
- **Grid Gap**: 1rem (16px)

### 8.4 Border Radius

- **Small**: 4px (buttons, inputs)
- **Medium**: 8px (panels, cards)
- **Large**: 12px (modals, large containers)

### 8.5 Shadows

- **Light**: `0 1px 3px rgba(0, 0, 0, 0.1)`
- **Medium**: `0 4px 6px rgba(0, 0, 0, 0.1)`
- **Heavy**: `0 10px 25px rgba(0, 0, 0, 0.2)`

---

## 9. User Flows

### 9.1 Stock Valuation Flow

```
1. User lands on Stock Valuation page
2. Enters ticker symbol (default: CMG)
3. Clicks "Calculate Valuation" or presses Enter
4. System fetches company data from /api/assets/{ticker}
5. System calculates DCF using /api/valuations/calculate
6. Results displayed:
   - Valuation summary cards
   - DCF value slider
   - Financial projections chart
   - Detailed table (toggleable)
7. User can:
   - Adjust forecast period slider
   - Adjust terminal growth slider
   - Click scenario tabs (Worst/Base/Best)
   - Run sensitivity analysis
   - View detailed financial table
```

### 9.2 Portfolio Optimization Flow

```
1. User navigates to Project NPV page → Portfolio Optimization tab
2. Adds assets one by one (minimum 2)
3. Sets optimization parameters:
   - Strategy (dropdown)
   - Target return
   - Risk-free rate
   - Min/max weights
4. Clicks "Optimize Portfolio"
5. System calls /api/portfolios/optimize
6. Results displayed:
   - Expected return, volatility, Sharpe ratio
   - Optimal weights table
   - (Optional) Efficient frontier chart
7. User can:
   - Adjust parameters and re-optimize
   - Add/remove assets
   - Switch strategies
   - View efficient frontier
```

### 9.3 Sentiment Analysis Flow

```
1. User navigates to Project NPV page → Sentiment Analysis tab
2. Enters ticker symbol
3. Clicks "Analyze Sentiment"
4. System calls:
   - /api/sentiment/analyze (summary)
   - /api/sentiment/news/{ticker} (articles)
5. Results displayed:
   - Overall sentiment score (large display)
   - Sentiment metrics (trend, averages, ratios)
   - Recent news articles with sentiment scores
6. User can:
   - Click article links to read full story
   - See sentiment trend over time
   - Filter articles by sentiment
```

### 9.4 Project NPV Flow

```
1. User navigates to Project NPV page → Project NPV tab
2. Enters:
   - Initial cost (negative value)
   - Required return (%)
   - Annual cash flows for each year
3. Can add/remove years as needed
4. Clicks "Calculate NPV"
5. System calls /api/project/npv
6. Results displayed:
   - NPV value (prominent)
   - Accept/Reject decision
   - IRR, initial cost, required return, duration
   - Discount table (year-by-year breakdown)
7. User can:
   - Modify cash flows and recalculate
   - Add/remove years
   - Export results
```

---

## 10. Success Metrics

### 10.1 User Engagement

- **Page Views**: Track views per page
- **Feature Usage**: Track which features are used most
- **Session Duration**: Average time on platform
- **Return Rate**: Users returning within 7 days

### 10.2 Performance Metrics

- **Page Load Time**: < 2 seconds
- **API Response Time**: < 5 seconds for calculations
- **Chart Render Time**: < 1 second
- **Error Rate**: < 1% of API calls

### 10.3 User Satisfaction

- **Task Completion Rate**: % of users completing primary tasks
- **Error Recovery**: % of users successfully recovering from errors
- **Feature Discovery**: % of users discovering advanced features

---

## 11. Implementation Phases

### Phase 1: Core Functionality (Week 1-2)
- ✅ Stock Valuation page (existing)
- ✅ Project NPV calculator (existing)
- ✅ Basic DCF integration
- ✅ Navigation between pages

### Phase 2: Enhanced Features (Week 3-4)
- ✅ Portfolio Optimization UI
- ✅ Sentiment Analysis UI
- ✅ Multi-scenario analysis
- ✅ Sensitivity analysis visualization

### Phase 3: Advanced Features (Week 5-6)
- ⏳ Risk Analytics module
- ⏳ Efficient Frontier visualization
- ⏳ Portfolio risk decomposition
- ⏳ Export functionality (PDF, CSV)

### Phase 4: Polish & Optimization (Week 7-8)
- ⏳ Performance optimization
- ⏳ Mobile responsiveness
- ⏳ Accessibility improvements
- ⏳ Error handling refinement
- ⏳ User testing & feedback

---

## 12. API Request/Response Examples

### 12.1 DCF Calculation Request

```javascript
POST /api/valuations/calculate
Content-Type: application/json

{
  "ticker": "AAPL",
  "forecast_period": 10,
  "revenue_growth_start": 0.08,
  "ebit_margin_start": 0.25,
  "terminal_growth": 0.025,
  "risk_free_rate": 0.045,
  "erp": 0.055
}
```

### 12.2 Portfolio Optimization Request

```javascript
POST /api/portfolios/optimize
Content-Type: application/json

{
  "assets": [
    {"ticker": "AAPL"},
    {"ticker": "MSFT"},
    {"ticker": "GOOGL"}
  ],
  "strategy": "max_sharpe",
  "constraints": {
    "min_weight": 0.0,
    "max_weight": 0.4,
    "target_return": null
  },
  "lookback_days": 252,
  "risk_free_rate": 0.045
}
```

### 12.3 Sentiment Analysis Request

```javascript
POST /api/sentiment/analyze
Content-Type: application/json

{
  "ticker": "AAPL",
  "days": 30
}
```

### 12.4 Risk Analysis Request

```javascript
POST /api/risk/analyze
Content-Type: application/json

{
  "ticker": "AAPL",
  "benchmark_ticker": "SPY",
  "lookback_days": 252,
  "risk_free_rate": 0.045
}
```

---

## 13. Future Enhancements

### 13.1 Planned Features

1. **Portfolio Tracking**: Save and track multiple portfolios
2. **Comparison Tools**: Compare multiple stocks side-by-side
3. **Export Reports**: Generate PDF reports with charts
4. **Watchlists**: Create and manage stock watchlists
5. **Alerts**: Set price and sentiment alerts
6. **Historical Analysis**: View historical valuations
7. **Backtesting**: Test portfolio strategies on historical data

### 13.2 Technical Improvements

1. **Caching**: Implement client-side caching for API responses
2. **Offline Mode**: Service worker for offline functionality
3. **Real-time Updates**: WebSocket integration for live data
4. **Progressive Web App**: PWA capabilities
5. **Internationalization**: Multi-language support

---

## 14. Dependencies & Requirements

### 14.1 External Dependencies

- **Chart.js**: CDN (https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js)
- **Plotly.js**: CDN (https://cdn.plot.ly/plotly-2.27.0.min.js)
- **Google Fonts**: Inter font family

### 14.2 Backend Requirements

- FastAPI backend running on port 8000 (default)
- CORS enabled for front-end origin
- All API endpoints documented in this PRD
- Health check endpoint at `/health`

### 14.3 Environment Variables

- `API_BASE_URL`: Backend API base URL (optional, auto-detected)

---

## 15. Testing Requirements

### 15.1 Unit Testing

- Input validation functions
- Data transformation functions
- Currency/number formatting
- Date formatting

### 15.2 Integration Testing

- API endpoint integration
- Error handling
- Loading states
- Data flow validation

### 15.3 User Acceptance Testing

- Complete user flows
- Cross-browser testing
- Responsive design testing
- Accessibility testing

---

## 16. Documentation Requirements

### 16.1 User Documentation

- Quick start guide
- Feature tutorials
- FAQ section
- Video walkthroughs (optional)

### 16.2 Developer Documentation

- Code comments
- API integration guide
- Component documentation
- Deployment guide

---

## Appendix A: API Schema Reference

### A.1 DCFParameters Schema

```typescript
interface DCFParameters {
  ticker: string;
  forecast_period?: number; // 5-20, default: 10
  revenue_growth_start?: number; // -0.5 to 2.0, default: 0.08
  ebit_margin_start?: number; // 0.0 to 1.0, default: 0.25
  revenue_growth_terminal?: number; // -0.1 to 0.1, default: 0.03
  ebit_margin_terminal?: number; // 0.0 to 1.0, default: 0.20
  terminal_growth?: number; // 0.0 to 0.03, default: 0.025
  discount_rate?: number; // 0.02 to 0.30, optional
  risk_free_rate?: number; // 0.0 to 0.10, default: 0.045
  erp?: number; // 0.03 to 0.10, default: 0.055
  cost_of_debt?: number; // 0.0 to 0.15, optional
  tax_rate_start?: number; // 0.0 to 0.6, default: 0.25
}
```

### A.2 DCFResult Schema

```typescript
interface DCFResult {
  ticker: string;
  company_name?: string;
  sector?: string;
  industry?: string;
  current_price: number;
  implied_price: number;
  upside_downside: number; // percentage
  enterprise_value: number; // in billions
  equity_value: number; // in billions
  terminal_value: number; // in billions
  wacc: number; // percentage
  cost_of_equity: number; // percentage
  cost_of_debt: number; // percentage
  beta: number;
  market_cap: number; // in billions
  debt: number; // in billions
  cash: number; // in billions
  shares_outstanding: number;
  projections: ProjectionYear[];
}

interface ProjectionYear {
  year: number;
  revenue: number; // in billions
  revenue_growth_pct: number;
  ebit: number; // in billions
  ebit_margin_pct: number;
  fcf: number; // in billions
  pv_fcf: number; // in billions
  tax_rate_pct: number;
  nopat: number; // in billions
  reinvestment: number; // in billions
}
```

### A.3 PortfolioOptimizationRequest Schema

```typescript
interface PortfolioOptimizationRequest {
  assets: AssetInput[];
  strategy: string; // "max_sharpe" | "min_variance" | "target_return" | "risk_parity" | "dcf_weighted" | "equal_weight"
  constraints?: {
    min_weight?: number;
    max_weight?: number;
    target_return?: number;
    allow_short?: boolean;
  };
  lookback_days?: number; // 30-1000, default: 252
  risk_free_rate?: number; // default: 0.045
}

interface AssetInput {
  ticker: string;
  expected_return?: number; // optional
  dcf_upside?: number; // for DCF-weighted strategy
}
```

### A.4 SentimentSummaryResponse Schema

```typescript
interface SentimentSummaryResponse {
  ticker: string;
  overall_sentiment: number; // -1 to 1
  sentiment_trend: string; // "improving" | "declining" | "stable"
  avg_sentiment_7d: number;
  avg_sentiment_30d: number;
  news_volume_7d: number;
  news_volume_30d: number;
  positive_ratio: number; // 0 to 1
  negative_ratio: number; // 0 to 1
  sentiment_adjustment: number;
  confidence: number; // 0 to 1
  last_updated: string; // ISO datetime
}
```

### A.5 RiskMetricsResponse Schema

```typescript
interface RiskMetricsResponse {
  ticker?: string;
  volatility: number; // annualized
  downside_volatility: number;
  beta: number;
  alpha: number;
  r_squared: number; // 0 to 1
  var_95: number; // Value at Risk 95%
  var_99: number; // Value at Risk 99%
  cvar_95: number; // Conditional VaR 95%
  max_drawdown: number; // 0 to 1
  max_drawdown_duration: number; // days
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  skewness: number;
  kurtosis: number;
}
```

---

## Appendix B: Error Codes & Messages

### B.1 API Error Handling

| HTTP Code | Meaning | User Message |
|-----------|---------|--------------|
| 400 | Bad Request | "Please check your input values and try again" |
| 404 | Not Found | "The requested resource was not found" |
| 500 | Server Error | "An error occurred on the server. Please try again later" |
| 503 | Service Unavailable | "The service is temporarily unavailable. Please try again in a moment" |
| Timeout | Request Timeout | "The request took too long. Please try again" |

### B.2 Validation Errors

- **Ticker**: "Please enter a valid ticker symbol"
- **Required Return**: "Required return must be greater than 0"
- **Cash Flows**: "Please enter valid numeric values for all cash flows"
- **Portfolio Assets**: "Please add at least 2 assets to optimize portfolio"
- **Forecast Period**: "Forecast period must be between 5 and 20 years"

---

## Appendix C: Accessibility Requirements

### C.1 WCAG 2.1 Compliance

- **Level AA** compliance target
- Keyboard navigation support
- Screen reader compatibility
- Color contrast ratios (4.5:1 for text)
- Focus indicators
- ARIA labels where needed

### C.2 Keyboard Shortcuts

- `Enter`: Submit forms
- `Tab`: Navigate between inputs
- `Escape`: Close modals/overlays
- `Ctrl/Cmd + K`: Focus search (if implemented)

---

## Document Control

**Version History**:
- v2.0 (Dec 1, 2025): Initial PRD based on backend v2.0
- Future versions will track front-end implementation progress

**Approval**:
- [ ] Product Owner
- [ ] Technical Lead
- [ ] Design Lead
- [ ] QA Lead

**Next Review Date**: TBD

---

**End of PRD**


# Frontend Implementation Plan
## Portfolio Management Platform v2.0

Based on FRONTEND_PRD.md specifications

---

## Implementation Status

### ✅ Completed (Existing)
- Stock Valuation page (index.html) - Dark theme DCF analysis
- Basic Project NPV calculator
- CSS framework and styling system
- Chart.js and Plotly integration
- Basic API integration structure

### 🔄 In Progress
- Enhanced Project NPV page with 4 tabs
- Backend API v2.0 integration
- Risk Analytics module

### 📋 To Be Implemented

#### Phase 1: Core Tab Functionality (Priority 1)

**1. Project NPV Calculator Tab** ✓ (Existing, needs enhancement)
- Cash flow management (add/remove years)
- NPV calculation with discount table
- IRR calculation
- Decision indicator (Accept/Reject)
- API: `POST /api/project/npv` (existing endpoint)

**2. DCF Valuation Tab** (NEW - Backend v2.0 integration)
- Company fundamentals input
- WACC parameters
- DCF calculation results
- FCF projections table
- API: `POST /api/valuations/calculate`

**3. Portfolio Optimization Tab** (NEW)
- Asset management (add/remove tickers)
- Strategy selection (6 strategies)
- Optimization parameters
- Results display with optimal weights
- Efficient frontier visualization
- API: `POST /api/portfolios/optimize`, `POST /api/portfolios/efficient-frontier`

**4. Sentiment Analysis Tab** (NEW)
- Ticker input
- Sentiment summary display
- News articles list with sentiment scores
- Trend visualization
- API: `POST /api/sentiment/analyze`, `GET /api/sentiment/news/{ticker}`

#### Phase 2: Advanced Features (Priority 2)

**5. Risk Analytics Module** (NEW)
- Single asset risk analysis
- Portfolio risk decomposition
- 15+ risk metrics display
- Risk contribution charts
- API: `POST /api/risk/analyze`, `POST /api/risk/portfolio-decomposition`

**6. Multi-Scenario Analysis**
- Already in index.html for stock valuation
- Add to DCF tab in project-npv.html
- Scenario comparison table

**7. Sensitivity Analysis**
- Already in index.html
- Add to DCF tab for project analysis
- 3D surface plot

#### Phase 3: Polish & Optimization (Priority 3)

**8. Charts & Visualizations**
- Revenue projection charts
- Portfolio allocation pie charts
- Efficient frontier scatter plots
- Risk decomposition bar charts
- Sentiment trend line charts

**9. Mobile Responsiveness**
- Tab navigation on mobile
- Collapsible sections
- Touch-friendly inputs
- Responsive tables

**10. Error Handling & Validation**
- Input validation
- API error messages
- Loading states
- Empty state handling

---

## File Structure Plan

```
frontend/public/
├── index.html                 ✓ Stock Valuation (dark theme)
├── project-npv.html          🔄 Project NPV with 4 tabs (light theme)
├── css/
│   ├── variables.css         ✓
│   ├── base.css              ✓
│   ├── layout.css            ✓
│   ├── components.css        ✓
│   ├── animations.css        ✓
│   └── responsive.css        ✓
├── js/
│   ├── main.js               ✓ Stock valuation logic
│   ├── npv-module.js         ✓ NPV calculator
│   ├── portfolio-module.js   🆕 Portfolio & DCF for project-npv.html
│   ├── sentiment-module.js   🆕 Sentiment analysis
│   ├── risk-module.js        🆕 Risk analytics
│   ├── api-client.js         🆕 Shared API utilities
│   ├── chart-utils.js        🆕 Chart rendering helpers
│   └── lib/
│       └── simplex-noise.js  ✓
└── assets/                   ✓
```

---

## Tab Implementation Details

### Tab 1: Project NPV Calculator

**Status**: Existing, needs minor enhancements

**Features**:
- ✓ Initial cost input
- ✓ Required return input
- ✓ Cash flow management (5 years default)
- ✓ Add/remove year buttons
- ✓ Calculate NPV button
- ✓ NPV result display
- 🆕 IRR calculation
- 🆕 Discount table with year-by-year breakdown
- 🆕 Accept/Reject decision indicator

**API**:
```javascript
POST /api/project/npv
Request: {
  initial_cost: number,
  required_return: number,
  cash_flows: number[]
}
Response: {
  npv: number,
  irr: number,
  discount_table: [{year, cash_flow, discount_factor, present_value}]
}
```

### Tab 2: DCF Valuation

**Status**: NEW - Integrates with backend v2.0

**Sections**:
1. **Company Fundamentals** (left column)
   - Ticker symbol
   - Current revenue ($B)
   - Revenue growth rate (%)
   - FCF margin (%)
   - Terminal growth rate (%)
   - Forecast period (years)

2. **WACC Parameters** (left column)
   - Risk-free rate (%)
   - Market risk premium (%)
   - Beta
   - Cost of debt (%)
   - Tax rate (%)
   - Debt/Equity ratio

3. **Results Display** (right column)
   - Summary cards: Enterprise Value, Equity Value, WACC, Intrinsic Value/Share
   - FCF Projections table (if available)
   - Charts (optional)

**API**:
```javascript
POST /api/valuations/calculate
Request: DCFParameters
Response: DCFResult
```

### Tab 3: Portfolio Optimization

**Status**: NEW

**Sections**:
1. **Asset Management** (top)
   - Ticker input field
   - "Add Asset" button
   - List of added assets (chips with remove button)
   - Minimum 2 assets required

2. **Optimization Parameters** (left)
   - Strategy dropdown (6 options)
   - Target return (%)
   - Risk-free rate (%)
   - Max weight per asset (%)
   - Min weight per asset (%)
   - Lookback days (default: 252)

3. **Results** (right)
   - Summary metrics: Expected Return, Volatility, Sharpe Ratio
   - Optimal asset weights table
   - Efficient frontier chart (optional, toggle)

**API**:
```javascript
POST /api/portfolios/optimize
POST /api/portfolios/efficient-frontier (for chart)
```

### Tab 4: Sentiment Analysis

**Status**: NEW

**Sections**:
1. **Input** (top)
   - Ticker symbol
   - "Analyze Sentiment" button

2. **Results** (layout: 2 columns on desktop, 1 on mobile)
   - **Left Column**:
     - Overall Sentiment Score (large, color-coded)
     - Sentiment Metrics cards:
       - Sentiment Trend
       - Avg Sentiment (7d, 30d)
       - News Volume (7d, 30d)
       - Positive/Negative Ratio
       - Confidence Score

   - **Right Column**:
     - Recent News Articles (top 5-10)
     - Each article:
       - Headline
       - Summary (truncated)
       - Source & date
       - Sentiment score (color badge)
       - Link to full article

**API**:
```javascript
POST /api/sentiment/analyze
GET /api/sentiment/news/{ticker}?days=7
```

---

## JavaScript Module Plan

### api-client.js (NEW)
```javascript
// Shared API utility functions
function getApiBaseUrl() { }
function apiCall(endpoint, options) { }
function handleApiError(error) { }
```

### portfolio-module.js (ENHANCE)
```javascript
// Portfolio optimization logic
function addAsset(ticker) { }
function removeAsset(ticker) { }
function optimizePortfolio() { }
function renderEfficientFrontier() { }
```

### sentiment-module.js (NEW)
```javascript
// Sentiment analysis logic
function analyzeSentiment(ticker) { }
function displaySentimentSummary(data) { }
function displayNewsArticles(articles) { }
```

### risk-module.js (NEW)
```javascript
// Risk analytics logic
function analyzeRisk(params) { }
function displayRiskMetrics(data) { }
function renderRiskCharts(data) { }
```

### chart-utils.js (NEW)
```javascript
// Shared chart rendering utilities
function createLineChart(ctx, data) { }
function createBarChart(ctx, data) { }
function createPieChart(ctx, data) { }
function createScatterChart(ctx, data) { }
function create3DSurfacePlot(div, data) { }
```

---

## Navigation Implementation

**Header Navigation** (Both pages)
```html
<nav class="main-nav">
  <a href="index.html" class="nav-link">Stock Valuation</a>
  <a href="project-npv.html" class="nav-link active">Project NPV</a>
</nav>
```

**Tab Navigation** (project-npv.html only)
```html
<div class="tab-navigation">
  <button class="tab-btn active" onclick="showTab('npv')">Project NPV</button>
  <button class="tab-btn" onclick="showTab('dcf')">DCF Valuation</button>
  <button class="tab-btn" onclick="showTab('portfolio')">Portfolio Optimization</button>
  <button class="tab-btn" onclick="showTab('sentiment')">Sentiment Analysis</button>
</div>
```

---

## API Integration Checklist

### Valuations Endpoints
- [x] `GET /health` - Health check
- [ ] `POST /api/valuations/calculate` - DCF calculation (Tab 2)
- [ ] `POST /api/valuations/scenarios` - Multi-scenario (future)
- [ ] `POST /api/valuations/sensitivity` - Sensitivity analysis (future)

### Portfolio Endpoints
- [ ] `POST /api/portfolios/optimize` - Portfolio optimization (Tab 3)
- [ ] `POST /api/portfolios/efficient-frontier` - Efficient frontier (Tab 3)

### Sentiment Endpoints
- [ ] `POST /api/sentiment/analyze` - Sentiment summary (Tab 4)
- [ ] `GET /api/sentiment/news/{ticker}` - News articles (Tab 4)

### Risk Endpoints
- [ ] `POST /api/risk/analyze` - Risk metrics (future Phase 2)
- [ ] `POST /api/risk/portfolio-decomposition` - Risk decomposition (future Phase 2)

### Assets Endpoints
- [ ] `GET /api/assets/{ticker}` - Asset metadata (optional)

### Project NPV (Existing)
- [x] `POST /api/project/npv` - NPV calculation (Tab 1)

---

## Implementation Priority

### Sprint 1 (Days 1-3)
1. ✅ Update backend API integration
2. 🔄 Enhance Tab 1 (Project NPV) with IRR and discount table
3. 🆕 Implement Tab 2 (DCF Valuation) - basic version
4. 🆕 Create api-client.js module

### Sprint 2 (Days 4-6)
5. 🆕 Implement Tab 3 (Portfolio Optimization) - basic version
6. 🆕 Implement Tab 4 (Sentiment Analysis) - basic version
7. 🆕 Create portfolio-module.js and sentiment-module.js
8. Test all API integrations

### Sprint 3 (Days 7-9)
9. Add efficient frontier visualization (Tab 3)
10. Add charts for DCF projections (Tab 2)
11. Add sentiment trend visualization (Tab 4)
12. Polish responsive design

### Sprint 4 (Days 10-12)
13. Risk Analytics module (Phase 2)
14. Multi-scenario & sensitivity for DCF tab
15. Error handling improvements
16. Final testing and optimization

---

## Testing Plan

### Unit Tests
- [ ] Input validation functions
- [ ] Data transformation (percentages, currency)
- [ ] API request/response handling

### Integration Tests
- [ ] All API endpoints
- [ ] Tab navigation
- [ ] Form submissions
- [ ] Chart rendering

### Manual Tests
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness (iPhone, Android, iPad)
- [ ] API error scenarios
- [ ] Edge cases (empty data, invalid inputs)

---

## Deployment Checklist

### Pre-Deployment
- [ ] Minify CSS and JS
- [ ] Optimize images
- [ ] Test with production API
- [ ] Verify CORS configuration
- [ ] Check all links and navigation

### Post-Deployment
- [ ] Monitor API errors
- [ ] Track page load times
- [ ] Gather user feedback
- [ ] Performance optimization

---

## Success Metrics

### Technical
- Page load time < 2 seconds ✓
- API response time < 5 seconds
- Chart render time < 1 second
- Error rate < 1%

### User Experience
- Task completion rate > 90%
- Feature discovery rate > 70%
- User satisfaction score > 4/5

---

## Next Steps

1. **Immediate**: Implement DCF Valuation tab (Tab 2)
2. **Short-term**: Implement Portfolio & Sentiment tabs (Tab 3 & 4)
3. **Medium-term**: Add Risk Analytics module
4. **Long-term**: Advanced features (export, save portfolios, watchlists)

---

## Resources

- **PRD**: `/docs/FRONTEND_PRD.md`
- **Backend API**: `http://localhost:8000/docs`
- **Design Tokens**: `/css/variables.css`
- **Component Library**: `/css/components.css`

---

**Status**: Ready for Implementation
**Last Updated**: December 1, 2025
**Owner**: Frontend Development Team

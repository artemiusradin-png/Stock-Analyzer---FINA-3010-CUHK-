# Unified Valuation Machine - Implementation Plan

## Overview

Transform the Project NPV page into a comprehensive company valuation platform by integrating DCF (Discounted Cash Flow) analysis alongside project-level NPV calculations.

## Current State

### Existing Assets
- **Project NPV Page**: `/frontend/public/project-npv.html`
  - Manual NPV calculator (traditional view)
  - AI-powered NPV with ChatGPT OCF fetching
  - Company information panel
  - Ticker disambiguation for multiple exchanges
  - PDF/Excel export functionality

- **DCF Valuation Page**: `/frontend/public/dcf-valuation.html` (separate page)
  - Company-level DCF analysis
  - WACC calculation
  - Terminal value estimation
  - Equity value per share
  - Sensitivity analysis

- **Backend APIs**:
  - `/api/dcf/calculate` - DCF calculations
  - `/api/project/npv` - Project NPV
  - `/api/ai-npv/*` - AI-powered OCF fetching

## Target Architecture

### UI Structure
```
Project NPV Page (Unified Valuation Machine)
├── Tab 1: PROJECT NPV
│   ├── Manual NPV Calculator (existing)
│   └── AI NPV with ChatGPT (existing, enhanced)
│
└── Tab 2: COMPANY DCF
    ├── Company Information Panel (reused)
    ├── DCF Inputs Section
    │   ├── Ticker & Company Lookup
    │   ├── Forecast Assumptions
    │   ├── Capital Structure
    │   └── Discount Rate (WACC)
    ├── DCF Results Section
    │   ├── Free Cash Flow Table
    │   ├── Valuation Summary
    │   ├── Implied Price vs Market
    │   └── Sensitivity Analysis
    └── Export Options (PDF/Excel)
```

## Implementation Phases

### Phase 1: UI Integration (Files to Modify)

#### 1.1 Update project-npv.html
- Add "Company DCF" tab button next to "Project NPV"
- Create new tab content section for DCF
- Maintain existing NPV functionality unchanged
- Ensure consistent styling across tabs

**Key Changes**:
```html
<!-- Add new tab button -->
<button class="npv-tab-btn" data-tab="company-dcf-tab">
    Company DCF
</button>

<!-- Add new tab content -->
<div id="company-dcf-tab" class="npv-tab-content">
    <!-- DCF interface here -->
</div>
```

#### 1.2 Create dcf-module.js
New JavaScript module for DCF functionality:
- `fetchCompanyFundamentals(ticker, exchange)` - Get company data
- `calculateDCF(inputs)` - Send DCF calculation request
- `displayDCFResults(data)` - Render results
- `generateSensitivity(baseInputs)` - Sensitivity table
- `exportDCFPDF()` / `exportDCFExcel()` - Export functions

### Phase 2: DCF Input Interface

#### 2.1 Company Lookup Section
```
┌─────────────────────────────────────┐
│ Company Information                 │
├─────────────────────────────────────┤
│ Stock Ticker: [MTX    ]  [Lookup]  │
│                                     │
│ [Disambiguation Dropdown if needed] │
│                                     │
│ Company: Minerals Technologies Inc. │
│ Exchange: NYSE                      │
│ Currency: USD                       │
│ Current Price: $45.67               │
│ Market Cap: $1.5B                   │
└─────────────────────────────────────┘
```

#### 2.2 Forecast Assumptions
```
┌─────────────────────────────────────┐
│ Projection Assumptions              │
├─────────────────────────────────────┤
│ Forecast Years: [5]  (1-10)        │
│ Revenue (Year 0): [$1,200M]        │
│ Revenue Growth:   [5.0%]           │
│ EBITDA Margin:    [15.0%]          │
│ D&A % Revenue:    [4.0%]           │
│ CapEx % Revenue:  [3.5%]           │
│ ΔWC % ΔRevenue:   [10.0%]          │
│ Tax Rate:         [25.0%]          │
└─────────────────────────────────────┘
```

#### 2.3 Capital Structure
```
┌─────────────────────────────────────┐
│ Capital Structure                   │
├─────────────────────────────────────┤
│ Net Debt:         [$250M]          │
│ Cash:             [$50M]           │
│ Shares Out (M):   [32.8]           │
└─────────────────────────────────────┘
```

#### 2.4 Discount Rate (WACC)
```
┌─────────────────────────────────────┐
│ Discount Rate (WACC)                │
├─────────────────────────────────────┤
│ Risk-Free Rate:   [4.5%]           │
│ Equity Risk Prem: [5.5%]           │
│ Beta:             [1.2]            │
│ Cost of Equity:   10.1% (calculated)│
│                                     │
│ Cost of Debt:     [5.0%]           │
│ Tax Rate:         [25.0%]          │
│ After-Tax CoD:    3.75% (calculated)│
│                                     │
│ D/(D+E):          [30%]            │
│ E/(D+E):          [70%]            │
│                                     │
│ WACC:             8.2% (calculated) │
└─────────────────────────────────────┘
```

### Phase 3: DCF Results Interface

#### 3.1 Free Cash Flow Table
```
┌──────────────────────────────────────────────────────────────┐
│ Projected Free Cash Flows                                    │
├──────┬──────┬──────┬──────┬──────┬──────┬─────────────────┤
│      │ 2025 │ 2026 │ 2027 │ 2028 │ 2029 │ Terminal        │
├──────┼──────┼──────┼──────┼──────┼──────┼─────────────────┤
│ Rev  │1,260 │1,323 │1,389 │1,459 │1,532 │                 │
│ EBITDA│ 189 │ 198  │ 208  │ 219  │ 230  │                 │
│ D&A  │ (50)│ (53) │ (56) │ (58) │ (61) │                 │
│ EBIT │ 139 │ 146  │ 153  │ 161  │ 169  │                 │
│ Tax  │ (35)│ (36) │ (38) │ (40) │ (42) │                 │
│ NOPAT│ 104 │ 109  │ 115  │ 120  │ 126  │                 │
│ + D&A│  50 │  53  │  56  │  58  │  61  │                 │
│ CapEx│ (44)│ (46) │ (49) │ (51) │ (54) │                 │
│ ΔWC  │ (6) │ (6)  │ (7)  │ (7)  │ (7)  │                 │
├──────┼──────┼──────┼──────┼──────┼──────┼─────────────────┤
│ FCF  │ 104 │ 110  │ 116  │ 122  │ 128  │ $2,134 (TV)     │
│ PV   │  96 │  94  │  92  │  90  │  87  │ $1,413 (PV TV)  │
└──────┴──────┴──────┴──────┴──────┴──────┴─────────────────┘
```

#### 3.2 Valuation Summary
```
┌─────────────────────────────────────┐
│ Valuation Summary                   │
├─────────────────────────────────────┤
│ PV of Forecast FCFs:  $459M        │
│ PV of Terminal Value: $1,413M      │
│ Enterprise Value:     $1,872M      │
│                                     │
│ Less: Net Debt        ($200M)      │
│ Equity Value:         $2,072M      │
│                                     │
│ Shares Outstanding:   32.8M        │
│ Implied Price/Share:  $63.17       │
│                                     │
│ Current Market Price: $45.67       │
│ Upside/(Downside):    +38.3% ✓     │
└─────────────────────────────────────┘
```

#### 3.3 Sensitivity Analysis
```
┌─────────────────────────────────────────────────────┐
│ Sensitivity: Implied Price per WACC & Terminal Growth│
├──────────┬────────┬────────┬────────┬────────┬──────┤
│ WACC ↓   │  1.5%  │  2.0%  │  2.5%  │  3.0%  │ 3.5% │
│ TG →     │        │        │        │        │      │
├──────────┼────────┼────────┼────────┼────────┼──────┤
│  6.2%    │ $78.45 │ $82.11 │ $86.23 │ $90.89 │$96.21│
│  7.2%    │ $68.92 │ $71.34 │ $74.01 │ $76.95 │$80.21│
│  8.2%    │ $60.89 │ $63.17*│ $65.34 │ $67.89 │$70.45│
│  9.2%    │ $54.23 │ $56.12 │ $58.34 │ $60.45 │$62.89│
│ 10.2%    │ $48.56 │ $50.23 │ $52.11 │ $54.12 │$56.34│
└──────────┴────────┴────────┴────────┴────────┴──────┘
* Base case
```

### Phase 4: Backend Integration

#### 4.1 Extend /api/dcf/calculate endpoint
Ensure it accepts:
```python
{
  "ticker": "MTX",
  "exchange": "NYSE",  # For disambiguation
  "forecast_years": 5,
  "base_revenue": 1200000000,
  "revenue_growth": 0.05,
  "ebitda_margin": 0.15,
  "da_pct_revenue": 0.04,
  "capex_pct_revenue": 0.035,
  "wc_pct_revenue_change": 0.10,
  "tax_rate": 0.25,
  "net_debt": 200000000,
  "shares_outstanding": 32800000,
  "wacc": 0.082,
  "terminal_growth": 0.025,
  "sensitivity": true
}
```

Returns:
```python
{
  "fcf_projections": [...],
  "enterprise_value": 1872000000,
  "equity_value": 2072000000,
  "implied_price": 63.17,
  "current_price": 45.67,
  "upside_pct": 38.3,
  "sensitivity_matrix": {...}
}
```

#### 4.2 Enhance /api/ai-npv/fetch-company-info
Add financial fundamentals:
```python
{
  "ticker": "MTX",
  "description": "...",
  "exchange": "NYSE",
  "current_price": 45.67,
  "market_cap": 1500000000,
  "shares_outstanding": 32800000,
  "financials": {
    "revenue": 1200000000,
    "ebitda": 180000000,
    "net_debt": 200000000,
    "cash": 50000000
  }
}
```

#### 4.3 Add DCF Export Endpoints
- `/api/dcf/export/pdf` - Generate DCF PDF report
- `/api/dcf/export/excel` - Generate DCF Excel workbook

### Phase 5: Integration with Existing Features

#### 5.1 Reuse Ticker Disambiguation
- Use existing `fetchCompanyInfo()` logic
- Show dropdown when multiple exchanges detected
- Pass selected exchange to DCF calculations

#### 5.2 Reuse Company Information Panel
- Display in Company DCF tab
- Show richer financial data (market cap, shares outstanding)
- Update when user selects different company

#### 5.3 Maintain AI NPV Functionality
- Keep AI NPV tab independent
- No changes to existing OCF fetching
- Continue supporting 10-year manual entry

### Phase 6: Validation & Edge Cases

#### 6.1 Input Validation
- Forecast years: 1-10 range
- Growth rates: -100% to +500%
- Margins: 0% to 100%
- WACC: Must be positive
- Terminal growth < WACC (warn if violated)

#### 6.2 Error Handling
- Missing ticker → "Please enter a ticker"
- API failure → Show error with manual override option
- Negative equity value → Warn "Company may be distressed"
- Division by zero → Handle gracefully

#### 6.3 Currency Handling
- Display currency from company info (USD, CAD, EUR, etc.)
- Format large numbers: $1.5B, $250M, $45.67
- Consistent decimals: prices (2), percentages (1-2), ratios (2)

### Phase 7: Styling & UX Polish

#### 7.1 Visual Design
- **Primary Color**: Light background (#fafafa)
- **Accent Color**: Violet/purple (#7c3aed) for toggles
- **Text**: Dark gray (#1f2937) for primary, medium gray (#6b7280) for labels
- **Borders**: Light gray (#e5e5e5)
- **Cards**: White with subtle shadow

#### 7.2 Responsive Layout
- Two-column grid on desktop (inputs left, results right)
- Single column on mobile/tablet
- Tables scroll horizontally on small screens

#### 7.3 User Feedback
- Loading states on all API calls
- Success messages (green) for completed actions
- Error messages (red) for failures
- Disabled states during processing

## File Structure

### New Files
```
/frontend/public/js/dcf-module.js         # DCF functionality
/backend/app/api/dcf_export.py            # DCF export endpoints
/UNIFIED_VALUATION_COMPLETE.md            # Final documentation
```

### Modified Files
```
/frontend/public/project-npv.html         # Add DCF tab
/frontend/public/css/styles.css           # DCF styling (if needed)
/backend/app/api/ai_npv.py                # Enhance company info
/backend/app/services/dcf_service.py      # Extend if needed
```

## Implementation Timeline

### Sprint 1: UI Foundation (Day 1-2)
- [ ] Add "Company DCF" tab to project-npv.html
- [ ] Create basic DCF input layout
- [ ] Create basic DCF results layout
- [ ] Test tab switching

### Sprint 2: DCF Inputs (Day 3-4)
- [ ] Implement company lookup with disambiguation
- [ ] Create forecast assumptions form
- [ ] Create capital structure form
- [ ] Create WACC calculator with live updates
- [ ] Add input validation

### Sprint 3: Backend Integration (Day 5-6)
- [ ] Wire DCF inputs to /api/dcf/calculate
- [ ] Test API responses
- [ ] Handle errors gracefully
- [ ] Add loading states

### Sprint 4: Results Display (Day 7-8)
- [ ] Build FCF projection table
- [ ] Build valuation summary card
- [ ] Build sensitivity matrix
- [ ] Add upside/downside indicator

### Sprint 5: Polish & Export (Day 9-10)
- [ ] Implement PDF export for DCF
- [ ] Implement Excel export for DCF
- [ ] Final styling pass
- [ ] Comprehensive testing
- [ ] Documentation

## Testing Checklist

### Functional Tests
- [ ] Company lookup returns correct data
- [ ] Disambiguation works for ambiguous tickers
- [ ] DCF calculation produces correct results
- [ ] Sensitivity matrix updates properly
- [ ] PDF export includes all data
- [ ] Excel export formats correctly

### Edge Cases
- [ ] Invalid ticker handling
- [ ] Missing financial data
- [ ] Negative equity value
- [ ] Terminal growth > WACC
- [ ] Zero shares outstanding
- [ ] API timeout handling

### UX Tests
- [ ] Tab switching is smooth
- [ ] Forms are easy to fill
- [ ] Results are easy to read
- [ ] Mobile layout works well
- [ ] Loading states are clear
- [ ] Error messages are helpful

## Success Metrics

1. **Functionality**: Both NPV and DCF work independently
2. **Integration**: Seamless switching between modes
3. **Data Accuracy**: DCF calculations match financial models
4. **User Experience**: Intuitive, fast, professional
5. **Export Quality**: PDF/Excel reports are presentation-ready

## Risk Mitigation

### Technical Risks
- **API Complexity**: Start with simplified DCF, add features iteratively
- **Data Quality**: Allow manual override when API fails
- **Performance**: Cache company data, debounce calculations

### UX Risks
- **Complexity**: Use progressive disclosure, hide advanced options initially
- **Learning Curve**: Add tooltips and help text for financial terms
- **Mobile**: Test early and often on different screen sizes

## Future Enhancements (Post-Launch)

1. **Scenario Comparison**: Compare bull/base/bear cases side-by-side
2. **Historical Analysis**: Show actual vs. projected performance
3. **Peer Comparison**: Compare valuation vs. industry peers
4. **Monte Carlo**: Probabilistic valuation with distribution curves
5. **API Integration**: Pull real-time data from financial APIs (Alpha Vantage, Yahoo Finance)

## Documentation Deliverables

1. **User Guide**: How to use the unified valuation tool
2. **API Documentation**: Updated endpoint specifications
3. **Technical Guide**: Architecture and code organization
4. **Testing Guide**: Test procedures and expected results

---

## Next Steps

Ready to begin implementation with Sprint 1 (UI Foundation). Shall I proceed with:
1. Adding the Company DCF tab to project-npv.html
2. Creating the basic input/output layout structure
3. Setting up dcf-module.js skeleton

Let me know if you'd like any adjustments to this plan before we begin!

# AI NPV Calculator v3.6 - Data Flow Unification & Currency Support

## Overview

Version 3.6 fixes critical data flow inconsistencies identified between the Company Information display and AI NPV calculations. This release unifies data sources, adds proper currency support, and ensures that all displayed prices match the actual values used in calculations.

---

## Issues Fixed

### 1. ✅ Unified Data Source: Single Source of Truth

**Problem**: Company Information block was populated via `fetch_company_info` (showing one price), but AI NPV calculation used `fetch_cf_scenarios` (potentially different price). The blocks could disagree on the stock price, causing confusion and incorrect calculations.

**Root Cause**: Two separate API calls returned different data:
- `fetch_company_info`: Returns basic company metadata with a price estimate
- `fetch_cf_scenarios`: Returns actual scenario analysis with current market price

The Company Info was using the first price, while calculations used the second.

**Fix**: Made `fetch_cf_scenarios` the single source of truth for all price data:
1. Store company metadata (exchange, currency, country, description) from `fetch_company_info`
2. But always use `current_price_per_share` from `fetch_cf_scenarios` for display AND calculation
3. Update Company Info display after CF scenarios are fetched, using the CF price

**Code Changes**:

[frontend/public/js/ai-npv-module.js:136-158](frontend/public/js/ai-npv-module.js:136-158):
```javascript
// Store scenario data globally (now includes per-share data AND company info)
window.AI_NPV_DATA = {
    ticker: ticker,
    currentPricePerShare: data.current_price_per_share || 0,  // ← From CF scenarios
    dividendsPerShare: data.dividends_per_share || {},
    terminalPricePerShare: data.terminal_price_per_share || {},
    scenarioExplanations: data.scenario_explanation || {},
    years: data.years || [],
    // Store company info for consistent display and exports
    exchange: companyData.exchange || '',
    currency: companyData.currency || 'USD',
    country: companyData.country || '',
    description: companyData.description || ''
};

// Update Company Info display with price from CF scenarios (single source of truth)
displayCompanyInfo({
    ticker: ticker,
    description: companyData.description || '',
    exchange: companyData.exchange || '',
    currency: companyData.currency || 'USD',
    country: companyData.country || '',
    stock_price: data.current_price_per_share || 0  // ← Use CF price, not company info price
});
```

---

### 2. ✅ Fixed Disambiguation Flow to Update Price After Exchange Selection

**Problem**: When users selected a company from the disambiguation dropdown (multiple exchanges), the Company Info displayed the old price from the dropdown choice, not the actual CF scenarios price.

**Fix**: Updated `refetchOCFForExchange()` to:
1. Accept full `companyInfo` object (not just exchange string)
2. Store company metadata in `AI_NPV_DATA`
3. Update Company Info display with CF scenarios price after fetching

**Code Changes**:

[frontend/public/js/ai-npv-module.js:80-91](frontend/public/js/ai-npv-module.js:80-91):
```javascript
showCompanyChooser(matches, async (choice) => {
    console.log('User selected company:', choice);

    // Clear disambiguation UI
    const disambiguationContainer = document.getElementById('ai-ticker-disambiguation');
    if (disambiguationContainer) {
        disambiguationContainer.innerHTML = '';
    }

    // Fetch CF data for the selected exchange - this will update company info with actual price
    await refetchOCFForExchange(choice.ticker || ticker, choice);  // ← Pass full choice object
});
```

[frontend/public/js/ai-npv-module.js:1052-1104](frontend/public/js/ai-npv-module.js:1052-1104):
```javascript
async function refetchOCFForExchange(ticker, companyInfo) {
    try {
        const exchange = typeof companyInfo === 'string' ? companyInfo : companyInfo.exchange;

        // ... fetch CF scenarios ...

        // Store scenario data globally (now includes per-share data AND company info)
        window.AI_NPV_DATA = {
            ticker: ticker,
            currentPricePerShare: data.current_price_per_share || 0,
            dividendsPerShare: data.dividends_per_share || {},
            terminalPricePerShare: data.terminal_price_per_share || {},
            scenarioExplanations: data.scenario_explanation || {},
            years: data.years || [],
            // Store company info from disambiguation
            exchange: typeof companyInfo === 'object' ? (companyInfo.exchange || '') : exchange,
            currency: typeof companyInfo === 'object' ? (companyInfo.currency || 'USD') : 'USD',
            country: typeof companyInfo === 'object' ? (companyInfo.country || '') : '',
            description: typeof companyInfo === 'object' ? (companyInfo.description || companyInfo.name || '') : ''
        };

        // Update Company Info display with price from CF scenarios (single source of truth)
        displayCompanyInfo({
            ticker: ticker,
            description: window.AI_NPV_DATA.description,
            exchange: window.AI_NPV_DATA.exchange,
            currency: window.AI_NPV_DATA.currency,
            country: window.AI_NPV_DATA.country,
            stock_price: data.current_price_per_share || 0  // ← Use CF price
        });

        // ... display table ...
    }
}
```

---

### 3. ✅ Added Currency Display Throughout UI

**Problem**: All prices were shown with hardcoded `$` symbol, even for non-USD stocks (e.g., EUR, GBP, CAD). This was misleading for international stocks.

**Fix**:
1. Store currency from company info in `AI_NPV_DATA`
2. Use dynamic currency symbol in all price displays
3. Show currency symbol in: table headers, current price, terminal prices

**Code Changes**:

[frontend/public/js/ai-npv-module.js:193-206](frontend/public/js/ai-npv-module.js:193-206):
```javascript
// Get currency from AI_NPV_DATA for display
const currency = window.AI_NPV_DATA?.currency || 'USD';
const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency;

// Create scenario table with year rows and Low/Base/High columns
let html = `
    <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
            <thead>
                <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                    <th style="padding: 0.75rem; text-align: left; font-weight: 700; color: #111827; border-right: 1px solid #e5e7eb;">Year</th>
                    <th style="padding: 0.75rem; text-align: right; font-weight: 700; color: #dc2626;">Low (${currencySymbol}/share)</th>
                    <th style="padding: 0.75rem; text-align: right; font-weight: 700; color: #111827; background: #f3f4f6;">Base (${currencySymbol}/share)</th>
                    <th style="padding: 0.75rem; text-align: right; font-weight: 700; color: #059669;">High (${currencySymbol}/share)</th>
```

[frontend/public/js/ai-npv-module.js:243-247](frontend/public/js/ai-npv-module.js:243-247):
```javascript
<div style="margin-bottom: 0.5rem;"><strong>Dividends shown per share</strong> | Current price: <strong>${currencySymbol}${currentPricePerShare.toFixed(2)}/share</strong></div>
<div style="margin-bottom: 0.5rem;">Terminal prices (Year ${years.length}):
    <span style="color: #dc2626; font-weight: 600;">Low: ${currencySymbol}${terminalPricePerShare.low.toFixed(2)}</span> |
    <span style="color: #111827; font-weight: 600;">Base: ${currencySymbol}${terminalPricePerShare.base.toFixed(2)}</span> |
    <span style="color: #059669; font-weight: 600;">High: ${currencySymbol}${terminalPricePerShare.high.toFixed(2)}</span>
```

**Supported Currencies**:
- USD → `$`
- EUR → `€`
- GBP → `£`
- Others → Currency code (e.g., "CAD", "JPY")

---

### 4. ✅ Added Validation: Block NPV Calculation Without Price Data

**Problem**: Users could attempt to calculate NPV without fetching CF scenarios first, leading to errors or incorrect calculations with missing price data.

**Fix**: Added validation in `calculateAINPV()` to check for price data before allowing calculation.

**Code Changes**:

[frontend/public/js/ai-npv-module.js:454-458](frontend/public/js/ai-npv-module.js:454-458):
```javascript
// Validate that price data is available (required for AI NPV calculation)
if (!window.AI_NPV_DATA || !window.AI_NPV_DATA.currentPricePerShare || window.AI_NPV_DATA.currentPricePerShare <= 0) {
    showAINPVError('No stock price data available. Please fetch CF scenarios first by clicking "Fetch CF Scenarios from ChatGPT".');
    return;
}
```

**User Experience**:
- If user clicks "Calculate NPV" without fetching scenarios: Clear error message guiding them to fetch data first
- Prevents silent failures or incorrect calculations

---

### 5. ✅ Scenario Explanations Already Included in PDF Export

**Verification**: Code review confirmed that scenario explanations (`scenario_explanation`) are already:
1. Fetched from backend via `fetch_cf_scenarios`
2. Stored in `AI_NPV_DATA.scenarioExplanations`
3. Passed to PDF export endpoint
4. Used to generate 150-word professional scenario analysis

**Files Verified**:
- [frontend/public/js/ai-npv-module.js:859-883](frontend/public/js/ai-npv-module.js:859-883) - Export includes scenario_explanations
- [backend/app/api/ai_npv.py:169](backend/app/api/ai_npv.py:169) - Endpoint accepts scenario_results
- [backend/app/services/ai_npv_service.py:614-728](backend/app/services/ai_npv_service.py:614-728) - Generates 150-word analysis

**Status**: NO CHANGES NEEDED - Already working correctly

---

## Summary of Changes

### Frontend Files

1. **frontend/public/js/ai-npv-module.js**
   - Lines 136-158: Store company info (exchange, currency) in AI_NPV_DATA, update Company Info with CF price
   - Lines 80-91: Pass full company info object to refetchOCFForExchange
   - Lines 1052-1104: Update refetchOCFForExchange to handle company info, update display with CF price
   - Lines 193-206: Add dynamic currency symbol to table headers
   - Lines 243-247: Add dynamic currency symbol to current price and terminal prices
   - Lines 454-458: Add validation to block NPV calc without price data

### Backend Files

**NO BACKEND CHANGES** - All fixes were frontend data flow improvements

---

## Architecture Improvements

### Before v3.6:
```
User clicks "Fetch Scenarios"
  ↓
fetch_company_info (price A)
  ↓
Display Company Info (shows price A)
  ↓
fetch_cf_scenarios (price B ≠ A)
  ↓
Store CF data
  ↓
User clicks "Calculate NPV"
  ↓
Uses price B (different from displayed price A!)
```

### After v3.6:
```
User clicks "Fetch Scenarios"
  ↓
fetch_company_info (metadata only)
  ↓
fetch_cf_scenarios (price P + CF data)
  ↓
Store CF data + company metadata
  ↓
Display Company Info (shows price P from CF)
  ↓
User clicks "Calculate NPV"
  ↓
Uses price P (same as displayed!)
```

**Key Principle**: `fetch_cf_scenarios` is the single source of truth for all price data used in calculations and displayed to users.

---

## Testing Instructions

### Test 1: Single Company - Price Consistency
1. Navigate to AI NPV tab
2. Enter ticker: **AAPL**
3. Click "Fetch CF Scenarios from ChatGPT"
4. **Expected**:
   - Company Information shows price (e.g., USD $149.15)
   - Cash flow table shows same price: "Current price: **$149.15/share**"
   - Table headers show: "Low ($/share)", "Base ($/share)", "High ($/share)"
5. Enter Initial Cost: **-10000**
6. Enter Required Return: **10**
7. Click "Calculate NPV"
8. **Verify**: Calculation uses same price shown in Company Info (check console logs)

### Test 2: Multiple Exchanges - Price Updates After Selection
1. Navigate to AI NPV tab
2. Enter ticker: **LDO**
3. Click "Fetch CF Scenarios from ChatGPT"
4. **Expected**: Dropdown appears with multiple companies
5. Select **"LEONARDO SPA (XETRA)"** (or any option)
6. **Expected**:
   - Company Info updates with selected company details
   - Currency shows: **EUR** (not USD)
   - Price shown in Company Info matches CF scenarios data
   - Table headers show: "Low (€/share)", "Base (€/share)", "High (€/share)"
   - Current price shows: **€X.XX/share** (with Euro symbol)
   - Terminal prices show: "Low: €XX.XX | Base: €XX.XX | High: €XX.XX"
7. Calculate NPV
8. **Verify**: Uses correct EUR price, not USD price

### Test 3: Currency Symbol Display
1. Test with different currency stocks:
   - **AAPL** (USD) → Shows `$`
   - **BMW.DE** (EUR) → Shows `€`
   - **BP.L** (GBP) → Shows `£`
   - **TD.TO** (CAD) → Shows `CAD` (text)
2. **Verify**: Currency symbol appears in:
   - Company Info panel ("Stock Price: EUR 45.67")
   - Table headers ("Base (€/share)")
   - Current price label ("Current price: **€45.67/share**")
   - Terminal prices ("Low: €40.00 | Base: €50.00 | High: €60.00")

### Test 4: Validation - Block Calc Without Price
1. Navigate to AI NPV tab
2. Enter ticker: **MSFT**
3. **DO NOT** click "Fetch CF Scenarios"
4. Enter Initial Cost: **-15000**
5. Enter Required Return: **10**
6. Click "Calculate NPV"
7. **Expected**: Error message: "No stock price data available. Please fetch CF scenarios first by clicking 'Fetch CF Scenarios from ChatGPT'."
8. Click "Fetch CF Scenarios from ChatGPT"
9. Wait for scenarios to load
10. Click "Calculate NPV" again
11. **Expected**: Calculation proceeds successfully

### Test 5: PDF Export with Scenario Data
1. Complete Test 1 (AAPL calculation)
2. Click "Export as PDF"
3. **Expected**:
   - PDF downloads successfully
   - Contains 150-word professional scenario analysis for Low/Base/High cases
   - Shows correct currency symbol throughout PDF
   - All three scenarios (Low/Base/High) NPV values present

---

## Version History

- **v3.6** (2025-12-03): Unified data sources, added currency support, fixed price consistency, added validation
- **v3.5** (2025-12-03): Aligned company info with CF table, improved scenario analysis, expanded PDF export
- **v3.4** (2025-12-03): Fixed exports, 50-word descriptions, removed emojis, verified share scaling
- **v3.3** (2025-12-03): Fixed ticker dropdown, export structure, added debug logging
- **v3.2** (2025-12-03): Added comprehensive console logging for data flow tracing
- **v3.1** (2025-12-03): Fixed data clearing between tests
- **v3.0** (2025-12-02): Implemented per-share investment logic

---

## Breaking Changes

**NONE** - All changes are backward compatible

---

## Migration Notes

**No migration required** - All changes are automatic. Users will immediately see:
- Consistent prices across Company Info and calculations
- Correct currency symbols for international stocks
- Validation preventing calculations without data

---

## All Issues Status

| Issue | Status | Details |
|-------|--------|---------|
| 1. Price mismatch between Company Info and calculation | ✅ FIXED | Made fetch_cf_scenarios single source of truth |
| 2. Disambiguation doesn't update price | ✅ FIXED | refetchOCFForExchange now updates Company Info with CF price |
| 3. Hardcoded USD symbol for all currencies | ✅ FIXED | Dynamic currency symbol based on company metadata |
| 4. No validation for missing price data | ✅ FIXED | Added validation to block NPV calc without data |
| 5. Scenario explanations missing from PDF | ✅ VERIFIED | Already working - no changes needed |

---

**Status**: All 4 issues RESOLVED ✅

**Version**: 3.6

**Ready for Testing**: Yes

**Breaking Changes**: None

---

## Technical Details

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                 User Clicks "Fetch Scenarios"                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              API Call: fetch_company_info(ticker)            │
│  Returns: {description, exchange, currency, country}         │
│  Note: Does NOT use stock_price from this response          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│     If multiple exchanges → Show disambiguation dropdown     │
│     User selects → Store company metadata (currency, etc)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│       API Call: fetch_cf_scenarios(ticker, exchange)         │
│  Returns: {                                                  │
│    current_price_per_share: 149.15,  ← SINGLE SOURCE        │
│    dividends_per_share: {low, base, high},                  │
│    terminal_price_per_share: {low, base, high},             │
│    scenario_explanation: {low, base, high}                   │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Store in AI_NPV_DATA:                       │
│  {                                                           │
│    currentPricePerShare: 149.15,  ← From CF scenarios       │
│    dividendsPerShare: {...},                                │
│    terminalPricePerShare: {...},                            │
│    scenarioExplanations: {...},                             │
│    exchange: "NASDAQ",  ← From company info                 │
│    currency: "USD",     ← From company info                 │
│    ...                                                       │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│          Update Company Info Display:                        │
│  Stock Price: USD $149.15  ← currentPricePerShare           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│           Update Cash Flow Table Display:                    │
│  Headers: "Low ($/share)", "Base ($/share)", "High ($/share)"│
│  Current price: $149.15/share  ← Same value!               │
│  Terminal prices: Low: $130 | Base: $210 | High: $280      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              User Clicks "Calculate NPV"                     │
│  Validation: Checks AI_NPV_DATA.currentPricePerShare > 0   │
│  Calculation: Uses currentPricePerShare = 149.15            │
│  Result: Consistent with displayed price!                   │
└─────────────────────────────────────────────────────────────┘
```

### Key Variables

```javascript
// BEFORE v3.6 (INCONSISTENT):
companyData.stock_price        // Used for Company Info display
data.current_price_per_share   // Used for NPV calculation
// ❌ These could be different!

// AFTER v3.6 (CONSISTENT):
window.AI_NPV_DATA.currentPricePerShare  // SINGLE value for both display AND calculation
// ✅ Always from fetch_cf_scenarios
// ✅ Always consistent
```

---

## Known Limitations

1. **Currency conversion**: No automatic currency conversion. If user enters cost in different currency than stock, calculation will be incorrect. Consider adding warning or conversion feature in future version.

2. **Exchange rate changes**: Current price from ChatGPT might not reflect real-time FX rates. Users should verify prices for cross-currency investments.

3. **Currency symbol fallback**: For currencies without dedicated symbol (CAD, JPY, etc.), displays 3-letter code. Consider adding more currency symbols in future.

---

**End of Document**

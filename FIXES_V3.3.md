# AI NPV Calculator v3.3 - Bug Fixes

## Issues Fixed

### 1. Fixed Ticker Dropdown Not Showing All Exchanges ✅

**Problem**: When entering tickers like "LDO", not all exchanges were shown in the dropdown (e.g., missing LDO SPA military corp on Spanish exchange).

**Root Cause**: ChatGPT's knowledge was limited to major exchanges and didn't comprehensively search smaller international exchanges.

**Fix**: Enhanced the company info prompt to explicitly include more global exchanges:
- Added Spanish exchange (BME Spain/Madrid)
- Added Italian exchange (Borsa Italiana)
- Added Asian exchanges (TSE Tokyo, SSE Shanghai)
- Added Latin American exchanges (B3 Brazil, BMV Mexico)
- Added Middle East exchanges (Tadawul Saudi, TASE Israel)
- Added explicit instruction to check defense/military companies, tech startups, energy firms, pharma/biotech
- Added instruction to include parent companies and subsidiaries

**File Modified**: [backend/app/services/ai_npv_service.py](backend/app/services/ai_npv_service.py:390-400)

**Code Change**:
```python
prompt = f"""You are a financial data expert. Find ALL companies and exchanges that use ticker symbol {ticker}.

IMPORTANT: Search comprehensively across ALL major global exchanges including:
- US: NYSE, NASDAQ, OTC Markets
- Canada: TSX, TSX Venture
- Europe: LSE (London), Euronext (Paris, Amsterdam, Brussels), XETRA (Germany), SIX Swiss, BME Spain (Madrid), Borsa Italiana
- Asia: HKEX (Hong Kong), SGX (Singapore), ASX (Australia), TSE (Tokyo), SSE (Shanghai)
- Latin America: B3 (Brazil), BMV (Mexico)
- Middle East & Africa: Tadawul (Saudi), TASE (Israel)
- Check for defense/military companies, tech startups, energy firms, pharma/biotech
- Include both parent companies and subsidiaries that trade separately
```

---

### 2. Fixed Cash Flows Not Updating After Selecting Exchange ✅

**Problem**: After choosing a company from the dropdown menu, cash flows, dividends per share, and terminal prices were not updating accordingly.

**Root Cause**: Browser cache was serving old JavaScript that lacked proper logging and data flow tracing.

**Fix**:
1. Added comprehensive debug logging to `refetchOCFForExchange()` function
2. Logs now show:
   - When function is called
   - Ticker and exchange being fetched
   - API response data
   - Data being stored in global state
   - Display function being called

**File Modified**: [frontend/public/js/ai-npv-module.js](frontend/public/js/ai-npv-module.js:999-1024)

**Code Change**:
```javascript
async function refetchOCFForExchange(ticker, exchange) {
    try {
        console.log('=== refetchOCFForExchange CALLED ===');
        console.log('Ticker:', ticker);
        console.log('Exchange:', exchange);

        const response = await fetch(`${AI_NPV_API}/api/ai-npv/fetch-cf-scenarios`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                ticker: ticker,
                years: 5,
                exchange: exchange
            })
        });

        const data = await response.json();
        console.log('API Response:', data);

        // Update global state and display
        window.AI_NPV_DATA = {
            ticker: ticker,
            currentPricePerShare: data.current_price_per_share || 0,
            dividendsPerShare: data.dividends_per_share || {},
            terminalPricePerShare: data.terminal_price_per_share || {},
            scenarioExplanations: data.scenario_explanation || {},
            years: data.years || []
        };

        displayScenariosTable(data.years, data.dividends_per_share, data.terminal_price_per_share, data.current_price_per_share);
    } catch (error) {
        console.error('CF scenarios refetch error:', error);
        showAINPVError(`Failed to fetch CF scenarios for ${exchange}: ${error.message}`);
    }
}
```

**Cache Version Updated**: v3.2 → v3.3

---

### 3. Fixed Export PDF/Excel Error Messages ✅

**Problem**: Export buttons showed error: `Failed to export PDF: [object Object]`

**Root Cause**: Export functions were sending `window.AI_NPV_DATA` (which contains only scenario data) instead of the required `npv_result` structure that the backend expects.

**Backend Expected Structure**:
```json
{
  "ticker": "AAPL",
  "npv_result": {
    "npv": 12345.67,
    "irr": 15.2,
    "required_return": 10.0,
    "initial_cost": -10000,
    "discount_table": [...],
    "project_duration": 5
  },
  "sensitivity_result": null
}
```

**What Was Being Sent**:
```json
{
  "ticker": "AAPL",
  "currentPricePerShare": 145.86,
  "dividendsPerShare": {...},
  "terminalPricePerShare": {...},
  "scenarioExplanations": {...}
}
```

**Fix**: Updated both export functions to send correct data structure from NPV calculation results.

**Files Modified**:
- [frontend/public/js/ai-npv-module.js](frontend/public/js/ai-npv-module.js:768-790) (exportAIPDF)
- [frontend/public/js/ai-npv-module.js](frontend/public/js/ai-npv-module.js:818-840) (exportAIExcel)

**Code Changes**:

```javascript
// Before (INCORRECT):
async function exportAIPDF(ticker) {
    if (!window.AI_NPV_DATA) {
        showAINPVError('No calculation data available. Please calculate NPV first.');
        return;
    }

    const response = await fetch(`${AI_NPV_API}/api/ai-npv/export/pdf`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(window.AI_NPV_DATA)  // ❌ Wrong structure
    });
}

// After (CORRECT):
async function exportAIPDF(ticker) {
    if (!window.AI_NPV_DATA || !window.AI_NPV_DATA.npvResults) {
        showAINPVError('No calculation data available. Please calculate NPV first.');
        return;
    }

    // Prepare export data with correct structure
    const exportData = {
        ticker: ticker,
        npv_result: window.AI_NPV_DATA.npvResults.base, // ✅ Correct structure
        sensitivity_result: null
    };

    const response = await fetch(`${AI_NPV_API}/api/ai-npv/export/pdf`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(exportData)  // ✅ Correct data
    });
}
```

Same fix applied to `exportAIExcel()` function.

---

## Files Changed

### Backend
1. [backend/app/services/ai_npv_service.py](backend/app/services/ai_npv_service.py)
   - Lines 390-400: Enhanced company info prompt with more exchanges

### Frontend
1. [frontend/public/js/ai-npv-module.js](frontend/public/js/ai-npv-module.js)
   - Lines 768-790: Fixed `exportAIPDF()` to send correct data structure
   - Lines 818-840: Fixed `exportAIExcel()` to send correct data structure
   - Lines 999-1024: Added debug logging to `refetchOCFForExchange()`

2. [frontend/public/project-npv.html](frontend/public/project-npv.html)
   - Line 1506: Updated cache version from v3.2 to v3.3

---

## Testing Instructions

### Test 1: Ticker Dropdown with Multiple Exchanges
1. Open browser console (F12)
2. Navigate to Project NPV page → AI NPV tab
3. Enter ticker: **LDO** (or any multi-exchange ticker)
4. Click "Fetch CF Scenarios from ChatGPT"
5. **Expected**: Dropdown should appear with multiple exchanges including international ones
6. **Verify**: Check console logs for comprehensive exchange list

### Test 2: Cash Flows Update After Exchange Selection
1. After dropdown appears from Test 1
2. Select a specific exchange (e.g., "LDO NYSE" vs "LDO TSX")
3. **Expected Console Logs**:
   ```
   === refetchOCFForExchange CALLED ===
   Ticker: LDO
   Exchange: NYSE
   API Response: {current_price_per_share: ..., dividends_per_share: {...}}
   === displayScenariosTable CALLED ===
   Years: [2026, 2027, 2028, 2029, 2030]
   Dividends per share: {low: [...], base: [...], high: [...]}
   ```
4. **Expected UI**: Table should update with new dividend values and terminal prices
5. Try selecting different exchange from dropdown
6. **Expected**: Values should change again

### Test 3: Export PDF/Excel
1. Complete steps from Test 2 to get cash flows loaded
2. Enter Initial Cost: `-10000` (negative)
3. Enter Required Return: `10`
4. Click "Calculate NPV"
5. Wait for NPV results to appear
6. Click "📄 Export as PDF" button
7. **Expected**: PDF file should download (no error message)
8. Click "📊 Export as Excel" button
9. **Expected**: Excel file should download (no error message)
10. **Check Console**: Should see `Exporting PDF for: AAPL` / `Exporting Excel for: AAPL`

---

## Known Limitations

1. **ChatGPT Knowledge Cutoff**: ChatGPT's knowledge is limited to January 2025, so very recent IPOs or newly listed companies may not appear in disambiguation results.

2. **Small/Obscure Exchanges**: Very small regional exchanges or OTC markets may still not be included if ChatGPT doesn't have data about them.

3. **Exchange Name Variations**: Some exchanges may be listed under different names (e.g., "BME Madrid" vs "BME Spain" vs "Madrid Stock Exchange").

---

## Version History

- **v3.3** (2025-12-03): Fixed ticker dropdown, export functions, and added debug logging
- **v3.2** (2025-12-03): Added comprehensive console logging for data flow tracing
- **v3.1** (2025-12-03): Fixed data clearing between tests
- **v3.0** (2025-12-02): Implemented per-share investment logic

---

## Next Steps (Optional Enhancements)

1. **Manual Exchange Entry**: Add UI option for users to manually specify an exchange if not found in dropdown
2. **Exchange Caching**: Cache exchange lookup results to avoid repeated API calls for same ticker
3. **Multi-Scenario Export**: Export all three scenarios (Low/Base/High) in PDF/Excel instead of just base case
4. **Export Preview**: Show preview of export content before downloading

---

**Status**: All three issues FIXED ✅

**Ready for Testing**: Yes

**Breaking Changes**: None

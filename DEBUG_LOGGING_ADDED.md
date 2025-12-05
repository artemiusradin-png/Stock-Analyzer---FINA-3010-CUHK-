# Debug Logging Added - v3.2

## Issue Being Diagnosed
User reports that cash flows and terminal prices appear static/unchanged when switching between different stock tickers (e.g., AAPL vs MSFT).

## Changes Made

### 1. Enhanced Console Logging in `ai-npv-module.js`

Added detailed logging to trace data flow from API to UI:

#### In `displayScenariosTable()` function:
```javascript
console.log('=== displayScenariosTable CALLED ===');
console.log('Years:', years);
console.log('Dividends per share:', dividendsPerShare);
console.log('Terminal price per share:', terminalPricePerShare);
console.log('Current price per share:', currentPricePerShare);
console.log('====================================');

// Later in the function
console.log('Extracted dividend arrays:', { lowDivs, baseDivs, highDivs });

// In the forEach loop
console.log(`Year ${year} (idx ${idx}): Low=${lowVal}, Base=${baseVal}, High=${highVal}`);

// After rendering
console.log('✓ Table HTML rendered to container');
```

### 2. Updated Cache Version
- Changed from v3.1 to v3.2 in [project-npv.html](frontend/public/project-npv.html:1506)
- Updated test page title to indicate debug version

## How to Test

1. **Open Browser Console**: Press F12 or Cmd+Option+I
2. **Navigate to**: http://localhost:3000/project-npv.html
3. **Switch to AI NPV tab**
4. **Enter first ticker** (e.g., AAPL)
5. **Click "Fetch CF Scenarios from ChatGPT"**
6. **Check console logs** - should see:
   - "fetchOCF function called"
   - "Fetching CF scenarios for ticker: AAPL"
   - "Response data:" with full API response
   - "=== displayScenariosTable CALLED ==="
   - All dividend values for each year
   - "✓ Table HTML rendered to container"

7. **Enter different ticker** (e.g., MSFT)
8. **Click "Fetch CF Scenarios from ChatGPT" again**
9. **Compare console logs** - values should be DIFFERENT from AAPL

## What to Look For

### If API Returns Different Data But UI Shows Same Values:
- **Problem**: UI rendering/DOM update issue
- **Solution**: Need to investigate why input values aren't updating

### If API Returns Same Data for Different Tickers:
- **Problem**: Backend caching or API issue
- **Solution**: Check backend service, OpenAI API calls

### If Console Shows Different Values But User Sees Same UI:
- **Problem**: Browser cache still serving old HTML/JS
- **Solution**: Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)

## Alternative Test Page

Use the standalone test page for a clean environment:
- URL: http://localhost:3000/test-ai-npv.html
- No cache issues
- Simpler code path
- Full console logging

## Backend Verification

Backend endpoint verified working correctly:
```bash
curl -X POST http://localhost:8000/api/ai-npv/fetch-cf-scenarios \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL", "years": 5}'
```

Returns proper per-share data with varying values for different tickers.

## Next Steps

1. User tests with console open
2. User reports what they see in console logs
3. Based on logs, we can pinpoint exact issue:
   - API level
   - Data extraction level
   - UI rendering level
   - Browser cache level

---

**Version**: 3.2
**Date**: 2025-12-03
**Status**: Awaiting user testing with console logs

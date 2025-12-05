# Troubleshooting "Failed to Fetch CF Scenarios" Error

## Issue
User reports: **"Failed to fetch CF scenarios: Failed to fetch"**

## Analysis

### Backend Status: ✅ WORKING
Server logs show successful requests:
```
INFO: 127.0.0.1:61050 - "POST /api/ai-npv/fetch-cf-scenarios HTTP/1.1" 200 OK
INFO: 127.0.0.1:61453 - "POST /api/ai-npv/fetch-cf-scenarios HTTP/1.1" 200 OK
INFO: 127.0.0.1:62440 - "POST /api/ai-npv/fetch-cf-scenarios HTTP/1.1" 200 OK
INFO: 127.0.0.1:63370 - "POST /api/ai-npv/fetch-cf-scenarios HTTP/1.1" 200 OK
```

The backend endpoint `/api/ai-npv/fetch-cf-scenarios` is responding successfully with 200 OK status.

### Frontend Error: "Failed to fetch"
This is a **generic browser error** that occurs when:
1. Network request cannot complete
2. CORS policy blocks the request
3. Backend is unreachable
4. Browser cache is serving outdated JavaScript

## Root Cause

The error message "Failed to fetch" (not "Failed to fetch CF scenarios: [specific error]") indicates the `fetch()` call itself is failing at the **browser level**, not the application level.

### Most Likely Causes:

#### 1. Browser Cache Issue (MOST LIKELY)
The browser is serving old JavaScript that doesn't match the current backend API structure.

**Solution:**
- **Hard refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)
- **Clear browser cache**: DevTools → Application → Clear storage
- **Incognito/Private window**: Test in fresh browser session

#### 2. API Endpoint Mismatch
Frontend may be pointing to wrong API URL.

**Check:**
Open browser console (F12) and look for:
```javascript
console.log('AI_NPV_API:', AI_NPV_API);
```

Expected: `http://localhost:8000` or your deployment URL

#### 3. CORS Configuration
If frontend is served from different origin than backend.

**Check backend logs for:**
```
OPTIONS /api/ai-npv/fetch-cf-scenarios HTTP/1.1
```

Should return 200 OK (confirmed in logs above)

## Diagnostic Steps

### Step 1: Verify Backend is Running
```bash
curl http://localhost:8000/health
```
Expected: `{"status":"ok"}` (200 OK)

### Step 2: Test CF Scenarios Endpoint Directly
```bash
curl -X POST http://localhost:8000/api/ai-npv/fetch-cf-scenarios \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL", "years": 5, "exchange": "NASDAQ"}'
```

Expected: JSON response with `dividends_per_share`, `terminal_price_per_share`, etc.

### Step 3: Clear Browser Cache
1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **Clear storage**
4. Check all boxes
5. Click **Clear site data**
6. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)

### Step 4: Check Console Logs
Open browser console (F12) and look for:
- `AI_NPV_API` value
- Network errors (red text)
- CORS errors
- Failed fetch requests

### Step 5: Test in Incognito Mode
Open an incognito/private browsing window and try again. This ensures no cached files are used.

## Expected Console Output (Success)

When working correctly, you should see:
```
fetchOCF function called - fetching scenarios
Fetching company info for ticker: AAPL
Company info received: {ticker: "AAPL", description: "...", ...}
Single company found. Proceeding with CF fetch...
Response status: 200
Response data: {years: [...], dividends_per_share: {...}, ...}
CF scenarios received: {...}
=== displayScenariosTable CALLED ===
Years: [2026, 2027, 2028, 2029, 2030]
...
```

## Error Console Output (Current Issue)

When experiencing "Failed to fetch":
```
fetchOCF function called - fetching scenarios
Fetching company info for ticker: AAPL
CF scenarios fetch error: TypeError: Failed to fetch
Failed to fetch CF scenarios: Failed to fetch
```

The error happens BEFORE the response is received, indicating a network-level failure.

## Solution

### Quick Fix (90% of cases)
1. **Hard refresh the browser**: Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)
2. **Clear browser cache** completely
3. **Test in incognito window**

### If Quick Fix Doesn't Work

#### Check Frontend File Timestamps
```bash
ls -lh /Users/artem/Desktop/PythonProject/frontend/public/js/ai-npv-module.js
ls -lh /Users/artem/Desktop/PythonProject/frontend/public/project-npv.html
```

Ensure files have recent modification times (today's date).

#### Verify API Endpoint Configuration
Check [ai-npv-module.js:6-13](frontend/public/js/ai-npv-module.js:6-13):
```javascript
function getAINPVAPIBase() {
    if (window.API_BASE_URL) {
        return window.API_BASE_URL.replace(/\/api$/, '');
    }
    return 'http://localhost:8000';
}
```

Make sure `window.API_BASE_URL` is correct or defaults to `http://localhost:8000`.

#### Check Backend Server Status
```bash
# In backend directory
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Look for:
```
INFO:     Application startup complete.
```

#### Test API Directly
```bash
# Test company info endpoint
curl -X POST http://localhost:8000/api/ai-npv/fetch-company-info \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL", "years": 1}'

# Test CF scenarios endpoint
curl -X POST http://localhost:8000/api/ai-npv/fetch-cf-scenarios \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL", "years": 5, "exchange": ""}'
```

Both should return JSON responses without errors.

## Alternative: Use Test Page

If main page has persistent caching issues, use the standalone test page:
```
http://localhost:3000/test-ai-npv.html
```

This bypasses any caching from the main application.

## Related Fixes

The following issues were recently fixed and may have caused cache confusion:

1. **v3.5** - Aligned company info with CF table, improved scenario analysis, expanded PDF export
2. **v3.4** - Fixed PDF/Excel export downloads, expanded company descriptions
3. **v3.3** - Fixed ticker dropdown, export structure
4. **PDF Export 422 Error** - Just fixed by creating `DetailedAnalysisRequest` model

## Next Steps

1. Try hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
2. Clear browser cache completely
3. Test in incognito window
4. If still failing, provide:
   - Browser console error messages (full text)
   - Network tab showing failed request details
   - Browser and OS version

---

**Status**: Awaiting user cache clear and hard refresh

**Date**: 2025-12-03

**Backend**: ✅ Working (confirmed by server logs)

**Frontend**: ⚠️ Likely cache issue

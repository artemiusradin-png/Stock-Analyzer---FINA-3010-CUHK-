# Fix "Failed to fetch financial data" Error

## Problem
When clicking "Fetch Data" button, you get: `Failed to fetch financial data: Failed to fetch`

## Root Cause
The backend API is not deployed or not accessible. The frontend is trying to call:
```
https://arqam-backend.onrender.com/api/ai-npv/fetch-dcf-financials
```

## Quick Diagnosis

### Step 1: Check Browser Console
1. Open your website: https://arqam-project.netlify.app/project-npv.html
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Look for these messages:
   - `🔍 Detecting backend connection...`
   - `DCF_API_BASE initialized to: ...`
   - `Using API base: ...`
   - `Full API URL: ...`

### Step 2: Test Backend Directly
Open this URL in your browser:
```
https://arqam-backend.onrender.com/health
```

**Expected Results:**
- ✅ **If you see** `{"status": "healthy", "service": "Portfolio Management API"}` → Backend is deployed
- ❌ **If you see** "Site not found" or timeout → Backend is NOT deployed
- ⏳ **If it takes 30-60 seconds** → Backend is sleeping (Render free tier)

## Solutions

### Solution 1: Deploy Backend to Render (Required)

The backend MUST be deployed for "Fetch Data" to work.

**Follow these steps:**

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Sign up/Login with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `artemiusradin-png/Test2`

3. **Configure Service**
   - **Name**: `arqam-backend`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `backend/Dockerfile` (or root `Dockerfile`)
   - **Docker Context**: `backend` (or root `.`)
   - **Health Check Path**: `/health`
   - **Branch**: `main`

4. **Add Environment Variables**
   ```
   OPENAI_API_KEY=your_openai_key_here
   FINNHUB_API_KEY=d10doh1r01qlsac8fq2gd10doh1r01qlsac8fq30
   FRED_API_KEY=01b4c1c4a8763cb79b98119a3c32d0a8
   EOD_API_KEY=692e837b7e7e92.63340340
   DEBUG=false
   LOG_LEVEL=INFO
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait 5-10 minutes for first deployment
   - Copy the backend URL (e.g., `https://arqam-backend.onrender.com`)

6. **Update Frontend (if URL is different)**
   - If Render gives you a different URL than `https://arqam-backend.onrender.com`
   - Edit `frontend/public/project-npv.html` line 8
   - Update: `<meta name="api-base-production" content="YOUR-ACTUAL-URL">`
   - Commit and push to GitHub

### Solution 2: Backend Sleeping (Render Free Tier)

If backend is deployed but sleeping:

1. **First request takes 30-60 seconds** - This is normal
2. **Click "Wake Up Backend" button** (if shown in notification)
3. **Or wait** - The frontend will retry automatically
4. **Subsequent requests are fast** - Backend stays awake for ~15 minutes

### Solution 3: Check Backend Logs

If backend is deployed but still failing:

1. Go to Render Dashboard
2. Click on your `arqam-backend` service
3. Click "Logs" tab
4. Look for errors:
   - Missing environment variables
   - Import errors
   - API key issues

## Testing After Deployment

### Test 1: Health Check
```
https://your-backend-url.onrender.com/health
```
Should return: `{"status": "healthy"}`

### Test 2: API Endpoint
```bash
curl -X POST https://your-backend-url.onrender.com/api/ai-npv/fetch-dcf-financials \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL"}'
```

### Test 3: Frontend
1. Visit: https://arqam-project.netlify.app/project-npv.html
2. Open Console (F12)
3. Enter ticker: "AAPL"
4. Click "Fetch Data"
5. Check console for:
   - ✅ `Full API URL: https://...`
   - ✅ `Response status: 200 OK`
   - ❌ Or error details

## Common Errors & Fixes

### Error: "Failed to fetch"
**Cause**: Backend not deployed or unreachable
**Fix**: Deploy backend to Render

### Error: "CORS policy"
**Cause**: CORS misconfiguration
**Fix**: Backend CORS is already configured correctly. Check backend logs.

### Error: "404 Not Found"
**Cause**: Wrong API endpoint or backend not deployed
**Fix**: Verify backend URL and endpoint path

### Error: "500 Internal Server Error"
**Cause**: Backend error (missing API keys, etc.)
**Fix**: Check Render logs for specific error

### Error: Timeout (30-60 seconds)
**Cause**: Backend sleeping (Render free tier)
**Fix**: Wait for wake-up or upgrade to paid tier

## Debug Checklist

- [ ] Backend deployed to Render
- [ ] Backend URL accessible: `/health` endpoint works
- [ ] Environment variables set in Render
- [ ] Frontend has correct backend URL in meta tag
- [ ] Browser console shows correct API URL
- [ ] Network tab shows API request being made
- [ ] CORS headers present in response
- [ ] Backend logs show request received

## What I Fixed

I've improved the error handling to:
- ✅ Show better error messages
- ✅ Log API URL being used
- ✅ Detect backend connection status
- ✅ Provide helpful troubleshooting info

After deploying backend, the error messages will be more informative.

## Next Steps

1. **Deploy backend to Render** (most important!)
2. **Wait for Netlify to deploy** updated frontend (1-2 minutes)
3. **Test "Fetch Data"** button
4. **Check browser console** for detailed logs

The frontend is ready - it just needs the backend to be deployed! 🚀



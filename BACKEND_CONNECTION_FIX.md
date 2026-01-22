# Backend Connection Fix - Deployment Guide

## Problem
The frontend was not connecting to the backend in production, causing API calls to fail.

## Changes Made

### 1. Frontend Backend Detection (`frontend/public/project-npv.html`)
- ✅ Improved backend connection detection with better error handling
- ✅ Added connection status indicators (connected/unverified/disconnected)
- ✅ Added retry logic for health checks
- ✅ Better timeout handling (5 seconds instead of 2)
- ✅ User-friendly error notifications
- ✅ Persists backend URL in localStorage

### 2. API Client Improvements (`frontend/public/js/api-client.js`)
- ✅ Better URL resolution (checks multiple sources)
- ✅ Automatic retry logic for failed requests
- ✅ Improved error messages with context
- ✅ Better CORS error detection
- ✅ Handles backend sleeping (Render free tier)

### 3. Backend CORS Configuration (`backend/app/main.py`)
- ✅ Enhanced CORS middleware with `expose_headers` and `max_age`
- ✅ Proper CORS headers for all requests

## How to Verify Backend Connection

### Step 1: Check Backend URL
Open your deployed frontend and check the browser console. You should see:
```
🔍 Detecting backend connection...
Production mode: true
Production URL: https://your-backend-url.com
```

### Step 2: Verify Backend is Deployed
1. Open your backend URL directly: `https://your-backend-url.com/health`
2. You should see: `{"status": "healthy", "service": "Portfolio Management API"}`

### Step 3: Check Frontend Connection Status
The frontend will show a notification in the top-right corner:
- ✅ **Green**: Backend connected successfully
- ⚠️ **Yellow**: Backend URL configured but health check failed (may be sleeping)
- ❌ **Red**: Backend not configured or unreachable

## Common Issues and Solutions

### Issue 1: Backend Not Deployed
**Symptoms**: Red error notification, "Cannot connect to backend"
**Solution**: 
1. Deploy backend to Render/Railway
2. Update `frontend/public/project-npv.html` line 8:
   ```html
   <meta name="api-base-production" content="https://your-backend-url.onrender.com">
   ```
3. Redeploy frontend

### Issue 2: Backend Sleeping (Render Free Tier)
**Symptoms**: First request takes 30-60 seconds, then works
**Solution**: 
- This is normal for Render free tier
- The frontend now handles this with retry logic
- Consider upgrading to paid tier for always-on service

### Issue 3: CORS Errors
**Symptoms**: Console shows "CORS policy" errors
**Solution**: 
- Backend CORS is configured to allow all origins
- If still seeing errors, check backend logs
- Verify backend is actually running

### Issue 4: Wrong Backend URL
**Symptoms**: Health check fails, but backend is deployed
**Solution**:
1. Verify backend URL in Render/Railway dashboard
2. Update meta tag in `project-npv.html`
3. Make sure URL doesn't have trailing slash
4. Check browser console for exact URL being used

## Testing Locally

1. Start backend:
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload
   ```

2. Open frontend:
   ```bash
   cd frontend/public
   python -m http.server 8080
   ```

3. Open browser console - should see:
   ```
   ✓ Backend connected: http://localhost:8000
   ```

## Deployment Checklist

- [ ] Backend deployed and accessible at `/health` endpoint
- [ ] Backend URL updated in `frontend/public/project-npv.html` (line 8)
- [ ] Frontend redeployed
- [ ] Browser console shows successful connection
- [ ] Test API call (e.g., fetch company data) works

## Debugging Tips

1. **Check Browser Console**: Look for connection logs and errors
2. **Check Network Tab**: See if requests are being made and what responses you get
3. **Test Backend Directly**: Visit `https://your-backend-url.com/health` in browser
4. **Check Backend Logs**: Look at Render/Railway logs for errors
5. **Verify Environment Variables**: Make sure all API keys are set in backend

## Files Modified

1. `frontend/public/project-npv.html` - Backend detection and error handling
2. `frontend/public/js/api-client.js` - API call improvements
3. `backend/app/main.py` - CORS configuration

## Next Steps

If backend connection still fails:
1. Check Render/Railway dashboard for backend status
2. Verify backend URL is correct
3. Check backend logs for errors
4. Test backend endpoints directly with curl or Postman
5. Verify CORS headers in network tab



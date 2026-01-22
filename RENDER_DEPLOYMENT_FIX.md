# Render Deployment Failed - Fix Guide

## Problem
Render deployment is failing during build. Logs show "deploy failed" but no details.

## Common Causes

1. **Wrong Dockerfile path** - Render can't find the Dockerfile
2. **Wrong build context** - Files not found during COPY
3. **Missing requirements file** - `requirements-production.txt` not found
4. **Build errors** - Python dependencies failing to install
5. **Missing environment variables** - Required vars not set

## Fix Steps

### Step 1: Check Render Service Configuration

In Render dashboard, verify:

**If using `backend/Dockerfile`:**
- ✅ Dockerfile Path: `backend/Dockerfile`
- ✅ Docker Context: `backend`
- ✅ Root Directory: (leave empty or `backend`)

**If using root `Dockerfile`:**
- ✅ Dockerfile Path: `Dockerfile` (or `./Dockerfile`)
- ✅ Docker Context: `.` (root)
- ✅ Root Directory: (leave empty)

### Step 2: Verify File Structure

Make sure these files exist:
```
backend/
  ├── Dockerfile
  ├── requirements-production.txt
  └── app/
      ├── main.py
      ├── config.py
      └── ... (other files)
```

### Step 3: Test Docker Build Locally (Optional)

Test if Dockerfile works:
```bash
cd backend
docker build -t test-backend .
```

If this fails, you'll see the exact error.

### Step 4: Check Render Build Logs

Even if "Logs unavailable", try:
1. Go to Render dashboard
2. Click on your service
3. Click "Events" tab (instead of Logs)
4. Look for build errors

### Step 5: Simplify Dockerfile (If Still Failing)

If build keeps failing, try this simpler version:

**Create `backend/Dockerfile.simple`:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements-production.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-production.txt

# Copy application code
COPY app/ ./app/

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run with Gunicorn
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

## Quick Fix: Use Root Dockerfile

If `backend/Dockerfile` keeps failing, use the root `Dockerfile`:

1. In Render dashboard, change:
   - Dockerfile Path: `Dockerfile`
   - Docker Context: `.` (or leave empty)

2. The root Dockerfile already has correct paths:
   ```dockerfile
   COPY backend/requirements-production.txt .
   COPY backend/app/ ./app/
   ```

## Alternative: Use Render Blueprint

Instead of manual setup, use `render.yaml`:

1. In Render dashboard
2. Click "New +" → "Blueprint"
3. Connect your GitHub repo
4. Render will auto-detect `deploy/render.yaml`
5. It will configure everything automatically

## Check These Settings

### Environment Variables (Required)
```
OPENAI_API_KEY=your_key_here
FINNHUB_API_KEY=d10doh1r01qlsac8fq2gd10doh1r01qlsac8fq30
FRED_API_KEY=01b4c1c4a8763cb79b98119a3c32d0a8
EOD_API_KEY=692e837b7e7e92.63340340
DEBUG=false
LOG_LEVEL=INFO
```

### Service Settings
- **Name**: `arqam-backend`
- **Environment**: `Docker`
- **Region**: `Oregon` (or your preference)
- **Branch**: `main`
- **Health Check Path**: `/health`
- **Auto-Deploy**: `Yes`

## Debugging Commands

### Check if files exist:
```bash
ls -la backend/requirements-production.txt
ls -la backend/app/main.py
```

### Test Docker build:
```bash
cd backend
docker build -t test .
```

### Check Dockerfile syntax:
```bash
docker build --no-cache -t test backend/
```

## Most Likely Issue

Based on the error, it's probably:
1. **Wrong Dockerfile path** in Render settings
2. **Wrong build context** - files not found
3. **Missing requirements file** - check if `requirements-production.txt` exists

## Quick Solution

**Try this configuration in Render:**

- Dockerfile Path: `Dockerfile` (use root one)
- Docker Context: `.` (root)
- Or use Blueprint with `render.yaml`

The root Dockerfile is already configured correctly and should work!



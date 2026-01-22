# Render CMD Override Issue - Fix

## Problem
Render is trying to run `/root/.local/bin/gunicorn` directly instead of using our CMD with `python -m gunicorn`.

## Root Cause
Render might be auto-detecting gunicorn and trying to run it as a script, or there's a Docker Command override in Render settings.

## Solution

### Step 1: Check Render Docker Command Setting

1. Go to Render dashboard → your `arqam-backend` service
2. Click "Settings" → "Build & Deploy"
3. Find "Docker Command" field
4. **Make sure it's EMPTY** (not set to anything)
5. If it has a value, click "Edit" and clear it
6. Save

### Step 2: Clear Build Cache

1. Click "Manual Deploy"
2. Select "Clear build cache & deploy"
3. Wait for deployment

### Step 3: Verify CMD in Dockerfile

The Dockerfile should have:
```dockerfile
CMD ["python", "-m", "gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-"]
```

This uses `python -m gunicorn` which works regardless of where gunicorn script is installed.

## Why This Works

- `python -m gunicorn` uses Python's module system
- It doesn't rely on PATH or script location
- It works even if gunicorn script is in `/root/.local/bin`
- Render can't override it easily

## If Still Failing

If Render still tries to run gunicorn directly:

1. Check if there's a "Start Command" override in Render settings
2. Make sure "Docker Command" is empty
3. The CMD in Dockerfile should be used

The fix I just pushed should work - but make sure "Docker Command" in Render is empty!



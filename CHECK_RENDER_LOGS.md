# How to Check Render Build Logs

## The Problem
All deployments are failing with "Exited with status 1 while building your code."

## How to See the Actual Error

### Step 1: Access Logs
1. In Render dashboard, click on your `arqam-backend` service
2. Click **"Logs"** in the left sidebar (not Events)
3. Look for the most recent build logs

### Step 2: Look for Build Errors
In the logs, look for lines that say:
- `ERROR:` 
- `failed to`
- `not found`
- `ModuleNotFoundError`
- `ImportError`

### Step 3: Common Build Errors

**If you see `/backend/app: not found`:**
- Docker Build Context is wrong
- Fix: Set to `.` (root) if using root Dockerfile

**If you see `requirements-production.txt: not found`:**
- File path is wrong
- Fix: Check if file exists in `backend/` directory

**If you see `ModuleNotFoundError`:**
- Missing Python package
- Fix: Check `requirements-production.txt` has all packages

**If you see `gunicorn: not found`:**
- Gunicorn not installed
- Fix: Check `requirements-production.txt` includes `gunicorn`

## Quick Fix: Try This Configuration

In Render Settings → Build & Deploy:

1. **Dockerfile Path**: `Dockerfile` (root)
2. **Docker Build Context Directory**: `.` (just a dot)
3. **Root Directory**: (leave empty)
4. **Health Check Path**: `/health`

Then click "Manual Deploy" → "Clear build cache & deploy"

## Alternative: Use Backend Dockerfile

If root Dockerfile keeps failing:

1. **Dockerfile Path**: `backend/Dockerfile`
2. **Docker Build Context Directory**: `backend`
3. **Health Check Path**: `/health`

## Need Help?

Share the error message from the Logs tab and I can help fix it!



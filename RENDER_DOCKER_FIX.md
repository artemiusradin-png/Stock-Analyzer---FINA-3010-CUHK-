# Fix Render Docker Build Error: "/backend/app" not found

## The Error
```
error: failed to solve: failed to compute cache key: failed to calculate checksum of ref 
"/backend/app": not found
```

## The Problem
Docker can't find the files because the **Docker Build Context** doesn't match the **Dockerfile paths**.

## Solution: Choose ONE Configuration

### Option 1: Use Root Dockerfile (Easiest - Recommended)

**In Render Settings:**

1. **Dockerfile Path**: `Dockerfile` (root Dockerfile)
2. **Docker Build Context Directory**: `.` (root directory)
3. **Health Check Path**: `/health`

**Why this works:**
- Root Dockerfile expects context `.` (root)
- It uses `COPY backend/app/ ./app/` which works from root

### Option 2: Use Backend Dockerfile

**In Render Settings:**

1. **Dockerfile Path**: `backend/Dockerfile`
2. **Docker Build Context Directory**: `backend`
3. **Health Check Path**: `/health`

**Why this works:**
- Backend Dockerfile expects context `backend`
- It uses `COPY app/ ./app/` which works from backend directory

## Current Issue

Based on your error, you probably have:
- Dockerfile Path: `Dockerfile` (root)
- Docker Build Context: `backend` (WRONG!)

This mismatch causes Docker to look for `/backend/app` from the `backend` context, which doesn't exist.

## Fix Steps

### Step 1: Go to Render Settings
1. Open your `arqam-backend` service
2. Click "Settings" → "Build & Deploy"

### Step 2: Fix Docker Build Context

**If using root Dockerfile:**
- Click "Edit" next to "Docker Build Context Directory"
- Change from `backend` (or `8`) to `.` (just a dot)
- Save

**If using backend Dockerfile:**
- Click "Edit" next to "Dockerfile Path"
- Change to `backend/Dockerfile`
- Click "Edit" next to "Docker Build Context Directory"
- Change to `backend`
- Save

### Step 3: Fix Health Check
- Go to "Health Checks" section
- Change "Health Check Path" from `/healthz` to `/health`
- Save

### Step 4: Clear Docker Command
- In "Build & Deploy", find "Docker Command"
- Click "Edit"
- Clear the field (remove any value like `8`)
- Leave it empty
- Save

### Step 5: Redeploy
1. Click "Manual Deploy" at the top
2. Select "Clear build cache & deploy"
3. Wait for deployment

## Recommended Configuration (Use This!)

**Use Option 1 - Root Dockerfile:**

```
Dockerfile Path: Dockerfile
Docker Build Context Directory: .
Health Check Path: /health
Docker Command: (empty)
```

This is the simplest and should work immediately!



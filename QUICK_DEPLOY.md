# Quick Backend Deployment Guide

## Your backend is NOT deployed yet. Here's how to fix it:

## Option 1: Deploy to Render (5 minutes, FREE)

1. **Go to Render**: https://dashboard.render.com
2. **Sign up/Login** with GitHub
3. **Click "New +" → "Web Service"**
4. **Connect your GitHub repo**: `artemiusradin-png/Test` (or Test2)
5. **Configure the service**:
   - **Name**: `arqam-backend`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `backend/Dockerfile`
   - **Docker Context**: `backend`
   - **Health Check Path**: `/health`
   - **Plan**: Free
6. **Add Environment Variables** (click "Add Environment Variable"):
   - `OPENAI_API_KEY` = (your OpenAI key from backend/.env)
   - `FINNHUB_API_KEY` = `d10doh1r01qlsac8fq2gd10doh1r01qlsac8fq30`
   - `FRED_API_KEY` = `01b4c1c4a8763cb79b98119a3c32d0a8`
   - `EOD_API_KEY` = `692e837b7e7e92.63340340`
   - `DEBUG` = `false`
   - `LOG_LEVEL` = `INFO`
7. **Click "Create Web Service"**
8. **Wait 5-10 minutes** for deployment
9. **Copy the URL** (e.g., `https://arqam-backend.onrender.com`)

## Option 2: Deploy to Railway (Alternative)

1. Go to: https://railway.app
2. New Project → Deploy from GitHub
3. Select your repo
4. Railway auto-detects the config
5. Add the same environment variables
6. Copy the URL

## After Deployment - Update Frontend

Once you have your backend URL (e.g., `https://arqam-backend.onrender.com`):

1. Edit `frontend/public/project-npv.html`
2. Find line 8: `<meta name="api-base-production" content="">`
3. Change to: `<meta name="api-base-production" content="https://arqam-backend.onrender.com">`
4. Commit and push:
   ```bash
   git add frontend/public/project-npv.html
   git commit -m "Configure production backend URL"
   git push test main
   ```

## Test Your Backend

After deployment, test it:
```bash
curl https://your-backend-url.onrender.com/health
```

Should return: `{"status":"healthy","service":"Portfolio Management API"}`

## Need Help?

- Render Docs: https://render.com/docs
- Railway Docs: https://docs.railway.app


# Backend Deployment Guide

## Quick Setup

Your frontend is deployed on Netlify, but it needs a backend API to fetch financial data.

## Option 1: Deploy to Render (Recommended - Free)

1. Go to https://dashboard.render.com
2. Sign up/login with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name**: `arqam-backend`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `./backend/Dockerfile`
   - **Docker Context**: `./backend`
   - **Health Check Path**: `/health`
6. Add environment variables:
   - `OPENAI_API_KEY` (your OpenAI key)
   - `FINNHUB_API_KEY` (your Finnhub key)
   - `FRED_API_KEY` (your FRED key, if you have one)
   - `EOD_API_KEY` (your EOD key, if you have one)
7. Click "Create Web Service"
8. Wait for deployment (5-10 minutes)
9. Copy the service URL (e.g., `https://arqam-backend.onrender.com`)

## Option 2: Deploy to Railway

1. Go to https://railway.app
2. Sign up/login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect the configuration
6. Add environment variables (same as Render)
7. Copy the generated URL

## After Deployment

Once you have your backend URL:

1. Edit `frontend/public/project-npv.html`
2. Find line 7: `<meta name="api-base-production" content="">`
3. Add your backend URL: `<meta name="api-base-production" content="https://your-backend-url.com">`
4. Commit and push:
   ```bash
   git add frontend/public/project-npv.html
   git commit -m "Configure production API URL"
   git push test main
   ```

## Testing Locally

If you want to test locally:
1. Start your backend: `cd backend && python -m uvicorn app.main:app --reload`
2. The frontend will auto-detect `http://localhost:8000`

## Need Help?

- Check Render docs: https://render.com/docs
- Check Railway docs: https://docs.railway.app

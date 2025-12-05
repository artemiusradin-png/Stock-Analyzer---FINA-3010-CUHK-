# Deployment Guide - ARQAM Portfolio Management

## 🚀 Quick Start Options

### Option 1: Railway (Recommended - Easiest)
**Free tier: $5/month credits**
- ✅ Backend + Database in one place
- ✅ Automatic deployments from GitHub
- ✅ Built-in PostgreSQL
- ✅ Custom domains

### Option 2: Render (Best Free Tier)
**Free tier: Generous limits**
- ✅ Free PostgreSQL database
- ✅ Free static site hosting
- ✅ Auto-deployments

### Option 3: Vercel + Railway (Best Performance)
**Hybrid approach**
- Vercel: Frontend (free, fast CDN)
- Railway: Backend (free tier)

### Option 4: Supabase + Netlify (Best for Full-Stack)
**Recommended for growth**
- Supabase: Database + Auth + Storage (free tier)
- Netlify: Frontend (free tier)
- Railway/Render: Backend API (free tier)

---

## 📦 Pre-Deployment Checklist

- [x] `.gitignore` created
- [x] Docker configuration ready
- [x] Optimized dependencies
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Frontend assets minified (optional)
- [ ] API keys secured

---

## 🐳 Docker Deployment

### Build and Run Locally

```bash
# Build all services
docker-compose up --build

# Backend will be at: http://localhost:8000
# Frontend will be at: http://localhost:80
# PostgreSQL will be at: localhost:5432
```

### Build for Production

```bash
# Build backend only
cd backend
docker build -t arqam-backend:latest .

# Test the container
docker run -p 8000:8000 \
  -e DATABASE_URL="your-database-url" \
  -e OPENAI_API_KEY="your-key" \
  arqam-backend:latest
```

---

## 🚂 Option 1: Deploy to Railway

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

### Step 2: Login and Initialize

```bash
cd /Users/artem/Desktop/PythonProject

# Login to Railway
railway login

# Create new project
railway init
```

### Step 3: Add PostgreSQL

```bash
# Add PostgreSQL plugin
railway add --database postgresql
```

### Step 4: Configure Environment Variables

```bash
# Set environment variables
railway variables set OPENAI_API_KEY="sk-proj-..."
railway variables set FINNHUB_API_KEY="your-key"
railway variables set FRED_API_KEY="your-key"
railway variables set EOD_API_KEY="your-key"

# Railway automatically sets DATABASE_URL
```

### Step 5: Deploy Backend

```bash
# Deploy from backend directory
cd backend
railway up

# Your API will be live at: https://[your-project].up.railway.app
```

### Step 6: Deploy Frontend

Option A: **Use Railway for frontend too**
```bash
cd ..
railway service create frontend
railway link [service-id]
railway up --path frontend/public
```

Option B: **Use Vercel for frontend** (recommended)
```bash
# Update vercel.json with your Railway backend URL
# Then deploy to Vercel (see Option 3 below)
```

---

## 🎨 Option 2: Deploy to Render

### Step 1: Create Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### Step 2: Create Web Service (Backend)

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: arqam-backend
   - **Environment**: Docker
   - **Dockerfile Path**: `./backend/Dockerfile`
   - **Plan**: Free
4. Add environment variables:
   - `DATABASE_URL` (from Render PostgreSQL)
   - `OPENAI_API_KEY`
   - `FINNHUB_API_KEY`
   - etc.

### Step 3: Create PostgreSQL Database

1. Click "New +" → "PostgreSQL"
2. Configure:
   - **Name**: arqam-db
   - **Plan**: Free
3. Copy the "Internal Database URL"
4. Add it to backend environment variables

### Step 4: Create Static Site (Frontend)

1. Click "New +" → "Static Site"
2. Configure:
   - **Name**: arqam-frontend
   - **Build Command**: `echo "No build needed"`
   - **Publish Directory**: `frontend/public`
3. Add redirect rules for API:
   ```
   /api/* https://arqam-backend.onrender.com/api/:splat 200
   ```

### Step 5: Deploy

```bash
# Render auto-deploys on git push
git push origin main

# Backend: https://arqam-backend.onrender.com
# Frontend: https://arqam-frontend.onrender.com
```

---

## ⚡ Option 3: Deploy to Vercel + Railway

### Backend on Railway

```bash
cd backend
railway login
railway init
railway add --database postgresql
railway up

# Note the URL: https://[your-project].up.railway.app
```

### Frontend on Vercel

```bash
# Install Vercel CLI
npm install -g vercel

cd /Users/artem/Desktop/PythonProject

# Update vercel.json with your Railway backend URL
# Then deploy
vercel

# Follow prompts:
# - Set up and deploy: Yes
# - Link to existing project: No
# - Project name: arqam
# - Directory: ./ (root)
```

**Update API proxy in vercel.json:**
```json
{
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "https://your-railway-url.up.railway.app/api/$1"
    }
  ]
}
```

Then redeploy:
```bash
vercel --prod
```

---

## 🔥 Option 4: Full Stack with Supabase

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Note your credentials:
   - Project URL
   - Anon key
   - Service role key
   - Database connection string

### Step 2: Run Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Run migrations (create tables)
# Use your existing SQLAlchemy models or create SQL migrations
```

### Step 3: Update Backend Configuration

Update `.env`:
```bash
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
SUPABASE_URL=https://[project].supabase.co
SUPABASE_KEY=[service-role-key]
```

### Step 4: Deploy Backend to Railway

```bash
cd backend
railway up
# Configure environment variables in Railway dashboard
```

### Step 5: Deploy Frontend to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
cd /Users/artem/Desktop/PythonProject
netlify deploy --dir=frontend/public

# For production
netlify deploy --dir=frontend/public --prod
```

---

## 🔐 Environment Variables Setup

### Railway
```bash
railway variables set KEY=value
```

### Render
Add in dashboard: Settings → Environment Variables

### Vercel
```bash
vercel env add OPENAI_API_KEY
```

### Required Variables
```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-proj-...
FINNHUB_API_KEY=...
FRED_API_KEY=...
EOD_API_KEY=...
DEBUG=false
LOG_LEVEL=INFO
```

---

## 🧪 Testing Deployment

### Test Backend
```bash
curl https://your-backend-url/health
# Should return: {"status":"healthy","service":"Portfolio Management API"}

curl https://your-backend-url/api/portfolios
# Should return portfolio data or auth error
```

### Test Frontend
```bash
# Visit: https://your-frontend-url
# Check browser console for any API errors
```

---

## 📊 Cost Comparison

| Service | Free Tier | Paid |
|---------|-----------|------|
| **Railway** | $5/month credits | $5/month + usage |
| **Render** | 750 hours/month | $7/month |
| **Vercel** | 100GB bandwidth | $20/month |
| **Netlify** | 100GB bandwidth | $19/month |
| **Supabase** | 500MB database | $25/month |

### Recommended for Starting

**Free Stack:**
- Frontend: Vercel (free)
- Backend: Railway ($5 free credits)
- Database: Supabase (free tier)
- **Total: $0/month** (until credits run out)

**Production Stack ($25/month):**
- Frontend: Vercel (free)
- Backend: Railway ($7-10/month)
- Database: Supabase Pro ($25/month)
- **Total: ~$32-35/month**

---

## 🚨 Common Issues

### Issue: Database Connection Failed
```
Fix: Check DATABASE_URL is set correctly
- Railway: Use internal URL (automatic)
- Render: Use "Internal Database URL"
- Supabase: Use connection pooler URL
```

### Issue: CORS Errors
```python
# backend/app/main.py
# Make sure your frontend URL is in CORS_ORIGINS

CORS_ORIGINS = [
    "https://your-frontend.vercel.app",
    "https://your-domain.com"
]
```

### Issue: API Keys Not Working
```
Fix: Verify environment variables are set
- Railway: railway variables
- Render: Dashboard → Environment
- Check variable names match exactly
```

---

## 📈 Next Steps After Deployment

1. **Set up custom domain** (optional)
   - Railway: Settings → Domains
   - Vercel: Settings → Domains
   - Render: Settings → Custom Domain

2. **Enable HTTPS** (automatic on all platforms)

3. **Set up monitoring**
   - Railway: Built-in metrics
   - Render: Metrics tab
   - Consider: Sentry, LogRocket

4. **Set up CI/CD**
   ```bash
   # All platforms auto-deploy on git push
   git push origin main
   ```

5. **Database backups**
   - Supabase: Daily automatic
   - Render: Point-in-time recovery
   - Railway: Manual backups

---

## 🎯 Recommended Deployment Path

**For fastest deployment (30 minutes):**

1. **Railway** (Backend + Database)
   ```bash
   railway login
   railway init
   railway add --database postgresql
   railway up
   ```

2. **Vercel** (Frontend)
   ```bash
   vercel
   ```

3. **Done!** Your app is live

**URL Structure:**
- Frontend: `https://arqam.vercel.app`
- Backend: `https://arqam.up.railway.app/api`
- Database: Railway PostgreSQL (internal)

---

## 💡 Pro Tips

1. **Use Docker locally** to match production environment
2. **Test with production DATABASE_URL** before deploying
3. **Set DEBUG=false** in production
4. **Monitor logs** after deployment
5. **Set up health checks** for uptime monitoring
6. **Use Supabase** for easy scaling later

---

## 📞 Need Help?

- Railway: [docs.railway.app](https://docs.railway.app)
- Render: [render.com/docs](https://render.com/docs)
- Vercel: [vercel.com/docs](https://vercel.com/docs)
- Supabase: [supabase.com/docs](https://supabase.com/docs)

---

**Ready to deploy?** Start with Railway - it's the fastest path to production!


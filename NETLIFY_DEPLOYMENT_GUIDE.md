# Netlify Deployment Guide for ARQAM

## Overview

Your ARQAM application consists of:
- **Frontend**: Static HTML/CSS/JS files (`frontend/public/`)
- **Backend**: Python FastAPI application (`backend/`)

Netlify is excellent for static sites, but Python backends require a different approach.

---

## Option 1: Frontend Only on Netlify (Recommended for Quick Deploy)

### Step 1: Prepare Frontend Files

1. **Create a `netlify.toml` configuration file:**

```toml
[build]
  publish = "frontend/public"
  
[[redirects]]
  from = "/*"
  to = "/project-npv.html"
  status = 200
```

2. **Update API endpoint in your JavaScript files:**
   - You'll need to deploy the backend separately (see Option 3)
   - Update API URLs in your JS files to point to your deployed backend

### Step 2: Deploy via Netlify UI

1. **Sign up/Login to Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Sign up or log in (GitHub, GitLab, or Bitbucket)

2. **Deploy from Git:**
   - Click "Add new site" → "Import an existing project"
   - Connect your Git provider
   - Select your repository
   - Configure build settings:
     - **Build command**: Leave empty (static files)
     - **Publish directory**: `frontend/public`
   - Click "Deploy site"

3. **Alternative: Drag & Drop Deploy:**
   - Go to Netlify dashboard
   - Drag the `frontend/public` folder directly to the deploy area
   - Netlify will deploy immediately

### Step 3: Custom Domain (Optional)

1. Go to "Site settings" → "Domain management"
2. Click "Add custom domain"
3. Follow instructions to configure DNS

---

## Option 2: Deploy via Netlify CLI

### Step 1: Install Netlify CLI

```bash
npm install -g netlify-cli
# or
brew install netlify-cli  # macOS
```

### Step 2: Login to Netlify

```bash
netlify login
```

### Step 3: Initialize and Deploy

```bash
cd /Users/artem/Desktop/PythonProject

# Initialize Netlify site
netlify init

# Deploy to production
netlify deploy --prod --dir=frontend/public
```

---

## Option 3: Full Stack Deployment

Since Netlify doesn't natively support Python backends, you have these options:

### A. Deploy Backend to Render/Railway/Heroku

**Render (Recommended):**

1. Go to [render.com](https://render.com)
2. Create a new "Web Service"
3. Connect your repository
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment Variables**: Add your API keys (EOD_API_KEY, FINNHUB_API_KEY, OPENAI_API_KEY, etc.)

5. Deploy backend first, get the URL (e.g., `https://your-backend.onrender.com`)

**Then deploy frontend to Netlify:**

6. Update your frontend API endpoints to point to Render backend
7. Deploy frontend to Netlify as described in Option 1

### B. Use Netlify Functions for Backend

This requires converting your Python FastAPI backend to Netlify Functions (JavaScript/TypeScript), which is a significant rewrite. Not recommended for this project.

---

## Quick Deploy Steps (Summary)

### For Frontend Only:

```bash
# 1. Navigate to project
cd /Users/artem/Desktop/PythonProject

# 2. Create netlify.toml
cat > netlify.toml << 'EOF'
[build]
  publish = "frontend/public"
  
[[redirects]]
  from = "/*"
  to = "/project-npv.html"
  status = 200
EOF

# 3. Install Netlify CLI
npm install -g netlify-cli

# 4. Login
netlify login

# 5. Deploy
netlify deploy --prod --dir=frontend/public
```

### For Full Stack:

1. **Deploy Backend to Render:**
   - Create account at render.com
   - Create Web Service
   - Set environment variables
   - Deploy backend
   - Note the backend URL

2. **Update Frontend API URLs:**
   ```javascript
   // In your JS files, update:
   const API_BASE_URL = 'https://your-backend.onrender.com';
   const DCF_API_BASE = 'https://your-backend.onrender.com';
   ```

3. **Deploy Frontend to Netlify:**
   ```bash
   netlify deploy --prod --dir=frontend/public
   ```

---

## Environment Variables

### Backend (Render/Railway):
- `EOD_API_KEY`
- `FINNHUB_API_KEY`
- `OPENAI_API_KEY`
- `CORS_ORIGINS` (set to your Netlify URL)

### Frontend (No env vars needed):
- API URLs are hardcoded in JavaScript files

---

## Post-Deployment Checklist

- [ ] Frontend deployed and accessible
- [ ] Backend deployed and accessible
- [ ] CORS configured correctly
- [ ] All API keys set in backend environment
- [ ] API endpoints in frontend updated
- [ ] Custom domain configured (optional)
- [ ] HTTPS enabled (automatic on Netlify)
- [ ] Test all features:
  - [ ] NPV Calculator
  - [ ] Company DCF (AI NPV)
  - [ ] PDF/Excel export
  - [ ] Ticker search
  - [ ] Data fetching

---

## Troubleshooting

### Issue: "Failed to fetch" errors
- **Solution**: Check CORS settings in backend, ensure frontend URL is allowed

### Issue: API keys not working
- **Solution**: Verify environment variables are set in backend hosting platform

### Issue: 404 errors on page refresh
- **Solution**: Ensure `netlify.toml` has the redirect rule

### Issue: Backend is slow/cold starts
- **Solution**: Render free tier has cold starts; upgrade to paid tier for always-on

---

## Costs

### Netlify:
- **Free tier**: 100GB bandwidth, 300 build minutes/month
- **Pro**: $19/month (unlimited bandwidth, more build minutes)

### Render (Backend):
- **Free tier**: Available (with cold starts)
- **Starter**: $7/month (always-on)

### Railway (Alternative Backend):
- **Free tier**: $5 credit/month
- **Pay as you go**: After free credit

---

## Additional Resources

- [Netlify Documentation](https://docs.netlify.com)
- [Render Documentation](https://render.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)

---

## Support

If you encounter issues:
1. Check Netlify build logs
2. Check backend logs in Render/Railway
3. Verify all environment variables
4. Test API endpoints directly with curl/Postman
5. Check browser console for frontend errors


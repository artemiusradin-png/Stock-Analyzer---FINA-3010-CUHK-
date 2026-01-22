# Quick Deploy Checklist

## ✅ Frontend Status
- [x] Frontend deployed to Netlify via GitHub
- [x] Frontend URL: https://arqam-project.netlify.app

## 🔲 Backend Status (Do This Next)

### 1. Deploy Backend to Render
- [ ] Go to https://dashboard.render.com
- [ ] Sign up/Login with GitHub
- [ ] Click "New +" → "Web Service"
- [ ] Connect your GitHub repository
- [ ] Configure:
  - Name: `arqam-backend`
  - Environment: `Docker`
  - Dockerfile Path: `backend/Dockerfile`
  - Docker Context: `backend`
  - Health Check: `/health`
- [ ] Add environment variables (see below)
- [ ] Deploy and wait 5-10 minutes
- [ ] Copy backend URL (e.g., `https://arqam-backend.onrender.com`)

### 2. Environment Variables for Render
Add these in Render dashboard:
```
OPENAI_API_KEY=your_key_here
FINNHUB_API_KEY=d10doh1r01qlsac8fq2gd10doh1r01qlsac8fq30
FRED_API_KEY=01b4c1c4a8763cb79b98119a3c32d0a8
EOD_API_KEY=692e837b7e7e92.63340340
DEBUG=false
LOG_LEVEL=INFO
```

### 3. Update Frontend (If Backend URL is Different)
- [ ] Edit `frontend/public/project-npv.html` line 8
- [ ] Update backend URL if different
- [ ] Commit and push to GitHub
- [ ] Netlify will auto-deploy

### 4. Test Connection
- [ ] Visit backend: `https://your-backend-url.onrender.com/health`
- [ ] Should see: `{"status": "healthy"}`
- [ ] Visit frontend: https://arqam-project.netlify.app/project-npv.html
- [ ] Open console (F12) - should see "✓ Backend connected"
- [ ] Test API: Enter "AAPL" → Click "Fetch Data"

## 🎯 Current Configuration

**Frontend URL**: https://arqam-project.netlify.app  
**Expected Backend URL**: https://arqam-backend.onrender.com  
**Frontend Config**: `frontend/public/project-npv.html` line 8

## 📝 Files That May Need Updates

If your backend URL is different from `https://arqam-backend.onrender.com`:

1. `frontend/public/project-npv.html` (line 8)
2. `netlify.toml` (lines 12, 20)
3. `deploy/render.yaml` (line 37) - if using Render blueprint

## 🚀 Quick Commands

```bash
# Check if backend is accessible
curl https://arqam-backend.onrender.com/health

# Update frontend and push
git add frontend/public/project-npv.html
git commit -m "Update backend URL"
git push origin main
```



# Step-by-Step Deployment Guide for PythonProject

## Your Current Folder Structure

```
/Users/artem/Desktop/PythonProject/
├── frontend/
│   └── public/           ← This goes to Netlify
│       ├── project-npv.html
│       ├── css/
│       ├── js/
│       └── assets/
├── backend/              ← This goes to Render
│   ├── app/
│   ├── requirements.txt
│   └── ...
└── other files
```

---

## STEP 1: Prepare Your Files

### A. Create Netlify Configuration

```bash
# Open Terminal and navigate to your project
cd /Users/artem/Desktop/PythonProject

# Create netlify.toml file
cat > netlify.toml << 'EOF'
[build]
  publish = "frontend/public"

[[redirects]]
  from = "/*"
  to = "/project-npv.html"
  status = 200
EOF
```

### B. Check Your Backend Files

Make sure you have:
- ✅ `backend/requirements.txt`
- ✅ `backend/app/main.py`
- ✅ `backend/.env` (with all your API keys)

---

## STEP 2: Deploy Backend First (to Render)

### Why Backend First?
You need the backend URL to update your frontend API endpoints.

### Steps:

1. **Go to [render.com](https://render.com)**
   - Click "Get Started for Free"
   - Sign up with GitHub/GitLab/email

2. **Create a New Web Service**
   - Click "New +" → "Web Service"
   - Choose "Build and deploy from a Git repository"

3. **Connect Your Repository**
   - If you have a Git repo: Connect it
   - If not: You'll need to push to GitHub first (see Step 2B)

4. **Configure the Service:**
   ```
   Name: arqam-backend
   Region: Oregon (US West) or closest to you
   Branch: main (or master)
   Root Directory: backend
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

5. **Add Environment Variables:**
   Click "Advanced" → "Add Environment Variable"
   
   Add these (get values from your `backend/.env` file):
   ```
   EOD_API_KEY=your_key_here
   FINNHUB_API_KEY=your_key_here
   OPENAI_API_KEY=your_key_here
   CORS_ORIGINS=*
   ```

6. **Deploy Backend**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Copy your backend URL: `https://arqam-backend-xxxx.onrender.com`

---

## STEP 2B (If No Git Repository): Push to GitHub First

```bash
cd /Users/artem/Desktop/PythonProject

# Initialize git if not already done
git init

# Create .gitignore if not exists
cat > .gitignore << 'EOF'
venv/
__pycache__/
*.pyc
*.pyo
.env
backend/.env
frontend/public/outputs/
node_modules/
.DS_Store
EOF

# Add files
git add .

# Commit
git commit -m "Initial commit"

# Create repository on GitHub (github.com/new)
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

Then go back to Step 2 and connect this repository to Render.

---

## STEP 3: Update Frontend API URLs

Once backend is deployed, you need to update your frontend to point to it.

### Find and Replace in JavaScript Files:

```bash
cd /Users/artem/Desktop/PythonProject/frontend/public/js

# You need to update these files:
# - main.js
# - dcf-module.js (or similar)
# - ai-npv-module.js (or similar)
```

**Find these lines:**
```javascript
const API_BASE_URL = 'http://localhost:8000';
const DCF_API_BASE = 'http://localhost:8000';
```

**Replace with your Render URL:**
```javascript
const API_BASE_URL = 'https://arqam-backend-xxxx.onrender.com';
const DCF_API_BASE = 'https://arqam-backend-xxxx.onrender.com';
```

### Manual Steps:

1. Open each JS file in your text editor
2. Search for `localhost:8000`
3. Replace with your Render backend URL
4. Save all files

---

## STEP 4: Deploy Frontend (to Netlify)

### Option A: Using Netlify CLI (Recommended)

```bash
# Install Netlify CLI (only need to do once)
npm install -g netlify-cli

# Or on macOS:
brew install netlify-cli

# Navigate to your project
cd /Users/artem/Desktop/PythonProject

# Login to Netlify
netlify login
# (This will open browser - follow the login steps)

# Initialize Netlify site
netlify init
# Follow prompts:
# - Create & configure a new site
# - Team: Your team
# - Site name: arqam-npv (or your choice)
# - Build command: (leave empty)
# - Directory to deploy: frontend/public

# Deploy to production
netlify deploy --prod
```

### Option B: Drag & Drop (Easier but less flexible)

1. **Go to [app.netlify.com](https://app.netlify.com)**
2. **Sign up/Login**
3. **Drag the `frontend/public` folder** from Finder directly into the Netlify dashboard
4. **Wait for deployment** (1-2 minutes)
5. **Get your URL**: `https://your-site-name.netlify.app`

### Option C: Connect Git Repository

1. **Go to [app.netlify.com](https://app.netlify.com)**
2. **Click "Add new site" → "Import an existing project"**
3. **Connect your Git provider** (GitHub/GitLab)
4. **Select your repository**
5. **Configure build settings:**
   ```
   Build command: (leave empty)
   Publish directory: frontend/public
   ```
6. **Click "Deploy site"**

---

## STEP 5: Update Backend CORS Settings

Once you have your Netlify URL, update backend CORS:

1. **Go to your Render dashboard**
2. **Click your backend service**
3. **Go to "Environment"**
4. **Update `CORS_ORIGINS`:**
   ```
   CORS_ORIGINS=https://your-site-name.netlify.app
   ```
5. **Save** (this will redeploy)

---

## STEP 6: Test Your Deployment

1. **Visit your Netlify URL**: `https://your-site-name.netlify.app`
2. **Test each feature:**
   - ✅ NPV Calculator works
   - ✅ Company DCF (AI NPV) works
   - ✅ Ticker search works
   - ✅ PDF export works
   - ✅ Excel export works

### If Something Doesn't Work:

**Check Browser Console (F12):**
- Look for CORS errors
- Look for 404 errors
- Check API endpoint URLs

**Check Backend Logs:**
- Go to Render dashboard
- Click your service
- Click "Logs"
- Look for errors

---

## Summary: What Goes Where

| What | Where | How |
|------|-------|-----|
| **Backend** (`backend/` folder) | Render.com | Web Service |
| **Frontend** (`frontend/public/` folder) | Netlify.com | Static Site |
| **API Keys** | Render Environment Variables | Manually add |
| **API URLs in JS** | Update in JS files | Find/Replace localhost |

---

## Quick Reference URLs

After deployment, bookmark these:

- **Frontend**: `https://your-site-name.netlify.app`
- **Backend**: `https://arqam-backend-xxxx.onrender.com`
- **Backend API Docs**: `https://arqam-backend-xxxx.onrender.com/docs`
- **Netlify Dashboard**: https://app.netlify.com
- **Render Dashboard**: https://dashboard.render.com

---

## Costs

- **Netlify Free Tier**: ✅ More than enough for your site
- **Render Free Tier**: ✅ Backend will work (with cold starts)
- **Upgrade if needed**: ~$7-19/month combined for always-on service

---

## Need Help?

1. Check browser console (F12)
2. Check Render logs
3. Verify environment variables are set
4. Test backend directly: `https://your-backend.onrender.com/docs`
5. Make sure CORS is configured correctly


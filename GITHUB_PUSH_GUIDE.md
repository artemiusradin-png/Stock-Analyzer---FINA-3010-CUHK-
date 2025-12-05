# GitHub Push Guide - What to Include/Exclude

## ✅ PUSH TO GITHUB (Safe to Share)

### Backend Files:
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── ai_npv.py
│   │   ├── dcf.py
│   │   └── ... (all .py files)
│   ├── services/
│   │   ├── __init__.py
│   │   └── ... (all .py files)
│   └── models/
│       └── ... (all .py files)
├── requirements.txt
├── requirements-production.txt (if exists)
├── requirements-dev.txt (if exists)
└── Dockerfile (if exists)
```

### Frontend Files:
```
frontend/
└── public/
    ├── project-npv.html
    ├── dcf_web_interface.html (if exists)
    ├── index.html
    ├── css/
    │   ├── animations.css
    │   ├── base.css
    │   ├── components.css
    │   ├── layout.css
    │   ├── responsive.css
    │   └── variables.css
    ├── js/
    │   ├── main.js
    │   ├── ticker-handler.js
    │   ├── npv-module.js
    │   ├── ai-npv-module.js
    │   ├── dcf-module.js
    │   └── lib/
    │       └── simplex-noise.js
    └── assets/ (images, fonts, etc.)
```

### Root Level Files:
```
├── .gitignore ✅
├── README.md ✅
├── netlify.toml ✅
├── DEPLOYMENT_STEPS.md ✅
├── NETLIFY_DEPLOYMENT_GUIDE.md ✅
├── requirements.txt ✅
├── docker-compose.yml (if exists) ✅
├── nginx.conf (if exists) ✅
└── Any other documentation ✅
```

---

## ❌ DO NOT PUSH TO GITHUB (Keep Private)

### Critical - Contains API Keys:
```
❌ backend/.env
❌ .env
❌ backend/app/.env
❌ Any file with API keys
```

### Generated/Temporary Files:
```
❌ venv/
❌ __pycache__/
❌ *.pyc
❌ *.pyo
❌ *.pyd
❌ .Python
❌ node_modules/
❌ .DS_Store
❌ .vscode/
❌ .idea/
❌ *.log
```

### Output/Generated Files:
```
❌ frontend/public/outputs/
❌ outputs/
❌ *.pdf (generated PDFs)
❌ *.xlsx (generated Excel files)
```

### Database Files (if any):
```
❌ *.db
❌ *.sqlite
❌ *.sqlite3
```

---

## Your .gitignore File

Your current `.gitignore` should contain:

```gitignore
# Virtual Environment
venv/
env/
ENV/
.venv

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python

# Environment Variables (IMPORTANT!)
.env
backend/.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Outputs
frontend/public/outputs/
outputs/
*.pdf
*.xlsx

# Node
node_modules/

# Logs
*.log
logs/
```

---

## Step-by-Step: Push to GitHub

### 1. Check/Create .gitignore

```bash
cd /Users/artem/Desktop/PythonProject

# Check if .gitignore exists
ls -la | grep gitignore

# If it doesn't exist, create it:
cat > .gitignore << 'EOF'
# Virtual Environment
venv/
env/
ENV/

# Python
__pycache__/
*.py[cod]
*.pyc
*.pyo

# Environment Variables - CRITICAL!
.env
backend/.env
*.env

# IDE
.vscode/
.idea/

# OS
.DS_Store

# Outputs
frontend/public/outputs/
outputs/

# Node
node_modules/

# Logs
*.log
EOF
```

### 2. Initialize Git (if not done)

```bash
cd /Users/artem/Desktop/PythonProject

# Initialize git
git init

# Check git status
git status
```

### 3. Verify Sensitive Files Are Ignored

```bash
# Check what will be committed
git status

# Make sure these ARE NOT listed:
# - backend/.env
# - venv/
# - __pycache__/

# If .env shows up, add it to .gitignore immediately!
```

### 4. Create .env.example (Template)

```bash
# Create a template without actual keys
cat > backend/.env.example << 'EOF'
# API Keys (Get your own from respective providers)
EOD_API_KEY=your_eod_api_key_here
FINNHUB_API_KEY=your_finnhub_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
CORS_ORIGINS=http://localhost:5500,http://localhost:3000

# Database (if using)
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
EOF
```

### 5. Add Files to Git

```bash
# Add all files (gitignore will exclude sensitive ones)
git add .

# Verify what's staged
git status

# If .env shows up, STOP and fix .gitignore!
```

### 6. Commit

```bash
git commit -m "Initial commit: ARQAM NPV Calculator"
```

### 7. Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name: `arqam-npv-calculator` (or your choice)
3. Description: "AI-powered NPV and DCF calculator for investment analysis"
4. **Private** or Public (recommend Private if contains any sensitive info)
5. **DO NOT** initialize with README (you already have files)
6. Click "Create repository"

### 8. Push to GitHub

```bash
# Add remote (replace with your actual URL)
git remote add origin https://github.com/YOUR_USERNAME/arqam-npv-calculator.git

# Rename branch to main (if needed)
git branch -M main

# Push
git push -u origin main
```

---

## ⚠️ CRITICAL CHECKLIST Before Pushing

Run this checklist:

```bash
# 1. Check .env is ignored
git status | grep .env
# Should return NOTHING

# 2. Check venv is ignored
git status | grep venv
# Should return NOTHING

# 3. Check what WILL be pushed
git ls-files
# Review the list - should NOT see .env, venv/, etc.

# 4. Search for any API keys in tracked files
git grep -i "api.*key" 
# Make sure no actual keys are in code
```

---

## After Pushing to GitHub

### Update README.md

Create a proper README:

```markdown
# ARQAM - Investment Analysis & Valuation

AI-powered NPV and DCF calculator for investment analysis.

## Features
- Project NPV Calculator
- Company DCF (AI-powered)
- PDF/Excel export
- Real-time data from EOD, Finnhub, OpenAI

## Deployment
See [DEPLOYMENT_STEPS.md](DEPLOYMENT_STEPS.md)

## Environment Variables
Copy `.env.example` to `.env` and add your API keys.

## Local Development
1. Backend: `cd backend && uvicorn app.main:app --reload`
2. Frontend: Open `frontend/public/project-npv.html` in browser with live server
```

---

## Security Best Practices

1. ✅ **Never commit `.env` files**
2. ✅ **Use `.env.example` as template**
3. ✅ **Keep repository Private** (until you're sure no secrets leaked)
4. ✅ **Rotate API keys** if accidentally committed
5. ✅ **Use GitHub Secrets** for CI/CD (if using)

---

## If You Accidentally Committed Secrets

```bash
# Remove from git history (dangerous!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env" \
  --prune-empty --tag-name-filter cat -- --all

# Then rotate ALL API keys immediately!
```

Better: Just create a new repo and push clean files.

---

## Summary

**PUSH:** All source code, configs, documentation
**DON'T PUSH:** .env files, venv/, __pycache__, outputs/
**CRITICAL:** Double-check .env is NOT in git status before pushing!


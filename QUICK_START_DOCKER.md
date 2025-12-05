# Docker Quick Start Guide

## 🚀 Run Your App with Docker in 5 Minutes

### Prerequisites
- Docker Desktop installed ([docker.com](https://www.docker.com/products/docker-desktop/))
- Your API keys ready

---

## Step 1: Configure Environment Variables

Create `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```bash
OPENAI_API_KEY=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
FINNHUB_API_KEY=d10doh1r01qlsac8fq2gd10doh1r01qlsac8fq30
FRED_API_KEY=01b4c1c4a8763cb79b98119a3c32d0a8
EOD_API_KEY=692e837b7e7e92.63340340
```

---

## Step 2: Build and Run

```bash
cd /Users/artem/Desktop/PythonProject

# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

**That's it!** Your app is now running:

- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432

---

## Step 3: Test the Application

Open your browser and go to:
```
http://localhost
```

You should see the ARQAM Portfolio Management interface!

---

## 🎯 Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Frontend only
docker-compose logs -f frontend
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (database data)
docker-compose down -v
```

### Rebuild After Code Changes
```bash
# Rebuild and restart
docker-compose up --build

# Or rebuild specific service
docker-compose up --build backend
```

### Access Database
```bash
# Connect to PostgreSQL
docker-compose exec db psql -U postgres -d arqam

# Or use any PostgreSQL client:
# Host: localhost
# Port: 5432
# User: postgres
# Password: postgres
# Database: arqam
```

### Run Database Migrations
```bash
# Access backend container
docker-compose exec backend bash

# Run migrations (if you have alembic set up)
alembic upgrade head
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# If port 8000 or 80 is already in use, stop the service:
# On macOS/Linux:
lsof -ti:8000 | xargs kill -9
lsof -ti:80 | xargs kill -9

# Or change ports in docker-compose.yml:
ports:
  - "8001:8000"  # Use 8001 instead of 8000
```

### Database Connection Error
```bash
# Reset database
docker-compose down -v
docker-compose up --build
```

### Backend Crashes on Startup
```bash
# Check logs
docker-compose logs backend

# Common fix: Missing environment variables
# Make sure .env file exists and has all required keys
```

### Frontend Shows "Cannot connect to backend"
```bash
# Make sure backend is running
docker-compose ps

# Check backend health
curl http://localhost:8000/health

# Check frontend is pointing to correct backend URL
# Should be: http://localhost:8000 (Docker internal networking)
```

---

## 🔄 Development Workflow

### Option 1: Full Docker (No Local venv Needed)
```bash
# 1. Make code changes in your editor
# 2. Rebuild and restart
docker-compose up --build

# Hot reload is enabled for development
# Changes to Python files will auto-reload
```

### Option 2: Hybrid (Frontend in Docker, Backend Local)
```bash
# Run only frontend and database in Docker
docker-compose up frontend db

# Run backend locally with hot reload
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

---

## 📦 Docker Image Sizes

| Component | Size |
|-----------|------|
| Backend (Python 3.11-slim) | ~400MB |
| Frontend (Nginx Alpine) | ~50MB |
| PostgreSQL 15 | ~200MB |
| **Total** | ~650MB |

**Note**: These images are downloaded once and cached. Rebuilds are much faster!

---

## 🚀 Production Deployment

For production, use the deployment guides:
- See `DEPLOYMENT_GUIDE.md` for Railway, Render, Vercel
- Docker images are production-ready
- Just set `DEBUG=false` in environment variables

---

## 💡 Pro Tips

1. **Use Docker volumes for development**
   ```yaml
   # Already configured in docker-compose.yml
   volumes:
     - ./backend/app:/app/app  # Auto-reload on changes
   ```

2. **Clean up regularly**
   ```bash
   # Remove unused images/containers
   docker system prune -a
   ```

3. **Use Docker Desktop Dashboard**
   - Visual interface for managing containers
   - Easy access to logs
   - Resource monitoring

4. **Environment-specific configs**
   ```bash
   # Development
   docker-compose up

   # Production
   docker-compose -f docker-compose.prod.yml up
   ```

---

## 🎓 Next Steps

1. **Explore the API**: http://localhost:8000/docs
2. **Check database**: Use any PostgreSQL client
3. **Read deployment guide**: `DEPLOYMENT_GUIDE.md`
4. **Set up Supabase**: See `SUPABASE_INTEGRATION_PLAN.md`

---

**Need help?** Check the logs first:
```bash
docker-compose logs -f
```


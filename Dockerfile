# Simplified Dockerfile for Render - single stage build
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from backend directory
COPY backend/requirements-production.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-production.txt

# Ensure gunicorn module is accessible (python -m gunicorn works regardless of script location)
RUN python -c "import gunicorn" || pip install --no-cache-dir gunicorn

# Copy application code from backend directory
COPY backend/app/ ./app/

# Set PATH to include both installation locations
ENV PATH=/usr/local/bin:/root/.local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin:$PATH

# Expose port
EXPOSE 8000

# Health check - use curl instead of requests (more reliable)
# Increased start-period to 40s to allow Render free tier to wake up
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run with Gunicorn for production
# Use python -m gunicorn which works regardless of where gunicorn script is installed
CMD ["python", "-m", "gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-"]



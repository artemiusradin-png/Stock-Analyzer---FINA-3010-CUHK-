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

# Install Python dependencies globally to /usr/local (not /root/.local)
# This ensures scripts are accessible without PATH issues
RUN pip install --no-cache-dir --prefix=/usr/local -r requirements-production.txt || \
    pip install --no-cache-dir -r requirements-production.txt

# Copy application code from backend directory
COPY backend/app/ ./app/

# Ensure PATH includes standard locations
ENV PATH=/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin:/root/.local/bin:$PATH

# Expose port
EXPOSE 8000

# Health check - use curl instead of requests (more reliable)
# Increased start-period to 40s to allow Render free tier to wake up
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run with Gunicorn for production
# Use full path to python and python -m to avoid PATH issues
CMD ["/usr/local/bin/python", "-m", "gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-"]



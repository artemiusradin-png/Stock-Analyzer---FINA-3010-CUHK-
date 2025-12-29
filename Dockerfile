# Simple, reliable Dockerfile for Render
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY backend/requirements-production.txt .

# Install Python dependencies (will install to /usr/local/lib/python3.11/site-packages)
RUN pip install --no-cache-dir -r requirements-production.txt

# Copy application code
COPY backend/app/ ./app/

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Use uvicorn directly (simpler than gunicorn, works reliably)
# This avoids all PATH/permission issues with gunicorn scripts
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

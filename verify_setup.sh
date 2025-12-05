#!/bin/bash

echo "🔍 Portfolio Management Platform - Setup Verification"
echo "======================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "START_HERE.md" ]; then
    echo "❌ Please run this script from /Users/artem/Desktop/PythonProject"
    exit 1
fi

echo "✅ Running from correct directory"
echo ""

# Check backend files
echo "📁 Checking Backend Files..."
if [ -f "backend/.env" ]; then
    echo "  ✅ .env file exists"
else
    echo "  ❌ .env file missing"
fi

if [ -f "backend/docker-compose.yml" ]; then
    echo "  ✅ docker-compose.yml exists"
else
    echo "  ❌ docker-compose.yml missing"
fi

if [ -f "backend/requirements.txt" ]; then
    echo "  ✅ requirements.txt exists"
else
    echo "  ❌ requirements.txt missing"
fi

echo ""

# Check frontend files
echo "📁 Checking Frontend Files..."
if [ -f "frontend/public/index.html" ]; then
    echo "  ✅ index.html exists"
else
    echo "  ❌ index.html missing"
fi

if [ -f "frontend/public/project-npv.html" ]; then
    echo "  ✅ project-npv.html exists"
else
    echo "  ❌ project-npv.html missing"
fi

if [ -f "frontend/public/js/api-client.js" ]; then
    echo "  ✅ api-client.js exists"
else
    echo "  ❌ api-client.js missing"
fi

echo ""

# Check if Docker is running
echo "🐳 Checking Docker..."
if docker ps >/dev/null 2>&1; then
    echo "  ✅ Docker is running"
else
    echo "  ❌ Docker is not running - please start Docker Desktop"
    exit 1
fi

echo ""

# Check API keys in .env
echo "🔑 Checking API Keys..."
if grep -q "d10doh1r01qlsac8fq2gd10doh1r01qlsac8fq30" backend/.env; then
    echo "  ✅ Finnhub API key configured"
else
    echo "  ⚠️  Finnhub API key not found"
fi

if grep -q "01b4c1c4a8763cb79b98119a3c32d0a8" backend/.env; then
    echo "  ✅ FRED API key configured"
else
    echo "  ⚠️  FRED API key not found"
fi

if grep -q "692e837b7e7e92.63340340" backend/.env; then
    echo "  ✅ EOD API key configured"
else
    echo "  ⚠️  EOD API key not found"
fi

echo ""
echo "======================================================"
echo "✅ Setup verification complete!"
echo ""
echo "📖 Next steps:"
echo "   1. cd backend && docker-compose up -d"
echo "   2. open http://localhost:8000/docs"
echo "   3. open frontend/public/index.html"
echo ""
echo "📚 Read START_HERE.md for detailed instructions"
echo "======================================================"

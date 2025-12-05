#!/bin/bash
# Start DCF API Server (bootstrap helper)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "Starting DCF API Server..."

# Prefer Python 3.11 to match library versions; fall back to python3
PYTHON_BIN="$(command -v python3.11 || command -v python3)"

if [ ! -x "$PYTHON_BIN" ]; then
    echo "Error: python3 or python3.11 not found on PATH."
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment with $PYTHON_BIN..."
    "$PYTHON_BIN" -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

PORT="${PORT:-5050}"
export PORT

# Install requirements
echo "Installing dependencies..."
pip install -r requirements.txt

# Start Flask API
echo "Starting Flask server on port ${PORT}..."
python backend/scripts/start_dcf_server.py

#!/usr/bin/env python3
"""Start the DCF Flask API server."""

import os
import sys
from pathlib import Path

# Ensure the backend package is on the import path when running directly
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from dcf_service import app

if __name__ == '__main__':
    port = int(os.environ.get("PORT", "5050"))

    print("Starting DCF API Server...")
    print("Available endpoints:")
    print("   GET  /api/health - Health check")
    print("   POST /api/dcf/calculate - Calculate DCF valuation")
    print("   POST /api/dcf/sensitivity - Sensitivity analysis")
    print(f"\n🌐 Server will be available at: http://127.0.0.1:{port}")
    print("📝 Example API call:")
    print(f'   curl -X POST http://127.0.0.1:{port}/api/dcf/calculate \\')
    print('        -H "Content-Type: application/json" \\')
    print('        -d \'{"ticker": "AAPL", "years": 10, "terminal_growth": 0.025, "wacc": 0.08}\'')
    print("\nPress Ctrl+C to stop the server")
    print("-" * 50)
    
    app.run(host='127.0.0.1', port=port, debug=False)

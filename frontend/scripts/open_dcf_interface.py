#!/usr/bin/env python3
"""Open the DCF web interface in the browser."""

import webbrowser
from pathlib import Path

def open_dcf_interface():
    # Resolve the HTML file relative to this script
    project_root = Path(__file__).resolve().parents[2]
    html_file = project_root / "frontend" / "public" / "dcf_web_interface.html"
    
    print("🌐 Opening DCF Web Interface...")
    print(f"📄 HTML file: {html_file}")
    print("🚀 Make sure the DCF API server is running on port 8080")
    print("   Run: python backend/scripts/start_dcf_server.py")
    print()
    
    # Open in browser
    webbrowser.open(html_file.as_uri())
    print("✅ Web interface opened in your default browser!")
    print()
    print("📝 Instructions:")
    print("1. Enter a stock ticker (e.g., AAPL, MSFT, GOOGL)")
    print("2. Adjust forecast parameters if needed")
    print("3. Click 'Calculate DCF Valuation'")
    print("4. View the results!")

if __name__ == "__main__":
    open_dcf_interface()

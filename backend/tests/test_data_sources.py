#!/usr/bin/env python3
"""Test both yfinance and Finnhub data sources"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_yfinance():
    print("Testing yfinance...")
    try:
        import yfinance as yf
        stock = yf.Ticker('AAPL')
        info = stock.info
        print(f"✓ yfinance working: {info.get('longName', 'Unknown')}")
        return True
    except Exception as e:
        print(f"✗ yfinance failed: {str(e)}")
        return False

def test_finnhub():
    print("Testing Finnhub...")
    try:
        import requests
        api_key = "cjhqj1pr01qjqjqjqjqjqjqjqjqjqjqjqjqj"
        url = f"https://finnhub.io/api/v1/stock/profile2?symbol=AAPL&token={api_key}"
        response = requests.get(url, timeout=10)
        data = response.json()
        print(f"✓ Finnhub working: {data.get('name', 'Unknown')}")
        return True
    except Exception as e:
        print(f"✗ Finnhub failed: {str(e)}")
        return False

def test_alternative():
    print("Testing alternative approach...")
    try:
        # Try a different approach - use a free API key or different method
        import requests
        # Use a public API that doesn't require keys
        url = "https://api.polygon.io/v1/meta/symbols/AAPL/company?apikey=demo"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            print("✓ Alternative API working")
            return True
        else:
            print(f"✗ Alternative API failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Alternative API failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("Testing data sources...")
    
    yf_works = test_yfinance()
    finnhub_works = test_finnhub()
    alt_works = test_alternative()
    
    if not any([yf_works, finnhub_works, alt_works]):
        print("\n❌ All data sources failed!")
        print("This explains why the API is returning null values.")
        print("We need to either:")
        print("1. Wait for rate limits to reset")
        print("2. Use a different data source")
        print("3. Implement proper API key management")
    else:
        print(f"\n✅ At least one data source is working!")


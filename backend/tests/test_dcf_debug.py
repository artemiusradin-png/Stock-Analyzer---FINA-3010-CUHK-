#!/usr/bin/env python3
"""
Debug script to test DCF API data fetching
"""
import requests
import json

# Test the DCF API with debugging
def test_dcf_api():
    url = "http://localhost:8080/api/dcf/calculate"
    data = {
        "ticker": "AAPL",
        "years": 10,
        "terminal_growth": 0.025,
        "wacc": 0.08
    }
    
    print("Testing DCF API...")
    print(f"URL: {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    
    try:
        response = requests.post(url, json=data, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_dcf_api()

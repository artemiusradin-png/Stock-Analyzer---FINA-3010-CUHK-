"""Simple API test script"""
import requests
import json

BASE_URL = "http://localhost:8000"


def test_health():
    """Test health endpoint"""
    print("\n=== Testing Health Endpoint ===")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    return response.status_code == 200


def test_dcf_valuation():
    """Test DCF valuation"""
    print("\n=== Testing DCF Valuation ===")
    payload = {
        "ticker": "AAPL",
        "revenue_growth_start": 0.08,
        "ebit_margin_start": 0.30,
        "forecast_period": 10,
        "terminal_growth": 0.025
    }

    response = requests.post(f"{BASE_URL}/api/valuations/calculate", json=payload)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print(f"Company: {result.get('company_name')}")
        print(f"Current Price: ${result.get('current_price', 0):.2f}")
        print(f"Implied Price: ${result.get('implied_price', 0):.2f}")
        print(f"Upside/Downside: {result.get('upside_downside', 0):.1f}%")
        print(f"WACC: {result.get('wacc', 0):.2f}%")
        print(f"Enterprise Value: ${result.get('enterprise_value', 0):.1f}B")
        return True
    else:
        print(f"Error: {response.text}")
        return False


def test_portfolio_optimization():
    """Test portfolio optimization"""
    print("\n=== Testing Portfolio Optimization ===")
    payload = {
        "assets": [
            {"ticker": "AAPL"},
            {"ticker": "MSFT"},
            {"ticker": "GOOGL"},
            {"ticker": "AMZN"}
        ],
        "strategy": "max_sharpe",
        "lookback_days": 252,
        "risk_free_rate": 0.045
    }

    response = requests.post(f"{BASE_URL}/api/portfolios/optimize", json=payload)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print(f"Strategy: {result.get('strategy')}")
        print(f"Expected Return: {result.get('expected_return', 0)*100:.2f}%")
        print(f"Volatility: {result.get('volatility', 0)*100:.2f}%")
        print(f"Sharpe Ratio: {result.get('sharpe_ratio', 0):.2f}")
        print("\nHoldings:")
        for holding in result.get('holdings', []):
            print(f"  {holding['ticker']}: {holding['weight']*100:.1f}%")
        return True
    else:
        print(f"Error: {response.text}")
        return False


def test_sentiment_analysis():
    """Test sentiment analysis"""
    print("\n=== Testing Sentiment Analysis ===")
    payload = {
        "ticker": "TSLA",
        "days": 30
    }

    response = requests.post(f"{BASE_URL}/api/sentiment/analyze", json=payload)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print(f"Ticker: {result.get('ticker')}")
        print(f"Overall Sentiment: {result.get('overall_sentiment', 0):.3f}")
        print(f"Trend: {result.get('sentiment_trend')}")
        print(f"7-day Avg: {result.get('avg_sentiment_7d', 0):.3f}")
        print(f"News Volume (7d): {result.get('news_volume_7d', 0)}")
        print(f"Sentiment Adjustment: {result.get('sentiment_adjustment', 0):.2f}%")
        return True
    else:
        print(f"Error: {response.text}")
        return False


def test_risk_analysis():
    """Test risk analysis"""
    print("\n=== Testing Risk Analysis ===")
    payload = {
        "ticker": "AAPL",
        "lookback_days": 252,
        "benchmark_ticker": "SPY",
        "risk_free_rate": 0.045
    }

    response = requests.post(f"{BASE_URL}/api/risk/analyze", json=payload)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print(f"Ticker: {result.get('ticker')}")
        print(f"Volatility: {result.get('volatility', 0)*100:.2f}%")
        print(f"Beta: {result.get('beta', 0):.2f}")
        print(f"Sharpe Ratio: {result.get('sharpe_ratio', 0):.2f}")
        print(f"VaR (95%): {result.get('var_95', 0)*100:.2f}%")
        print(f"Max Drawdown: {result.get('max_drawdown', 0)*100:.2f}%")
        return True
    else:
        print(f"Error: {response.text}")
        return False


def main():
    """Run all tests"""
    print("=" * 60)
    print("Portfolio Management API - Test Suite")
    print("=" * 60)

    tests = [
        ("Health Check", test_health),
        ("DCF Valuation", test_dcf_valuation),
        ("Portfolio Optimization", test_portfolio_optimization),
        ("Sentiment Analysis", test_sentiment_analysis),
        ("Risk Analysis", test_risk_analysis)
    ]

    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\nError in {name}: {str(e)}")
            results.append((name, False))

    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")

    passed = sum(1 for _, r in results if r)
    total = len(results)
    print(f"\nPassed: {passed}/{total}")


if __name__ == "__main__":
    main()

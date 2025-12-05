"""
Finnhub API Service
Handles company profile validation and metadata retrieval
"""
import httpx
from typing import Dict, Optional
from app.config import settings


class FinnhubService:
    """Service for interacting with Finnhub API"""

    def __init__(self):
        self.api_key = settings.FINNHUB_API_KEY
        self.base_url = "https://finnhub.io/api/v1"

    async def get_company_profile(self, ticker: str) -> Dict:
        """
        Fetch company profile from Finnhub

        Args:
            ticker: Stock ticker symbol (e.g., AAPL)

        Returns:
            Dictionary with company profile data

        Raises:
            ValueError: If ticker is invalid or not found
            Exception: If API request fails
        """
        url = f"{self.base_url}/stock/profile2"
        params = {
            "symbol": ticker.upper(),
            "token": self.api_key
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                # Finnhub returns empty dict {} if ticker not found
                if not data or not data.get('ticker'):
                    raise ValueError(
                        f"Ticker '{ticker}' not found in Finnhub directory. "
                        "Please verify the ticker symbol is correct and actively traded."
                    )

                # Extract relevant fields
                profile = {
                    "ticker": data.get("ticker", ticker.upper()),
                    "name": data.get("name", ""),
                    "exchange": data.get("exchange", ""),
                    "country": data.get("country", ""),
                    "currency": data.get("currency", "USD"),
                    "ipo": data.get("ipo", ""),
                    "marketCap": data.get("marketCapitalization", 0),
                    "industry": data.get("finnhubIndustry", ""),
                    "logo": data.get("logo", ""),
                    "phone": data.get("phone", ""),
                    "weburl": data.get("weburl", ""),
                    "shareOutstanding": data.get("shareOutstanding", 0)
                }

                return profile

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    raise ValueError(f"Ticker '{ticker}' not found in Finnhub directory")
                elif e.response.status_code == 401:
                    raise Exception("Finnhub API authentication failed. Check API key.")
                elif e.response.status_code == 429:
                    raise Exception("Finnhub API rate limit exceeded. Please try again later.")
                else:
                    raise Exception(f"Finnhub API error: {e.response.status_code}")

            except httpx.TimeoutException:
                raise Exception("Finnhub API request timed out. Please try again.")

            except ValueError:
                # Re-raise ValueError for ticker validation failures
                raise

            except Exception as e:
                raise Exception(f"Failed to fetch company profile from Finnhub: {str(e)}")

    async def get_company_quote(self, ticker: str) -> Dict:
        """
        Fetch current stock quote from Finnhub

        Args:
            ticker: Stock ticker symbol

        Returns:
            Dictionary with current price, change, etc.
        """
        url = f"{self.base_url}/quote"
        params = {
            "symbol": ticker.upper(),
            "token": self.api_key
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                # Finnhub returns 0 for all fields if ticker not found
                if data.get('c', 0) == 0:
                    return None

                quote = {
                    "current": data.get("c", 0),  # Current price
                    "change": data.get("d", 0),   # Change
                    "percentChange": data.get("dp", 0),  # Percent change
                    "high": data.get("h", 0),     # High price of the day
                    "low": data.get("l", 0),      # Low price of the day
                    "open": data.get("o", 0),     # Open price of the day
                    "previousClose": data.get("pc", 0)  # Previous close price
                }

                return quote

            except Exception as e:
                # Return None if quote fetch fails (non-critical)
                return None

    async def search_symbol(self, query: str) -> list:
        """
        Search for ticker symbols by company name

        Args:
            query: Company name or partial ticker

        Returns:
            List of matching results
        """
        url = f"{self.base_url}/search"
        params = {
            "q": query,
            "token": self.api_key
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                results = []
                for item in data.get("result", []):
                    results.append({
                        "symbol": item.get("symbol", ""),
                        "description": item.get("description", ""),
                        "type": item.get("type", ""),
                        "displaySymbol": item.get("displaySymbol", "")
                    })

                return results

            except Exception as e:
                raise Exception(f"Finnhub symbol search failed: {str(e)}")

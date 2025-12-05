"""Asset metadata API endpoints"""
from fastapi import APIRouter, HTTPException
import yfinance as yf

router = APIRouter()


@router.get("/{ticker}")
async def get_asset_info(ticker: str):
    """Get basic information about an asset"""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        return {
            "ticker": ticker,
            "name": info.get("longName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "country": info.get("country"),
            "market_cap": info.get("marketCap"),
            "current_price": info.get("currentPrice"),
            "beta": info.get("beta"),
            "pe_ratio": info.get("forwardPE"),
            "dividend_yield": info.get("dividendYield")
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

"""Valuation API endpoints"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict
import yfinance as yf
import pandas as pd
import numpy as np

from app.database import get_db
from app.schemas.valuation import (
    DCFParameters,
    DCFResult,
    ProjectionYear,
    MultiScenarioResponse,
    ScenarioResult,
    SensitivityResponse,
)
from app.services.dcf_engine import DCFEngine, DCFInputs, ScenarioType
from app.services.finnhub_service import FinnhubService
from app.services.dcf_data_service import DCFDataService
from app.config import settings

router = APIRouter()
dcf_engine = DCFEngine()


def fetch_company_data(ticker: str) -> Dict:
    """Fetch company data using yfinance only (legacy helper)."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        financials = stock.financials
        balance_sheet = stock.balance_sheet

        # Extract key metrics
        market_cap = info.get("marketCap", 0)
        # Try multiple price fields from yfinance
        current_price = (
            info.get("currentPrice") or
            info.get("regularMarketPrice") or
            info.get("previousClose") or
            info.get("regularMarketPreviousClose") or
            info.get("ask") or
            info.get("bid") or
            0
        )
        if current_price and current_price > 0:
            current_price = float(current_price)
        else:
            current_price = 0
        shares_outstanding = info.get("sharesOutstanding", 0)
        beta = info.get("beta", 1.0) or 1.0

        # Financial data
        if not financials.empty and "Total Revenue" in financials.index:
            revenue = financials.loc["Total Revenue"].iloc[0] if len(financials.columns) > 0 else 0
        else:
            revenue = 0

        if not balance_sheet.empty:
            debt = (
                balance_sheet.loc["Total Debt"].iloc[0]
                if "Total Debt" in balance_sheet.index
                else 0
            )
            cash = (
                balance_sheet.loc["Cash And Cash Equivalents"].iloc[0]
                if "Cash And Cash Equivalents" in balance_sheet.index
                else 0
            )
        else:
            debt = 0
            cash = 0

        return {
            "info": info,
            "market_cap": market_cap,
            "current_price": current_price,
            "shares_outstanding": shares_outstanding,
            "beta": beta,
            "revenue": revenue,
            "debt": debt,
            "cash": cash,
            "cost_of_debt": 0.04,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching data for {ticker}: {str(e)}")


def _normalize_company_data(data: Dict) -> Dict:
    """
    Sanity-check and adjust core metrics to avoid extreme DCF outputs.

    In particular, ensure that shares_outstanding is consistent with
    market_cap and current_price. If the reported share count is clearly
    inconsistent (e.g. off by more than 50%), recompute it as
    market_cap / current_price.
    """
    try:
        price = float(data.get("current_price") or 0.0)
        market_cap = float(data.get("market_cap") or 0.0)
        shares = float(data.get("shares_outstanding") or 0.0)
    except (TypeError, ValueError):
        return data

    if price > 0 and market_cap > 0:
        implied_shares = market_cap / price
        if implied_shares > 0:
            # If existing shares are missing or far off, override
            if shares <= 0 or abs(shares - implied_shares) / implied_shares > 0.5:
                data["shares_outstanding"] = implied_shares

    return data


async def derive_terminal_growth_from_analysts(ticker: str, base_tgr: float) -> float:
    """
    Derive a terminal growth rate anchored on a base value but adjusted
    by the latest analyst recommendation trend from Finnhub.

    We compute a sentiment score from strongBuy/buy/hold/sell/strongSell:

    score = (2*strongBuy + 1*buy - 1*sell - 2*strongSell) / total_votes

    and map this to a modest adjustment around the base terminal growth,
    capped by MIN_TERMINAL_GROWTH and MAX_TERMINAL_GROWTH.
    """
    finnhub = FinnhubService()
    try:
        rec = await finnhub.get_recommendation_trend(ticker)
    except Exception:
        rec = None

    if not rec or not rec.get("total"):
        return base_tgr

    total = float(rec["total"])
    strong_buy = float(rec.get("strongBuy", 0) or 0)
    buy = float(rec.get("buy", 0) or 0)
    sell = float(rec.get("sell", 0) or 0)
    strong_sell = float(rec.get("strongSell", 0) or 0)

    raw_score = (2.0 * strong_buy + buy - sell - 2.0 * strong_sell) / total  # in [-2, 2] approx
    # Map score in [-2,2] to an adjustment of roughly [-0.5%, +0.5%] around base
    max_adjustment = 0.005
    adj = (raw_score / 2.0) * max_adjustment

    tgr = base_tgr + adj
    # Clamp to configured bounds
    tgr = max(settings.MIN_TERMINAL_GROWTH, min(settings.MAX_TERMINAL_GROWTH, tgr))
    return tgr


async def resolve_company_data(ticker: str) -> Dict:
    """
    Multi-source company data resolver for DCF:
    1. Try Finnhub (profile + quote) to validate ticker and get price/shares.
    2. Try yfinance for detailed financials (revenue, debt, cash, market cap, beta).
    3. If yfinance fails, fall back to OpenAI via DCFDataService.
    """
    ticker = ticker.upper()

    # 1) Try Finnhub for validation + quote (non-fatal if it fails)
    finnhub_service = FinnhubService()
    finnhub_profile = None
    finnhub_quote = None

    try:
        finnhub_profile = await finnhub_service.get_company_profile(ticker)
        finnhub_quote = await finnhub_service.get_company_quote(ticker)
    except ValueError:
        finnhub_profile = None
    except Exception:
        finnhub_profile = None

    # 2) Try yfinance (existing logic)
    yf_data: Dict | None = None
    try:
        yf_data = fetch_company_data(ticker)
    except HTTPException:
        yf_data = None

    if yf_data:
        # Merge Finnhub info if available (price / shares)
        data = yf_data.copy()

        # Always prefer Finnhub quote for current price if available (more reliable)
        if finnhub_quote and finnhub_quote.get("current") and finnhub_quote["current"] > 0:
            data["current_price"] = finnhub_quote["current"]
        # If yfinance price is missing/zero, try Finnhub previousClose as fallback
        elif (not data.get("current_price") or data["current_price"] <= 0) and finnhub_quote:
            if finnhub_quote.get("previousClose") and finnhub_quote["previousClose"] > 0:
                data["current_price"] = finnhub_quote["previousClose"]

        # Prefer Finnhub shares outstanding if present (Finnhub returns shareOutstanding, typically in millions)
        if finnhub_profile and finnhub_profile.get("shareOutstanding") is not None:
            try:
                finnhub_shares = float(finnhub_profile["shareOutstanding"])
                if finnhub_shares > 0:
                    # Convert from millions of shares to absolute count
                    data["shares_outstanding"] = finnhub_shares * 1_000_000.0
            except (TypeError, ValueError):
                pass

        return _normalize_company_data(data)

    # 3) Fallback to ChatGPT API (DCFDataService) if yfinance failed
    try:
        dcf_service = DCFDataService()
        raw_metrics = await dcf_service.fetch_dcf_metrics(ticker)
        validated = await dcf_service.validate_dcf_metrics(ticker, raw_metrics)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to resolve company data for {ticker} from all sources "
                f"(Finnhub, yfinance, OpenAI): {str(e)}"
            ),
        )

    # Map validated metrics into the structure expected by the DCF engine
    # Try to get current_price from validated data, or fallback to Finnhub quote if available
    current_price = float(validated.get("current_price", 0.0) or 0.0)
    if (current_price <= 0) and finnhub_quote:
        if finnhub_quote.get("current") and finnhub_quote["current"] > 0:
            current_price = finnhub_quote["current"]
        elif finnhub_quote.get("previousClose") and finnhub_quote["previousClose"] > 0:
            current_price = finnhub_quote["previousClose"]
    
    data = {
        "info": {"ticker": validated.get("ticker", ticker)},
        "market_cap": float(validated.get("market_cap", 0.0) or 0.0),
        "current_price": current_price,
        "shares_outstanding": float(validated.get("shares_outstanding", 0.0) or 0.0),
        "beta": float(validated.get("beta", 1.0) or 1.0),
        "revenue": float(validated.get("revenue", 0.0) or 0.0),
        "debt": float(validated.get("debt", 0.0) or 0.0),
        "cash": float(validated.get("cash", 0.0) or 0.0),
        "cost_of_debt": float(validated.get("cost_of_debt", 0.04) or 0.04),
    }

    return _normalize_company_data(data)


@router.post("/calculate", response_model=DCFResult)
async def calculate_dcf(params: DCFParameters):
    """
    Calculate DCF valuation for a ticker

    Returns complete DCF analysis including projections and terminal value
    """
    try:
        # Fetch company data via multi-source resolver:
        # 1) Finnhub (profile + quote)
        # 2) yfinance (financial statements)
        # 3) OpenAI fallback (official statements via ChatGPT)
        company_data = await resolve_company_data(params.ticker)

        # Determine starting revenue:
        # 1) Prefer explicit override from request if provided
        # 2) Otherwise, use data source revenue if available
        # 3) Otherwise, raise error
        revenue_start = None
        if params.revenue_override is not None and params.revenue_override > 0:
            revenue_start = params.revenue_override
        elif company_data.get("revenue") and company_data["revenue"] > 0:
            revenue_start = company_data["revenue"]
        
        if revenue_start is None or revenue_start <= 0:
            raise HTTPException(
                status_code=400,
                detail="Unable to determine starting revenue from data sources. "
                "Please enter a revenue value in the 'Current Revenue ($B)' field.",
            )

        # Interpret UI "FCF Margin (%)" as a true FCF margin:
        # FCF ≈ EBIT * (1 - tax), with D&A/CapEx/NWC set to neutral (0 ratios)
        fcf_margin = params.ebit_margin_start or 0.20
        eff_tax = params.tax_rate_start or settings.DEFAULT_TAX_RATE
        # Avoid division by zero if tax ~100%
        ebit_margin_start = fcf_margin / max(1e-6, (1.0 - eff_tax))

        # Derive terminal growth from analyst recommendations (overrides any raw input)
        base_tgr = params.terminal_growth if params.terminal_growth is not None else settings.DEFAULT_TERMINAL_GROWTH
        terminal_growth = await derive_terminal_growth_from_analysts(params.ticker, base_tgr)

        inputs = DCFInputs(
            revenue_start=revenue_start,
            revenue_growth_start=params.revenue_growth_start or 0.08,
            ebit_margin_start=ebit_margin_start,
            # Neutralize D&A, CapEx, and NWC ratios so FCF ≈ NOPAT
            dna_ratio_start=0.0,
            capex_ratio_start=0.0,
            nwc_ratio_start=0.0,
            tax_rate_start=eff_tax,
            nwc_level=0.0,
            revenue_growth_terminal=params.revenue_growth_terminal or 0.03,
            # Keep terminal EBIT margin equal to starting EBIT margin by default
            ebit_margin_terminal=ebit_margin_start,
            dna_ratio_terminal=0.0,
            capex_ratio_terminal=0.0,
            nwc_ratio_terminal=0.0,
            tax_rate_terminal=eff_tax,
            risk_free_rate=params.risk_free_rate or settings.DEFAULT_RISK_FREE_RATE,
            erp=params.erp or settings.DEFAULT_ERP,
            beta=company_data['beta'],
            cost_of_debt=params.cost_of_debt or company_data['cost_of_debt'],
            debt=company_data['debt'],
            equity=company_data['market_cap'],
            tax_rate=eff_tax,
            forecast_period=params.forecast_period,
            terminal_growth=terminal_growth,
            manual_wacc=params.discount_rate,
            shares_outstanding=company_data['shares_outstanding'],
            cash=company_data['cash']
        )

        # Validate that we have a current price (required for upside/downside calculation)
        current_price = company_data.get('current_price', 0.0) or 0.0
        if current_price <= 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unable to fetch current stock price for {params.ticker} from data sources. "
                    "Please ensure the ticker symbol is correct and the market is open, or try again later."
                ),
            )

        # Perform DCF
        result = dcf_engine.perform_dcf(inputs, current_price)

        # Build projections response
        projections = []
        for idx, row in result.projections.iterrows():
            proj = ProjectionYear(
                year=int(idx),
                revenue=float(row['revenue'] / 1e9),
                revenue_growth_pct=float(row['rev_growth'] * 100),
                ebit=float(row['ebit'] / 1e9),
                ebit_margin_pct=float(row['ebit_margin'] * 100),
                fcf=float(row['fcf'] / 1e9),
                pv_fcf=float(row['pv_fcf'] / 1e9),
                tax_rate_pct=float(row['tax_rate'] * 100),
                nopat=float(row['nopat'] / 1e9),
                reinvestment=float((row['capex'] + row['delta_nwc']) / 1e9)
            )
            projections.append(proj)

        return DCFResult(
            ticker=params.ticker,
            company_name=company_data['info'].get('longName'),
            sector=company_data['info'].get('sector'),
            industry=company_data['info'].get('industry'),
            country=company_data['info'].get('country'),
            current_price=result.current_price,
            implied_price=result.implied_price,
            upside_downside=result.upside_downside,
            enterprise_value=result.enterprise_value / 1e9,
            equity_value=result.equity_value / 1e9,
            terminal_value=result.terminal_value / 1e9,
            pv_terminal=result.pv_terminal / 1e9,
            wacc=result.wacc * 100,
            cost_of_equity=result.cost_of_equity * 100,
            cost_of_debt=inputs.cost_of_debt * 100,
            risk_free_rate=inputs.risk_free_rate * 100,
            erp=inputs.erp * 100,
            beta=result.levered_beta,
            unlevered_beta=result.unlevered_beta,
            market_cap=company_data['market_cap'] / 1e9,
            debt=company_data['debt'] / 1e9,
            cash=company_data['cash'] / 1e9,
            shares_outstanding=company_data['shares_outstanding'],
            projections=projections
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scenarios", response_model=MultiScenarioResponse)
async def multi_scenario_analysis(params: DCFParameters):
    """
    Perform multi-scenario DCF analysis (Base, Bull, Bear)

    Returns valuations under different growth and margin assumptions
    """
    try:
        company_data = await resolve_company_data(params.ticker)

        # Determine starting revenue with same logic as /calculate
        revenue_start = None
        if params.revenue_override is not None and params.revenue_override > 0:
            revenue_start = params.revenue_override
        elif company_data.get("revenue") and company_data["revenue"] > 0:
            revenue_start = company_data["revenue"]
        
        if revenue_start is None or revenue_start <= 0:
            raise HTTPException(
                status_code=400,
                detail="Unable to determine starting revenue from data sources. "
                "Please enter a revenue value in the 'Current Revenue ($B)' field.",
            )

        # Interpret UI "FCF Margin (%)" as a true FCF margin as in /calculate
        fcf_margin = params.ebit_margin_start or 0.20
        eff_tax = params.tax_rate_start or settings.DEFAULT_TAX_RATE
        ebit_margin_start = fcf_margin / max(1e-6, (1.0 - eff_tax))

        # Derive terminal growth from analyst recommendations (same logic as /calculate)
        base_tgr = params.terminal_growth if params.terminal_growth is not None else settings.DEFAULT_TERMINAL_GROWTH
        terminal_growth = await derive_terminal_growth_from_analysts(params.ticker, base_tgr)

        # Derive terminal growth from analyst recommendations (same logic as /calculate)
        base_tgr = params.terminal_growth if params.terminal_growth is not None else settings.DEFAULT_TERMINAL_GROWTH
        terminal_growth = await derive_terminal_growth_from_analysts(params.ticker, base_tgr)

        inputs = DCFInputs(
            revenue_start=revenue_start,
            revenue_growth_start=params.revenue_growth_start or 0.08,
            ebit_margin_start=ebit_margin_start,
            dna_ratio_start=0.0,
            capex_ratio_start=0.0,
            nwc_ratio_start=0.0,
            tax_rate_start=eff_tax,
            nwc_level=0.0,
            revenue_growth_terminal=params.revenue_growth_terminal or 0.03,
            ebit_margin_terminal=ebit_margin_start,
            dna_ratio_terminal=0.0,
            capex_ratio_terminal=0.0,
            nwc_ratio_terminal=0.0,
            tax_rate_terminal=eff_tax,
            risk_free_rate=params.risk_free_rate or settings.DEFAULT_RISK_FREE_RATE,
            erp=params.erp or settings.DEFAULT_ERP,
            beta=company_data['beta'],
            cost_of_debt=params.cost_of_debt or company_data['cost_of_debt'],
            debt=company_data['debt'],
            equity=company_data['market_cap'],
            tax_rate=eff_tax,
            forecast_period=params.forecast_period,
            terminal_growth=terminal_growth,
            shares_outstanding=company_data['shares_outstanding'],
            cash=company_data['cash']
        )

        scenarios_result = dcf_engine.multi_scenario_analysis(inputs, company_data['current_price'])

        scenario_responses = []
        for scenario_type, result in scenarios_result.items():
            scenario_responses.append(ScenarioResult(
                scenario_type=scenario_type.value,
                implied_price=result.implied_price,
                upside_downside=result.upside_downside,
                assumptions={
                    "wacc": result.wacc * 100,
                    "terminal_growth": inputs.terminal_growth * 100
                }
            ))

        return MultiScenarioResponse(
            ticker=params.ticker,
            current_price=company_data['current_price'],
            scenarios=scenario_responses
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sensitivity", response_model=SensitivityResponse)
async def sensitivity_analysis(
    params: DCFParameters,
    wacc_low: float = 0.06,
    wacc_high: float = 0.18,
    tgr_low: float = 0.01,
    tgr_high: float = 0.04,
    grid_size: int = 25
):
    """
    Perform 2D sensitivity analysis on WACC and Terminal Growth Rate

    Returns a grid of implied prices for different combinations
    """
    try:
        company_data = await resolve_company_data(params.ticker)

        # Determine starting revenue with same logic as /calculate
        revenue_start = None
        if params.revenue_override is not None and params.revenue_override > 0:
            revenue_start = params.revenue_override
        elif company_data.get("revenue") and company_data["revenue"] > 0:
            revenue_start = company_data["revenue"]
        
        if revenue_start is None or revenue_start <= 0:
            raise HTTPException(
                status_code=400,
                detail="Unable to determine starting revenue from data sources. "
                "Please enter a revenue value in the 'Current Revenue ($B)' field.",
            )

        # Interpret UI "FCF Margin (%)" as a true FCF margin as in /calculate
        fcf_margin = params.ebit_margin_start or 0.20
        eff_tax = params.tax_rate_start or settings.DEFAULT_TAX_RATE
        ebit_margin_start = fcf_margin / max(1e-6, (1.0 - eff_tax))

        inputs = DCFInputs(
            revenue_start=revenue_start,
            revenue_growth_start=params.revenue_growth_start or 0.08,
            ebit_margin_start=ebit_margin_start,
            dna_ratio_start=0.0,
            capex_ratio_start=0.0,
            nwc_ratio_start=0.0,
            tax_rate_start=eff_tax,
            nwc_level=0.0,
            revenue_growth_terminal=params.revenue_growth_terminal or 0.03,
            ebit_margin_terminal=ebit_margin_start,
            dna_ratio_terminal=0.0,
            capex_ratio_terminal=0.0,
            nwc_ratio_terminal=0.0,
            tax_rate_terminal=eff_tax,
            risk_free_rate=params.risk_free_rate or settings.DEFAULT_RISK_FREE_RATE,
            erp=params.erp or settings.DEFAULT_ERP,
            beta=company_data['beta'],
            cost_of_debt=params.cost_of_debt or company_data['cost_of_debt'],
            debt=company_data['debt'],
            equity=company_data['market_cap'],
            tax_rate=eff_tax,
            forecast_period=params.forecast_period,
            terminal_growth=terminal_growth,
            shares_outstanding=company_data['shares_outstanding'],
            cash=company_data['cash']
        )

        sensitivity = dcf_engine.sensitivity_analysis(
            inputs,
            wacc_range=(wacc_low, wacc_high),
            tgr_range=(tgr_low, tgr_high),
            grid_size=grid_size
        )

        return SensitivityResponse(
            waccs=sensitivity['waccs'],
            tgrs=sensitivity['tgrs'],
            price_surface=sensitivity['price_surface'],
            base_wacc=sensitivity['base_wacc'],
            base_tgr=sensitivity['base_tgr'],
            base_price=sensitivity['base_price'],
            current_price=company_data['current_price']
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

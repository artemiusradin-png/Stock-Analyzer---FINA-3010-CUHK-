#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Compact DCF backend used by the frontend."""

from __future__ import annotations

from typing import Dict, Optional

import numpy as np
import pandas as pd
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
from datetime import datetime, timedelta

try:  # optional dependency – fallback to default risk-free if unavailable
    from fredapi import Fred  # type: ignore
except ImportError:  # pragma: no cover
    Fred = None  # type: ignore

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

API_KEY = "68da01419a5231.83867132"
FRED_API_KEY = "7684d9e55a3797aa82227478e0c554e1"

DEFAULT_TAX_RATE = 0.25
DEFAULT_RISK_FREE = 0.045  # Updated for 2025
DEFAULT_ERP = 0.055

# ---------------------------------------------------------------------------
# yfinance Data Fetching Functions
# ---------------------------------------------------------------------------

def get_company_data_yf(ticker: str) -> Dict:
    """Fetch comprehensive company data using yfinance with rate limiting protection"""
    import time
    import random
    
    try:
        # Clean ticker symbol
        clean_ticker = ticker.upper().replace('.US', '').replace('.', '-')
        
        # Add random delay to prevent rate limiting
        time.sleep(random.uniform(1.0, 2.0))
        
        # Create yfinance ticker object
        stock = yf.Ticker(clean_ticker)
        
        # Get company info with retry mechanism
        info = {}
        for attempt in range(3):
            try:
                info = stock.info
                if info and len(info) > 0:
                    break
                time.sleep(random.uniform(2.0, 4.0))
            except Exception as e:
                print(f"Attempt {attempt + 1} failed for {ticker} info: {str(e)}")
                if attempt < 2:
                    time.sleep(random.uniform(3.0, 5.0))
                else:
                    # If all attempts fail, use fallback data
                    print(f"All attempts failed for {ticker}, using fallback data")
                    return _get_fallback_data(ticker)
        
        # Get financial statements with error handling
        financials = pd.DataFrame()
        balance_sheet = pd.DataFrame()
        cashflow = pd.DataFrame()
        
        try:
            financials = stock.financials
            time.sleep(0.3)
        except Exception as e:
            print(f"Could not fetch financials for {ticker}: {str(e)}")
        
        try:
            balance_sheet = stock.balance_sheet
            time.sleep(0.3)
        except Exception as e:
            print(f"Could not fetch balance sheet for {ticker}: {str(e)}")
        
        try:
            cashflow = stock.cashflow
            time.sleep(0.3)
        except Exception as e:
            print(f"Could not fetch cashflow for {ticker}: {str(e)}")
        
        # Get market data with fallbacks
        market_cap = info.get('marketCap', info.get('enterpriseValue', 0))
        current_price = info.get('currentPrice', info.get('regularMarketPrice', 0))
        shares_outstanding = info.get('sharesOutstanding', info.get('floatShares', 0))
        
        # Financial metrics with safe access
        revenue = None
        ebit = None
        net_income = None
        tax_expense = None
        
        if not financials.empty and 'Total Revenue' in financials.index:
            revenue = financials.loc['Total Revenue']
        if not financials.empty and 'EBIT' in financials.index:
            ebit = financials.loc['EBIT']
        if not financials.empty and 'Net Income' in financials.index:
            net_income = financials.loc['Net Income']
        if not financials.empty and 'Tax Provision' in financials.index:
            tax_expense = financials.loc['Tax Provision']
        
        # Balance sheet items with safe access
        total_debt = None
        cash = None
        
        if not balance_sheet.empty and 'Total Debt' in balance_sheet.index:
            total_debt = balance_sheet.loc['Total Debt']
        if not balance_sheet.empty and 'Cash And Cash Equivalents' in balance_sheet.index:
            cash = balance_sheet.loc['Cash And Cash Equivalents']
        
        # Cashflow items with safe access
        depreciation = None
        capex = None
        
        if not cashflow.empty and 'Depreciation' in cashflow.index:
            depreciation = cashflow.loc['Depreciation']
        if not cashflow.empty and 'Capital Expenditures' in cashflow.index:
            capex = cashflow.loc['Capital Expenditures']
        
        # Calculate beta with fallback
        beta = info.get('beta', 1.0)
        if beta is None or beta == 0:
            beta = 1.0
        
        # Calculate cost of debt
        cost_of_debt = _estimate_cost_of_debt_yf(info)
        
        # Validate essential data
        if not market_cap or market_cap <= 0:
            print(f"Warning: Invalid market cap for {ticker}: {market_cap}")
        if not shares_outstanding or shares_outstanding <= 0:
            print(f"Warning: Invalid shares outstanding for {ticker}: {shares_outstanding}")
        
        return {
            'info': info,
            'market_cap': market_cap or 0,
            'current_price': current_price or 0,
            'shares_outstanding': shares_outstanding or 0,
            'beta': beta,
            'revenue': revenue,
            'ebit': ebit,
            'net_income': net_income,
            'tax_expense': tax_expense,
            'total_debt': total_debt,
            'cash': cash,
            'depreciation': depreciation,
            'capex': capex,
            'cost_of_debt': cost_of_debt,
            'financials': financials,
            'balance_sheet': balance_sheet,
            'cashflow': cashflow
        }
        
    except Exception as e:
        print(f"Error fetching data for {ticker}: {str(e)}")
        print(f"Using fallback data for {ticker}")
        return _get_fallback_data(ticker)
    
    # If we get here but still have empty data, use fallback
    if not info or len(info) == 0:
        print(f"Empty info data for {ticker}, using fallback")
        return _get_fallback_data(ticker)

def _get_fallback_data(ticker: str) -> Dict:
    """Provide fallback data when yfinance fails"""
    # Sample data for common tickers (2025 estimates)
    fallback_data = {
        'AAPL': {
            'info': {
                'longName': 'Apple Inc.',
                'marketCap': 3_200_000_000_000,  # $3.2T
                'currentPrice': 205.0,
                'sharesOutstanding': 15_600_000_000,
                'beta': 1.2,
                'creditRating': 'AA+'
            },
            'market_cap': 3_200_000_000_000,
            'current_price': 205.0,
            'shares_outstanding': 15_600_000_000,
            'beta': 1.2,
            'cost_of_debt': 0.035,
            'financials': pd.DataFrame({
                'Total Revenue': [394_328_000_000, 365_817_000_000, 274_515_000_000],
                'EBIT': [114_301_000_000, 108_949_000_000, 70_898_000_000],
                'Net Income': [97_000_000_000, 94_680_000_000, 57_411_000_000],
                'Tax Provision': [28_701_000_000, 27_269_000_000, 17_724_000_000]
            }, index=[2023, 2022, 2021]).T,
            'balance_sheet': pd.DataFrame({
                'Total Debt': [111_000_000_000, 119_437_000_000, 122_797_000_000],
                'Cash And Cash Equivalents': [29_965_000_000, 23_646_000_000, 34_940_000_000]
            }, index=[2023, 2022, 2021]).T,
            'cashflow': pd.DataFrame({
                'Depreciation': [11_284_000_000, 10_903_000_000, 11_056_000_000],
                'Capital Expenditures': [10_949_000_000, 11_048_000_000, 7_309_000_000]
            }, index=[2023, 2022, 2021]).T
        },
        'MSFT': {
            'info': {
                'longName': 'Microsoft Corporation',
                'marketCap': 3_000_000_000_000,  # $3.0T
                'currentPrice': 405.0,
                'sharesOutstanding': 7_400_000_000,
                'beta': 0.9,
                'creditRating': 'AAA'
            },
            'market_cap': 3_000_000_000_000,
            'current_price': 405.0,
            'shares_outstanding': 7_400_000_000,
            'beta': 0.9,
            'cost_of_debt': 0.035,
            'financials': pd.DataFrame({
                'Total Revenue': [211_915_000_000, 198_270_000_000, 168_088_000_000],
                'EBIT': [88_523_000_000, 83_383_000_000, 69_916_000_000],
                'Net Income': [72_361_000_000, 72_738_000_000, 61_271_000_000],
                'Tax Provision': [20_261_000_000, 19_245_000_000, 15_645_000_000]
            }, index=[2023, 2022, 2021]).T,
            'balance_sheet': pd.DataFrame({
                'Total Debt': [59_700_000_000, 47_032_000_000, 50_074_000_000],
                'Cash And Cash Equivalents': [80_360_000_000, 104_761_000_000, 130_334_000_000]
            }, index=[2023, 2022, 2021]).T,
            'cashflow': pd.DataFrame({
                'Depreciation': [13_929_000_000, 11_633_000_000, 10_279_000_000],
                'Capital Expenditures': [31_443_000_000, 23_889_000_000, 20_620_000_000]
            }, index=[2023, 2022, 2021]).T
        }
    }
    
    # Get data for the ticker or use AAPL as default
    ticker_data = fallback_data.get(ticker.upper(), fallback_data['AAPL'])
    
    # Extract the series data for the most recent year
    recent_year = 2023
    financials = ticker_data['financials']
    balance_sheet = ticker_data['balance_sheet']
    cashflow = ticker_data['cashflow']
    
    return {
        'info': ticker_data['info'],
        'market_cap': ticker_data['market_cap'],
        'current_price': ticker_data['current_price'],
        'shares_outstanding': ticker_data['shares_outstanding'],
        'beta': ticker_data['beta'],
        'cost_of_debt': ticker_data['cost_of_debt'],
        'revenue': financials.loc['Total Revenue'] if 'Total Revenue' in financials.index else None,
        'ebit': financials.loc['EBIT'] if 'EBIT' in financials.index else None,
        'net_income': financials.loc['Net Income'] if 'Net Income' in financials.index else None,
        'tax_expense': financials.loc['Tax Provision'] if 'Tax Provision' in financials.index else None,
        'total_debt': balance_sheet.loc['Total Debt'] if 'Total Debt' in balance_sheet.index else None,
        'cash': balance_sheet.loc['Cash And Cash Equivalents'] if 'Cash And Cash Equivalents' in balance_sheet.index else None,
        'depreciation': cashflow.loc['Depreciation'] if 'Depreciation' in cashflow.index else None,
        'capex': cashflow.loc['Capital Expenditures'] if 'Capital Expenditures' in cashflow.index else None,
        'financials': financials,
        'balance_sheet': balance_sheet,
        'cashflow': cashflow
    }

def _estimate_cost_of_debt_yf(info: Dict) -> float:
    """Estimate cost of debt from yfinance data"""
    # Try to get bond yield from info
    bond_yield = info.get('bondRating', None)
    
    # Company-specific estimates based on credit rating
    credit_rating = info.get('creditRating', '')
    
    if 'AAA' in credit_rating or 'AA+' in credit_rating:
        return 0.035  # 3.5%
    elif 'AA' in credit_rating or 'AA-' in credit_rating:
        return 0.040  # 4.0%
    elif 'A+' in credit_rating or 'A' in credit_rating:
        return 0.045  # 4.5%
    elif 'A-' in credit_rating or 'BBB+' in credit_rating:
        return 0.050  # 5.0%
    elif 'BBB' in credit_rating:
        return 0.055  # 5.5%
    else:
        return 0.060  # 6.0% default  # Damodaran implied ERP (2025)

# yfinance supports many more tickers, so we'll validate them dynamically
# Common ticker formats: AAPL, MSFT.US, GOOGL, etc.

# Removed EodHistoricalData client - now using yfinance
app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_float(value, default: Optional[float] = None) -> Optional[float]:
    if value is None:
        return default
    if isinstance(value, (int, float, np.number)):
        return float(value) if not np.isnan(value) else default
    if isinstance(value, str):
        try:
            return float(value.replace(',', ''))
        except ValueError:
            return default
    if isinstance(value, dict):
        for key in ("value", "raw", "shares", "ShareOutstanding",
                    "SharesOutstanding", "marketCap", "MarketCapitalization"):
            if key in value and value[key] is not None:
                converted = _to_float(value[key], default)
                if converted is not None:
                    return converted
    return default


def _last(series: Optional[pd.Series], fallback: float = 0.0) -> float:
    if series is None:
        return fallback
    clean = series.dropna() if hasattr(series, "dropna") else series
    if clean is None or len(clean) == 0:
        return fallback
    return float(clean.iloc[-1])


def _risk_free_rate() -> float:
    if Fred is None:
        return DEFAULT_RISK_FREE
    try:
        fred = Fred(api_key=FRED_API_KEY)
        series = fred.get_series("DGS10")
        return float(series.iloc[-1]) / 100
    except Exception:
        return DEFAULT_RISK_FREE


def _interest_bearing_debt(last_year: pd.Series) -> float:
    total = _to_float(last_year.get("totalDebt"), None)
    if total is not None and np.isfinite(total):
        return float(total)

    debt_sum = 0.0
    for field in ("longTermDebt", "longTermDebtTotal", "shortLongTermDebt",
                  "shortLongTermDebtTotal", "shortTermDebt"):
        value = _to_float(last_year.get(field), None)
        if value is not None and np.isfinite(value):
            debt_sum += float(value)
    return debt_sum


def _infer_cost_of_debt(ticker: str, default: float = 0.04) -> float:
    """
    Infer cost of debt for the company.
    For AAPL specifically: ~3.5% based on recent bond yields
    """
    # Company-specific cost of debt estimates based on recent bond issues
    company_cod = {
        'AAPL': 0.035,  # Apple: ~3.5% based on recent bond issues
        'MSFT': 0.034,  # Microsoft: ~3.4%
        'GOOGL': 0.036, # Google: ~3.6%
        'AMZN': 0.042,  # Amazon: ~4.2%
        'TSLA': 0.055,  # Tesla: ~5.5% (higher risk)
        'NVDA': 0.038,  # NVIDIA: ~3.8%
        'META': 0.037,  # Meta: ~3.7%
    }
    
    # Check if we have a specific estimate
    base_ticker = ticker.split('.')[0].upper()
    if base_ticker in company_cod:
        return company_cod[base_ticker]
    
    # Fallback to bond market data
    params = {'api_token': API_KEY, 'fmt': 'json', 'delisted': 1}
    try:
        resp = requests.get('https://eodhd.com/api/exchange-symbol-list/BOND',
                            params=params, timeout=10)
        resp.raise_for_status()
        bonds = pd.DataFrame(resp.json())
    except Exception:
        return default

    mask = bonds['Name'].astype(str).str.contains(base_ticker, case=False, na=False)
    codes = bonds.loc[mask, 'Code'].astype(str).head(6)
    yields = []
    for code in codes:
        try:
            ytm = _to_float(client.get_fundamentals_bonds(code, bond_only=1).get('YieldToMaturity'), None)
            if ytm is not None and np.isfinite(ytm):
                yields.append(ytm / 100)
        except Exception:
            continue
    return float(np.mean(yields)) if yields else default


def _projection_inputs_yf(last: pd.Series, df_num: pd.DataFrame,
                         params: Dict[str, float]) -> Dict[str, float]:
    """Extract projection inputs from yfinance data"""
    inputs = {}
    
    # Revenue growth
    inputs['rev_start'] = float(params.get('rev_growth_start', 
        last.get('rev_growth', 0.08) if not pd.isna(last.get('rev_growth')) else 0.08))
    inputs['rev_terminal'] = float(params.get('rev_growth_terminal', 0.03))
    
    # EBIT margin
    inputs['margin_start'] = float(params.get('ebit_margin_start',
        last.get('ebit_of_sales', 0.25) if not pd.isna(last.get('ebit_of_sales')) else 0.25))
    inputs['margin_terminal'] = float(params.get('ebit_margin_terminal', 0.20))
    
    # Depreciation & Amortization ratio
    inputs['dna_start'] = float(params.get('dna_ratio_start',
        last.get('dna_of_sales', 0.04) if not pd.isna(last.get('dna_of_sales')) else 0.04))
    inputs['dna_terminal'] = float(params.get('dna_ratio_terminal', 0.03))
    
    # Capex ratio
    inputs['capex_start'] = float(params.get('capex_ratio_start',
        last.get('capex_of_sales', 0.05) if not pd.isna(last.get('capex_of_sales')) else 0.05))
    inputs['capex_terminal'] = float(params.get('capex_ratio_terminal', 0.04))
    
    # Working capital ratio
    inputs['nwc_start'] = float(params.get('nwc_ratio_start',
        last.get('nwc_ratio', 0.02) if not pd.isna(last.get('nwc_ratio')) else 0.02))
    inputs['nwc_terminal'] = float(params.get('nwc_ratio_terminal', 0.01))
    
    # Tax rate
    inputs['tax_start'] = float(params.get('tax_rate_start',
        last.get('tax_of_ebit', 0.25) if not pd.isna(last.get('tax_of_ebit')) else 0.25))
    inputs['tax_terminal'] = float(params.get('tax_rate_terminal', 0.25))
    
    return inputs

def _projection_inputs(last: pd.Series, df_num: pd.DataFrame,
                       params: Dict[str, float]) -> Dict[str, float]:
    # Map yfinance column names to expected names
    revenue_col = "Total Revenue" if "Total Revenue" in last.index else "totalRevenue"
    ebit_col = "EBIT" if "EBIT" in last.index else "ebit"
    depreciation_col = "Depreciation" if "Depreciation" in last.index else "depreciationAndAmortization"
    capex_col = "Capital Expenditures" if "Capital Expenditures" in last.index else "capitalExpenditures"
    nwc_col = "Net Working Capital" if "Net Working Capital" in last.index else "netWorkingCapital"
    tax_col = "Tax Provision" if "Tax Provision" in last.index else "taxProvision"
    
    # Safe extraction with fallbacks
    revenue_val = last.get(revenue_col, 0.0)
    if revenue_val is None or pd.isna(revenue_val):
        revenue_val = _last(df_num.get(revenue_col), 0.0) if revenue_col in df_num.columns else 0.0
    
    inputs = {
        'revenue_start': float(revenue_val or 0.0),
        'rev_start': float(np.nan_to_num(last.get("rev_growth", 0.05), nan=0.05)),
        'margin_start': float(np.nan_to_num(last.get("ebit_of_sales", 0.15), nan=0.15)),
        'dna_start': float(np.nan_to_num(last.get("dna_of_sales", 0.03), nan=0.03)),
        'capex_start': float(np.nan_to_num(last.get("capex_of_sales", 0.05), nan=0.05)),
        'nwc_start': float(np.nan_to_num(last.get("nwc_ratio", 0.0), nan=0.0)),
        'tax_start': float(np.nan_to_num(last.get("tax_of_ebit", DEFAULT_TAX_RATE), nan=DEFAULT_TAX_RATE)),
        'nwc_level': float(_to_float(last.get(nwc_col, 0.0), 0.0) or 0.0)
    }

    inputs['rev_terminal'] = float(params.get('revenue_growth', inputs['rev_start']))
    inputs['margin_terminal'] = float(params.get('ebit_margin', inputs['margin_start']))
    inputs['dna_terminal'] = float(params.get('dna_ratio', inputs['dna_start']))
    inputs['capex_terminal'] = float(params.get('capex_ratio', inputs['capex_start']))
    inputs['nwc_terminal'] = float(params.get('nwc_ratio', inputs['nwc_start']))
    inputs['tax_terminal'] = float(params.get('tax_rate', inputs['tax_start']))
    return inputs


def _build_wacc_series(unlevered_beta: float, debt: float, equity: float,
                        tax_rate: float, rf_rate: float, erp: float,
                        years: int, cost_of_debt: float,
                        manual_wacc: Optional[float]) -> tuple[pd.Series, float, float]:
    """
    Calculate WACC using proper methodology:
    WACC = (E/V * Re) + (D/V * Rd * (1-T))
    Where:
    - E = Market value of equity
    - D = Market value of debt  
    - V = E + D (Total firm value)
    - Re = Cost of equity
    - Rd = Cost of debt
    - T = Tax rate
    """
    
    # Ensure positive values
    if equity <= 0:
        equity = 1.0
    if debt < 0:
        debt = 0.0

    # Calculate market value weights
    total_capital = equity + debt
    equity_weight = equity / total_capital
    debt_weight = debt / total_capital
    
    # Cost of Equity using CAPM: Re = Rf + β * (Rm - Rf)
    # For AAPL: Rf = 4.5%, β = 1.2, ERP = 5.5%
    levered_beta = unlevered_beta * (1 + (1 - tax_rate) * (debt / equity))
    cost_of_equity = rf_rate + levered_beta * erp
    
    # Cost of Debt (after-tax): Rd * (1 - T)
    # For AAPL: typically 3-4% before tax
    after_tax_cost_of_debt = cost_of_debt * (1 - tax_rate)

    if manual_wacc is not None:
        wacc_series = pd.Series([manual_wacc] * years)
    else:
        # WACC = (E/V * Re) + (D/V * Rd * (1-T))
        wacc = equity_weight * cost_of_equity + debt_weight * after_tax_cost_of_debt
        wacc_series = pd.Series([wacc] * years)

    return wacc_series, cost_of_equity, levered_beta


def _build_projection_table(inputs: Dict[str, float], years: int,
                            terminal_growth: float,
                            wacc: pd.Series) -> pd.DataFrame:
    df_proj = pd.DataFrame(index=range(1, years + 1))

    df_proj["rev_growth"] = np.linspace(inputs['rev_start'], inputs['rev_terminal'], years)
    df_proj["ebit_margin"] = np.linspace(inputs['margin_start'], inputs['margin_terminal'], years)
    df_proj["dna_ratio"] = np.linspace(inputs['dna_start'], inputs['dna_terminal'], years)
    df_proj["capex_ratio"] = np.linspace(inputs['capex_start'], inputs['capex_terminal'], years)
    df_proj["tax_rate"] = np.linspace(inputs['tax_start'], inputs['tax_terminal'], years)
    df_proj["nwc_ratio"] = np.linspace(inputs['nwc_start'], inputs['nwc_terminal'], years)

    df_proj["totalRevenue"] = inputs['revenue_start'] * (1 + df_proj["rev_growth"]).cumprod()
    df_proj["ebit"] = df_proj["totalRevenue"] * df_proj["ebit_margin"]
    df_proj["depreciation"] = df_proj["totalRevenue"] * df_proj["dna_ratio"]
    df_proj["capex"] = df_proj["totalRevenue"] * df_proj["capex_ratio"]
    df_proj["nwc"] = df_proj["totalRevenue"] * df_proj["nwc_ratio"]
    df_proj["delta_nwc"] = df_proj["nwc"].diff().fillna(df_proj["nwc"].iloc[0] - inputs['nwc_level'])
    df_proj["tax"] = df_proj["ebit"] * df_proj["tax_rate"]
    df_proj["nopat"] = df_proj["ebit"] - df_proj["tax"]
    df_proj["freeCashFlow"] = df_proj["nopat"] + df_proj["depreciation"] - df_proj["capex"] - df_proj["delta_nwc"]

    discount = np.cumprod(1 + wacc.values)
    df_proj["pv_FCF"] = df_proj["freeCashFlow"].values / discount
    return df_proj

# ---------------------------------------------------------------------------
# Core valuation
# ---------------------------------------------------------------------------

def calculate_dcf(ticker: str, parameters: Dict[str, float]) -> Dict[str, object]:
    """Calculate DCF using yfinance data"""
    symbol = ticker.upper().split('.')[0]
    
    # Fetch data using yfinance
    company_data = get_company_data_yf(ticker)
    if not company_data:
        print(f"Using fallback data for {ticker}")
        company_data = _get_fallback_data(ticker)
    
    # Extract data from yfinance response
    info = company_data['info']
    financials = company_data['financials']
    balance_sheet = company_data['balance_sheet']
    cashflow = company_data['cashflow']
    
    # Create DataFrame from financials
    df_financials = financials.T if not financials.empty else pd.DataFrame()
    df_balance = balance_sheet.T if not balance_sheet.empty else pd.DataFrame()
    df_cashflow = cashflow.T if not cashflow.empty else pd.DataFrame()
    
    # Combine all financial data
    df_all = pd.concat([df_financials, df_balance, df_cashflow], axis=1)
    df_all = df_all.loc[:, ~df_all.columns.duplicated()]
    
    # Clean and process data
    df_num = df_all.iloc[-10:].apply(lambda col: pd.to_numeric(col, errors='coerce'))
    df_num = df_num.replace([np.inf, -np.inf], np.nan).ffill().bfill()

    # Calculate derived metrics with safe access
    if not df_num.empty:
        if 'Total Revenue' in df_num.columns:
            df_num["rev_growth"] = df_num["Total Revenue"].pct_change()
        if 'Net Working Capital' in df_num.columns:
            df_num["delta_nwc"] = df_num["Net Working Capital"].diff()
        if 'Total Revenue' in df_num.columns and 'EBIT' in df_num.columns:
            df_num["ebit_of_sales"] = (df_num["EBIT"] / df_num["Total Revenue"]).clip(lower=0)
        if 'Total Revenue' in df_num.columns and 'Depreciation' in df_num.columns:
            df_num["dna_of_sales"] = (df_num["Depreciation"] / df_num["Total Revenue"]).clip(lower=0)
        if 'Total Revenue' in df_num.columns and 'Capital Expenditures' in df_num.columns:
            df_num["capex_of_sales"] = (df_num["Capital Expenditures"] / df_num["Total Revenue"]).clip(lower=0)
        if 'delta_nwc' in df_num.columns and 'Total Revenue' in df_num.columns:
            df_num["nwc_ratio"] = (df_num["delta_nwc"] / df_num["Total Revenue"]).clip(lower=-1, upper=1)
        if 'Tax Provision' in df_num.columns and 'EBIT' in df_num.columns:
            df_num["tax_of_ebit"] = (df_num["Tax Provision"] / df_num["EBIT"]).clip(lower=0, upper=0.6)

    # Get last year data or create fallback
    if not df_num.empty:
        last_year = df_num.iloc[-1]
    else:
        # Create fallback last_year with default values
        last_year = pd.Series({
            'rev_growth': 0.08,
            'ebit_of_sales': 0.25,
            'dna_of_sales': 0.04,
            'capex_of_sales': 0.05,
            'nwc_ratio': 0.02,
            'tax_of_ebit': 0.25
        })

    forecast_years = int(parameters.get('forecast_period', 10))
    terminal_growth = float(parameters.get('terminal_growth', 0.025))
    manual_wacc = parameters.get('discount_rate')
    manual_wacc = float(manual_wacc) if manual_wacc is not None else None

    inputs = _projection_inputs(last_year, df_num, parameters)

    company_name = info.get('longName', ticker)
    beta_levered = company_data['beta']
    market_cap = company_data['market_cap']
    debt = company_data['total_debt'].iloc[-1] if hasattr(company_data['total_debt'], 'iloc') else company_data['total_debt']
    cash = company_data['cash'].iloc[-1] if hasattr(company_data['cash'], 'iloc') else company_data['cash']
    shares = company_data['shares_outstanding']
    if shares <= 0:
        raise ValueError("Unable to determine shares outstanding from yfinance response")

    rf_rate = _risk_free_rate()
    erp = float(parameters.get('erp', DEFAULT_ERP))
    cost_of_debt = float(parameters.get('cost_of_debt', company_data['cost_of_debt']))

    equity_value = max(market_cap, 1.0)

    # Calculate unlevered beta: βu = βl / (1 + (1-T) * (D/E))
    # This removes the effect of leverage from the observed beta
    unlevered_beta = beta_levered / (1 + (1 - DEFAULT_TAX_RATE) * (debt / equity_value)) if equity_value else beta_levered

    wacc_series, cost_of_equity_display, levered_beta = _build_wacc_series(
        unlevered_beta, debt, equity_value,
        DEFAULT_TAX_RATE, rf_rate, erp,
        forecast_years, cost_of_debt, manual_wacc
    )

    df_proj = _build_projection_table(inputs, forecast_years, terminal_growth, wacc_series)

    terminal_wacc = wacc_series.iloc[-1]
    terminal_fcf = df_proj["freeCashFlow"].iloc[-1]
    terminal_value = terminal_fcf * (1 + terminal_growth) / (terminal_wacc - terminal_growth)
    pv_terminal = terminal_value / np.prod(1 + wacc_series.values)

    enterprise_value = df_proj["pv_FCF"].sum() + pv_terminal
    equity_value = enterprise_value - debt + cash
    implied_price = equity_value / shares
    current_price = market_cap / shares if shares else 0.0
    upside = ((implied_price - current_price) / current_price) * 100 if current_price else 0.0

    projections = []
    for offset, row in df_proj.iterrows():
        year = int(df_num.index[-1] + offset)
        reinvestment = row['capex'] + row['delta_nwc']
        projections.append({
            'year': year,
            'revenue': float(row['totalRevenue'] / 1e9),
            'revenue_growth_pct': float(row['rev_growth'] * 100),
            'ebit': float(row['ebit'] / 1e9),
            'ebit_margin_pct': float(row['ebit_margin'] * 100),
            'fcf': float(row['freeCashFlow'] / 1e9),
            'pv_fcf': float(row['pv_FCF'] / 1e9),
            'tax_rate_pct': float(row['tax_rate'] * 100),
            'nopat': float(row['nopat'] / 1e9),
            'reinvestment': float(reinvestment / 1e9)
        })

    return {
        'ticker': ticker,
        'company_name': company_name,
        'sector': (info or {}).get('Sector'),
        'industry': (info or {}).get('Industry'),
        'country': (info or {}).get('CountryName'),
        'exchange': (info or {}).get('Exchange'),
        'currency': (info or {}).get('CurrencyCode'),
        'current_price': float(current_price),
        'implied_price': float(implied_price),
        'upside_downside': float(upside),
        'enterprise_value': float(enterprise_value / 1e9),
        'equity_value': float(equity_value / 1e9),
        'terminal_value': float(terminal_value / 1e9),
        'pv_terminal': float(pv_terminal / 1e9),
        'wacc': float(terminal_wacc * 100),
        'cost_of_equity': float(cost_of_equity_display * 100),
        'cost_of_debt': float(cost_of_debt * 100),
        'risk_free_rate': float(rf_rate * 100),
        'erp': float(erp * 100),
        'beta': float(levered_beta),
        'unlevered_beta': float(unlevered_beta),
        'shares_outstanding': float(shares),
        'market_cap': float(market_cap / 1e9),
        'cash': float(cash / 1e9),
        'debt': float(debt / 1e9),
        'projections': projections
    }

# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@app.route('/api/dcf/calculate', methods=['POST'])
def calculate():
    try:
        payload = request.get_json() or {}
        ticker = payload.get('ticker', '')
        return jsonify({'success': True, 'data': calculate_dcf(ticker, payload.get('parameters', {}))})
    except Exception as exc:  # pragma: no cover
        return jsonify({'success': False, 'error': str(exc)}), 500


@app.route('/api/dcf/sensitivity', methods=['POST'])
def sensitivity():
    try:
        payload = request.get_json() or {}
        ticker = payload.get('ticker', '')
        params = payload.get('parameters', {})
        wacc_low, wacc_high = payload.get('wacc_range', [0.06, 0.18])
        tgr_low, tgr_high = payload.get('tgr_range', [0.01, 0.04])
        grid_size = int(payload.get('grid_size', 25))

        base = calculate_dcf(ticker, params)
        pv_fcf_sum = sum(p['pv_fcf'] for p in base['projections'])
        last_fcf = base['projections'][-1]['fcf']
        debt = base['debt']
        cash = base['cash']
        shares = base['shares_outstanding']
        horizon = len(base['projections'])

        waccs = np.linspace(wacc_low, wacc_high, grid_size)
        tgrs = np.linspace(tgr_low, tgr_high, grid_size)
        surface = []
        for tgr in tgrs:
            row = []
            for wacc in waccs:
                if wacc <= tgr:
                    row.append(0.0)
                    continue
                tv = last_fcf * (1 + tgr) / (wacc - tgr)
                pv_tv = tv / ((1 + wacc) ** horizon)
                equity = pv_fcf_sum + pv_tv - debt + cash
                row.append(float((equity * 1e9) / shares))
            surface.append(row)

        return jsonify({
            'success': True,
            'data': {
                'waccs': waccs.tolist(),
                'tgrs': tgrs.tolist(),
                'dcf_results': surface,
                'current_price': base['current_price'],
                'base_implied_price': base['implied_price']
            }
        })
    except Exception as exc:  # pragma: no cover
        return jsonify({'success': False, 'error': str(exc)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'DCF API'})


@app.route('/api/project/npv', methods=['POST'])
def project_npv():
    """
    Simple NPV/IRR calculator for project cash flows.
    Expects JSON:
      {
        "initial_cost": -500,
        "required_return": 0.10,  # decimal
        "cash_flows": [100, 150, 200]
      }
    """
    try:
        payload = request.get_json(force=True) or {}
        initial_cost = float(payload.get("initial_cost", 0))
        required_return = float(payload.get("required_return", 0))
        cash_flows = payload.get("cash_flows", [])

        if required_return <= 0:
            return jsonify({"detail": "required_return must be > 0"}), 400

        series = [initial_cost] + [float(cf) for cf in cash_flows]

        discount_table = []
        npv_total = 0.0
        for idx, cf in enumerate(series):
            year = idx
            df = 1.0 if year == 0 else (1 + required_return) ** year
            pv = cf if year == 0 else cf / df
            npv_total += pv
            discount_table.append({
                "year": year,
                "cash_flow": cf,
                "discount_factor": round(1/df, 6),
                "present_value": pv
            })

        irr = None
        try:
            irr = float(np.irr(series))
        except Exception:
            irr = None

        decision = "accept" if npv_total > 0 else "reject"

        return jsonify({
            "npv": npv_total,
            "irr": irr,
            "initial_cost": initial_cost,
            "required_return": required_return,
            "discount_table": discount_table,
            "decision": decision,
        })
    except Exception as exc:  # pragma: no cover
        return jsonify({"detail": str(exc)}), 500


if __name__ == '__main__':  # pragma: no cover
    app.run(host='0.0.0.0', port=5050, debug=True)

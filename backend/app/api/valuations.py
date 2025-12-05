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
    SensitivityResponse
)
from app.services.dcf_engine import DCFEngine, DCFInputs, ScenarioType
from app.config import settings

router = APIRouter()
dcf_engine = DCFEngine()


def fetch_company_data(ticker: str) -> Dict:
    """Fetch company data using yfinance"""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        financials = stock.financials
        balance_sheet = stock.balance_sheet
        cashflow = stock.cashflow

        # Extract key metrics
        market_cap = info.get('marketCap', 0)
        current_price = info.get('currentPrice', info.get('regularMarketPrice', 0))
        shares_outstanding = info.get('sharesOutstanding', 0)
        beta = info.get('beta', 1.0) or 1.0

        # Financial data
        if not financials.empty and 'Total Revenue' in financials.index:
            revenue = financials.loc['Total Revenue'].iloc[0] if len(financials.columns) > 0 else 0
        else:
            revenue = 0

        if not balance_sheet.empty:
            debt = balance_sheet.loc['Total Debt'].iloc[0] if 'Total Debt' in balance_sheet.index else 0
            cash = balance_sheet.loc['Cash And Cash Equivalents'].iloc[0] if 'Cash And Cash Equivalents' in balance_sheet.index else 0
        else:
            debt = 0
            cash = 0

        return {
            'info': info,
            'market_cap': market_cap,
            'current_price': current_price,
            'shares_outstanding': shares_outstanding,
            'beta': beta,
            'revenue': revenue,
            'debt': debt,
            'cash': cash,
            'cost_of_debt': 0.04
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching data for {ticker}: {str(e)}")


@router.post("/calculate", response_model=DCFResult)
async def calculate_dcf(params: DCFParameters):
    """
    Calculate DCF valuation for a ticker

    Returns complete DCF analysis including projections and terminal value
    """
    try:
        # Fetch company data
        company_data = fetch_company_data(params.ticker)

        # Build DCF inputs
        inputs = DCFInputs(
            revenue_start=company_data['revenue'] if company_data['revenue'] > 0 else 100e9,
            revenue_growth_start=params.revenue_growth_start or 0.08,
            ebit_margin_start=params.ebit_margin_start or 0.25,
            dna_ratio_start=params.dna_ratio_start or 0.04,
            capex_ratio_start=params.capex_ratio_start or 0.05,
            nwc_ratio_start=params.nwc_ratio_start or 0.02,
            tax_rate_start=params.tax_rate_start or settings.DEFAULT_TAX_RATE,
            nwc_level=0.0,
            revenue_growth_terminal=params.revenue_growth_terminal or 0.03,
            ebit_margin_terminal=params.ebit_margin_terminal or 0.20,
            dna_ratio_terminal=params.dna_ratio_start or 0.03,
            capex_ratio_terminal=params.capex_ratio_start or 0.04,
            nwc_ratio_terminal=params.nwc_ratio_start or 0.01,
            tax_rate_terminal=params.tax_rate_start or settings.DEFAULT_TAX_RATE,
            risk_free_rate=params.risk_free_rate or settings.DEFAULT_RISK_FREE_RATE,
            erp=params.erp or settings.DEFAULT_ERP,
            beta=company_data['beta'],
            cost_of_debt=params.cost_of_debt or company_data['cost_of_debt'],
            debt=company_data['debt'],
            equity=company_data['market_cap'],
            tax_rate=params.tax_rate_start or settings.DEFAULT_TAX_RATE,
            forecast_period=params.forecast_period,
            terminal_growth=params.terminal_growth or settings.DEFAULT_TERMINAL_GROWTH,
            manual_wacc=params.discount_rate,
            shares_outstanding=company_data['shares_outstanding'],
            cash=company_data['cash']
        )

        # Perform DCF
        result = dcf_engine.perform_dcf(inputs, company_data['current_price'])

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
        company_data = fetch_company_data(params.ticker)

        inputs = DCFInputs(
            revenue_start=company_data['revenue'] if company_data['revenue'] > 0 else 100e9,
            revenue_growth_start=params.revenue_growth_start or 0.08,
            ebit_margin_start=params.ebit_margin_start or 0.25,
            dna_ratio_start=params.dna_ratio_start or 0.04,
            capex_ratio_start=params.capex_ratio_start or 0.05,
            nwc_ratio_start=params.nwc_ratio_start or 0.02,
            tax_rate_start=params.tax_rate_start or settings.DEFAULT_TAX_RATE,
            nwc_level=0.0,
            revenue_growth_terminal=params.revenue_growth_terminal or 0.03,
            ebit_margin_terminal=params.ebit_margin_terminal or 0.20,
            dna_ratio_terminal=0.03,
            capex_ratio_terminal=0.04,
            nwc_ratio_terminal=0.01,
            tax_rate_terminal=settings.DEFAULT_TAX_RATE,
            risk_free_rate=params.risk_free_rate or settings.DEFAULT_RISK_FREE_RATE,
            erp=params.erp or settings.DEFAULT_ERP,
            beta=company_data['beta'],
            cost_of_debt=params.cost_of_debt or company_data['cost_of_debt'],
            debt=company_data['debt'],
            equity=company_data['market_cap'],
            tax_rate=settings.DEFAULT_TAX_RATE,
            forecast_period=params.forecast_period,
            terminal_growth=params.terminal_growth or settings.DEFAULT_TERMINAL_GROWTH,
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
        company_data = fetch_company_data(params.ticker)

        inputs = DCFInputs(
            revenue_start=company_data['revenue'] if company_data['revenue'] > 0 else 100e9,
            revenue_growth_start=params.revenue_growth_start or 0.08,
            ebit_margin_start=params.ebit_margin_start or 0.25,
            dna_ratio_start=params.dna_ratio_start or 0.04,
            capex_ratio_start=params.capex_ratio_start or 0.05,
            nwc_ratio_start=params.nwc_ratio_start or 0.02,
            tax_rate_start=params.tax_rate_start or settings.DEFAULT_TAX_RATE,
            nwc_level=0.0,
            revenue_growth_terminal=params.revenue_growth_terminal or 0.03,
            ebit_margin_terminal=params.ebit_margin_terminal or 0.20,
            dna_ratio_terminal=0.03,
            capex_ratio_terminal=0.04,
            nwc_ratio_terminal=0.01,
            tax_rate_terminal=settings.DEFAULT_TAX_RATE,
            risk_free_rate=params.risk_free_rate or settings.DEFAULT_RISK_FREE_RATE,
            erp=params.erp or settings.DEFAULT_ERP,
            beta=company_data['beta'],
            cost_of_debt=params.cost_of_debt or company_data['cost_of_debt'],
            debt=company_data['debt'],
            equity=company_data['market_cap'],
            tax_rate=settings.DEFAULT_TAX_RATE,
            forecast_period=params.forecast_period,
            terminal_growth=params.terminal_growth or settings.DEFAULT_TERMINAL_GROWTH,
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

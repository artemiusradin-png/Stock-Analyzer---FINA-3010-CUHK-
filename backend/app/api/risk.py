"""Risk analytics API endpoints"""
from fastapi import APIRouter, HTTPException
from typing import List
import yfinance as yf
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from app.schemas.risk import (
    RiskAnalysisRequest,
    RiskMetricsResponse,
    PortfolioRiskResponse
)
from app.services.risk_analytics import RiskAnalytics
from app.config import settings

router = APIRouter()
risk_analytics = RiskAnalytics()


def fetch_returns(ticker: str, lookback_days: int = 252) -> np.ndarray:
    """Fetch historical returns for a ticker"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=lookback_days + 30)

    data = yf.download(ticker, start=start_date, end=end_date, progress=False)
    if data.empty:
        raise ValueError(f"No data found for {ticker}")

    returns = data['Adj Close'].pct_change().dropna().values
    return returns


@router.post("/analyze", response_model=RiskMetricsResponse)
async def analyze_risk(request: RiskAnalysisRequest):
    """
    Comprehensive risk analysis for a single asset or portfolio

    Includes volatility, VaR, drawdown, Sharpe ratio, and more
    """
    try:
        if request.ticker:
            # Single asset analysis
            returns = fetch_returns(request.ticker, request.lookback_days)
            market_returns = fetch_returns(request.benchmark_ticker, request.lookback_days)

            metrics = risk_analytics.comprehensive_risk_analysis(
                returns,
                market_returns,
                request.risk_free_rate
            )

            return RiskMetricsResponse(
                ticker=request.ticker,
                volatility=float(metrics.volatility),
                downside_volatility=float(metrics.downside_volatility),
                beta=float(metrics.beta),
                alpha=float(metrics.alpha),
                r_squared=float(metrics.r_squared),
                var_95=float(metrics.var_95),
                var_99=float(metrics.var_99),
                cvar_95=float(metrics.cvar_95),
                max_drawdown=float(metrics.max_drawdown),
                max_drawdown_duration=int(metrics.max_drawdown_duration),
                sharpe_ratio=float(metrics.sharpe_ratio),
                sortino_ratio=float(metrics.sortino_ratio),
                calmar_ratio=float(metrics.calmar_ratio),
                skewness=float(metrics.skewness),
                kurtosis=float(metrics.kurtosis)
            )

        elif request.tickers and request.weights:
            # Portfolio analysis
            if len(request.tickers) != len(request.weights):
                raise ValueError("Tickers and weights must have same length")

            # Fetch returns for all assets
            end_date = datetime.now()
            start_date = end_date - timedelta(days=request.lookback_days + 30)

            data = yf.download(request.tickers, start=start_date, end=end_date, progress=False)['Adj Close']
            returns_df = data.pct_change().dropna()

            # Calculate portfolio returns
            weights = np.array(request.weights)
            portfolio_returns = (returns_df * weights).sum(axis=1).values

            market_returns = fetch_returns(request.benchmark_ticker, request.lookback_days)

            metrics = risk_analytics.comprehensive_risk_analysis(
                portfolio_returns,
                market_returns,
                request.risk_free_rate
            )

            return RiskMetricsResponse(
                ticker="Portfolio",
                volatility=float(metrics.volatility),
                downside_volatility=float(metrics.downside_volatility),
                beta=float(metrics.beta),
                alpha=float(metrics.alpha),
                r_squared=float(metrics.r_squared),
                var_95=float(metrics.var_95),
                var_99=float(metrics.var_99),
                cvar_95=float(metrics.cvar_95),
                max_drawdown=float(metrics.max_drawdown),
                max_drawdown_duration=int(metrics.max_drawdown_duration),
                sharpe_ratio=float(metrics.sharpe_ratio),
                sortino_ratio=float(metrics.sortino_ratio),
                calmar_ratio=float(metrics.calmar_ratio),
                skewness=float(metrics.skewness),
                kurtosis=float(metrics.kurtosis)
            )

        else:
            raise ValueError("Must provide either ticker or (tickers + weights)")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/portfolio-decomposition", response_model=PortfolioRiskResponse)
async def portfolio_risk_decomposition(
    tickers: List[str],
    weights: List[float],
    lookback_days: int = 252
):
    """
    Decompose portfolio risk into individual asset contributions

    Shows how much each asset contributes to total portfolio risk
    """
    try:
        if len(tickers) != len(weights):
            raise ValueError("Tickers and weights must have same length")

        # Fetch returns
        end_date = datetime.now()
        start_date = end_date - timedelta(days=lookback_days + 30)

        data = yf.download(tickers, start=start_date, end=end_date, progress=False)['Adj Close']
        returns_df = data.pct_change().dropna()

        # Calculate covariance matrix
        cov_matrix = returns_df.cov().values * 252  # Annualized

        weights_array = np.array(weights)

        decomposition = risk_analytics.portfolio_risk_decomposition(
            weights_array,
            returns_df,
            cov_matrix,
            tickers
        )

        return PortfolioRiskResponse(
            total_risk=float(decomposition.total_risk),
            systematic_risk=float(decomposition.systematic_risk),
            idiosyncratic_risk=float(decomposition.idiosyncratic_risk),
            marginal_var=decomposition.marginal_var,
            component_var=decomposition.component_var,
            percent_contribution=decomposition.percent_contribution
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

"""Portfolio optimization API endpoints"""
from fastapi import APIRouter, HTTPException
from typing import List
import yfinance as yf
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from app.schemas.portfolio import (
    PortfolioOptimizationRequest,
    PortfolioResponse,
    HoldingResponse,
    EfficientFrontierRequest,
    EfficientFrontierResponse,
    EfficientFrontierPoint
)
from app.services.portfolio_optimizer import (
    PortfolioOptimizer,
    OptimizationStrategy,
    PortfolioConstraints
)
from app.config import settings

router = APIRouter()


def fetch_returns_data(tickers: List[str], lookback_days: int = 252) -> pd.DataFrame:
    """Fetch historical price data and calculate returns"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=lookback_days + 30)

    try:
        # Download data with auto_adjust=True (Close column is already adjusted)
        raw_data = yf.download(tickers, start=start_date, end=end_date, progress=False, auto_adjust=True)

        # Extract Close prices (already adjusted when auto_adjust=True)
        if 'Close' in raw_data.columns:
            data = raw_data['Close']
        else:
            # Fallback for single ticker
            data = raw_data

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to download ticker data: {str(e)}")

    # Handle empty data
    if data is None or (isinstance(data, pd.DataFrame) and data.empty):
        raise HTTPException(
            status_code=400,
            detail=f"No price data available for any of the provided tickers. They may be delisted or invalid."
        )

    if isinstance(data, pd.Series):
        data = data.to_frame(name=tickers[0])

    # Filter out tickers with insufficient data (less than 30 days of prices)
    valid_columns = []
    invalid_tickers = []

    for col in data.columns:
        non_null_count = data[col].notna().sum()
        if non_null_count >= 30:  # Require at least 30 data points
            valid_columns.append(col)
        else:
            invalid_tickers.append(col)

    if len(valid_columns) < 2:
        error_msg = f"Insufficient data for optimization. Only {len(valid_columns)} ticker(s) have enough historical data. Need at least 2 valid tickers."
        if invalid_tickers:
            error_msg += f"\n\nTickers with insufficient data: {', '.join(invalid_tickers)}"
            error_msg += "\n\nThese tickers may be delisted, recently IPO'd, or invalid. Please remove them and add valid, actively traded stocks (e.g., AAPL, MSFT, GOOGL, JNJ)."
        raise HTTPException(status_code=400, detail=error_msg)

    # Use only valid tickers
    data = data[valid_columns]

    # Calculate returns with proper handling
    returns = data.pct_change(fill_method=None).dropna()

    # Remove any columns with all NaN or infinite values
    returns = returns.replace([np.inf, -np.inf], np.nan)
    returns = returns.dropna(axis=1, how='all')

    if returns.empty or len(returns.columns) < 2:
        raise HTTPException(
            status_code=400,
            detail="Insufficient valid return data for portfolio optimization"
        )

    return returns


@router.post("/optimize", response_model=PortfolioResponse)
async def optimize_portfolio(request: PortfolioOptimizationRequest):
    """
    Optimize portfolio using Modern Portfolio Theory

    Supports multiple strategies: max_sharpe, min_variance, target_return, risk_parity, etc.
    """
    try:
        tickers = [asset.ticker for asset in request.assets]
        returns = fetch_returns_data(tickers, request.lookback_days)

        # Calculate expected returns and covariance
        expected_returns = returns.mean().values * 252  # Annualize
        cov_matrix = returns.cov().values * 252

        # Build constraints
        constraints = PortfolioConstraints(
            min_weight=request.constraints.get('min_weight', 0.0) if request.constraints else 0.0,
            max_weight=request.constraints.get('max_weight', 1.0) if request.constraints else 1.0,
            target_return=request.constraints.get('target_return') if request.constraints else None,
            allow_short=request.constraints.get('allow_short', False) if request.constraints else False
        )

        # Extract DCF upsides if provided
        dcf_upsides = None
        if request.strategy == "dcf_weighted":
            dcf_upsides = np.array([asset.dcf_upside or 0.0 for asset in request.assets])

        # Optimize
        optimizer = PortfolioOptimizer(risk_free_rate=request.risk_free_rate)
        strategy = OptimizationStrategy(request.strategy)

        metrics = optimizer.optimize(
            tickers=tickers,
            expected_returns=expected_returns,
            cov_matrix=cov_matrix,
            strategy=strategy,
            constraints=constraints,
            dcf_upsides=dcf_upsides
        )

        # Build response
        holdings = []
        for i, ticker in enumerate(tickers):
            holdings.append(HoldingResponse(
                ticker=ticker,
                weight=float(metrics.weights[i]),
                expected_return=float(metrics.asset_returns[i]),
                volatility=float(metrics.asset_volatilities[i]),
                contribution_to_return=float(metrics.weights[i] * metrics.asset_returns[i]),
                contribution_to_risk=None
            ))

        return PortfolioResponse(
            portfolio_id=None,
            name=None,
            strategy=request.strategy,
            holdings=holdings,
            expected_return=float(metrics.expected_return),
            volatility=float(metrics.volatility),
            sharpe_ratio=float(metrics.sharpe_ratio)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/efficient-frontier", response_model=EfficientFrontierResponse)
async def calculate_efficient_frontier(request: EfficientFrontierRequest):
    """
    Calculate the efficient frontier

    Returns a series of optimal portfolios at different risk/return levels
    """
    try:
        returns = fetch_returns_data(request.tickers, request.lookback_days)

        expected_returns = returns.mean().values * 252
        cov_matrix = returns.cov().values * 252

        constraints = PortfolioConstraints(min_weight=0.0, max_weight=1.0)

        optimizer = PortfolioOptimizer(risk_free_rate=request.risk_free_rate)
        frontier_df = optimizer.efficient_frontier(
            expected_returns,
            cov_matrix,
            constraints,
            n_points=request.n_points
        )

        frontier_points = []
        for _, row in frontier_df.iterrows():
            point = EfficientFrontierPoint(
                target_return=float(row['target_return']),
                return_achieved=float(row['return']),
                volatility=float(row['volatility']),
                sharpe_ratio=float(row['sharpe_ratio']),
                weights=row['weights']
            )
            frontier_points.append(point)

        # Find max Sharpe and min variance points
        max_sharpe_idx = frontier_df['sharpe_ratio'].idxmax()
        min_var_idx = frontier_df['volatility'].idxmin()

        max_sharpe_point = frontier_points[max_sharpe_idx]
        min_var_point = frontier_points[min_var_idx]

        return EfficientFrontierResponse(
            tickers=request.tickers,
            frontier=frontier_points,
            max_sharpe_point=max_sharpe_point,
            min_variance_point=min_var_point
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

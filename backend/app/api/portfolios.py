"""Portfolio optimization API endpoints"""
from fastapi import APIRouter, HTTPException
from typing import List, Tuple
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
    EfficientFrontierPoint,
    MonteCarloRequest,
    MonteCarloResponse,
    MonteCarloPoint,
    RiskAnalyticsRequest,
    RiskAnalyticsResponse,
    RiskMetrics,
    RiskDecomposition
)
from app.services.portfolio_optimizer import (
    PortfolioOptimizer,
    OptimizationStrategy,
    PortfolioConstraints
)
from app.config import settings

router = APIRouter()


def validate_tickers(tickers: List[str]) -> Tuple[List[str], List[str]]:
    """
    Validate tickers before optimization
    Returns (valid_tickers, invalid_tickers)
    """
    valid_tickers = []
    invalid_tickers = []
    
    for ticker in tickers:
        try:
            # Quick validation: try to download 5 days of data
            test_data = yf.download(ticker, period="5d", progress=False, auto_adjust=True)
            if test_data is not None and not test_data.empty and len(test_data) >= 2:
                valid_tickers.append(ticker)
            else:
                invalid_tickers.append(ticker)
        except Exception:
            invalid_tickers.append(ticker)
    
    return valid_tickers, invalid_tickers


def fetch_returns_data(tickers: List[str], lookback_days: int = 252) -> Tuple[pd.DataFrame, List[str]]:
    """
    Fetch historical price data and calculate returns
    Returns (returns_dataframe, invalid_tickers_list)
    """
    print(f"\n--- fetch_returns_data START ---")
    print(f"DEBUG: Input tickers: {tickers}")
    print(f"DEBUG: Lookback days: {lookback_days}")

    # Use period parameter instead of start/end dates to avoid system clock issues
    # yfinance handles "period" relative to current time internally, which avoids future date problems
    period_str = f"{lookback_days + 30}d"  # Add 30 days buffer
    print(f"DEBUG: Using period: {period_str}")

    # SKIP validation - it's too flaky and causes false negatives
    # Go straight to downloading the full historical data
    print("DEBUG: Skipping validate_tickers() - going straight to full download")
    tickers_to_download = tickers
    invalid_tickers = []

    print(f"DEBUG: Will attempt to download: {tickers_to_download}")

    try:
        # Download data using period parameter (avoids system clock issues)
        print(f"\nDEBUG: Calling yf.download()...")
        print(f"  - tickers: {tickers_to_download}")
        print(f"  - period: {period_str}")

        raw_data = yf.download(tickers_to_download, period=period_str, progress=False, auto_adjust=True)

        print(f"DEBUG: yf.download() completed")
        print(f"  - raw_data type: {type(raw_data)}")
        print(f"  - raw_data shape: {raw_data.shape if hasattr(raw_data, 'shape') else 'N/A'}")
        print(f"  - raw_data columns: {list(raw_data.columns) if hasattr(raw_data, 'columns') else 'N/A'}")
        print(f"  - raw_data empty: {raw_data.empty if hasattr(raw_data, 'empty') else 'N/A'}")

        # Extract Close prices (already adjusted when auto_adjust=True)
        if 'Close' in raw_data.columns:
            data = raw_data['Close']
            print("DEBUG: Extracted 'Close' column from multi-level columns")
        else:
            # Fallback for single ticker
            data = raw_data
            print("DEBUG: Using raw_data as-is (single ticker case)")

        print(f"DEBUG: Extracted data shape: {data.shape}")

    except Exception as e:
        print(f"DEBUG: ✗ yf.download() FAILED: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to download ticker data: {str(e)}")

    # Handle empty data
    print("\nDEBUG: Checking for empty data...")
    if data is None or (isinstance(data, pd.DataFrame) and data.empty):
        print("DEBUG: ✗ Data is None or empty!")
        error_detail = f"No price data available for any of the provided tickers: {', '.join(tickers_to_download)}. "
        error_detail += "They may be delisted or invalid. Please check ticker symbols and try again."
        raise HTTPException(status_code=400, detail=error_detail)

    print("DEBUG: Data is not empty, proceeding...")

    if isinstance(data, pd.Series):
        # Use the first ticker from tickers_to_download
        ticker_name = tickers_to_download[0] if len(tickers_to_download) > 0 else tickers[0]
        print(f"DEBUG: Converting Series to DataFrame with ticker name: {ticker_name}")
        data = data.to_frame(name=ticker_name)

    # Filter out tickers with insufficient data (less than 30 days of prices)
    print("\nDEBUG: Filtering tickers with insufficient data...")
    final_valid_columns = []
    additional_invalid = []

    for col in data.columns:
        non_null_count = data[col].notna().sum()
        print(f"  - {col}: {non_null_count} non-null data points")
        if non_null_count >= 30:  # Require at least 30 data points
            final_valid_columns.append(col)
        else:
            additional_invalid.append(col)
            if col not in invalid_tickers:
                invalid_tickers.append(col)

    print(f"DEBUG: Final valid columns: {final_valid_columns}")
    print(f"DEBUG: Additional invalid: {additional_invalid}")

    if len(final_valid_columns) < 2:
        print(f"DEBUG: ✗ Only {len(final_valid_columns)} valid ticker(s), need at least 2")
        error_msg = f"Insufficient data for optimization. Only {len(final_valid_columns)} ticker(s) have enough historical data. Need at least 2 valid tickers."
        if invalid_tickers or additional_invalid:
            all_invalid = list(set(invalid_tickers + additional_invalid))
            error_msg += f"\n\nTickers with insufficient data: {', '.join(all_invalid)}"
            error_msg += "\n\nThese tickers may be delisted, recently IPO'd, or invalid. Please remove them and add valid, actively traded stocks (e.g., AAPL, MSFT, GOOGL, JNJ)."
        raise HTTPException(status_code=400, detail=error_msg)

    # Use only valid tickers
    data = data[final_valid_columns]
    print(f"DEBUG: Using {len(final_valid_columns)} valid tickers")

    # Calculate returns with proper handling
    print("\nDEBUG: Calculating returns...")
    returns = data.pct_change(fill_method=None).dropna()
    print(f"DEBUG: Returns shape after pct_change: {returns.shape}")

    # Remove any columns with all NaN or infinite values
    returns = returns.replace([np.inf, -np.inf], np.nan)
    returns = returns.dropna(axis=1, how='all')
    print(f"DEBUG: Returns shape after cleaning: {returns.shape}")

    if returns.empty or len(returns.columns) < 2:
        print("DEBUG: ✗ Returns are empty or less than 2 columns")
        raise HTTPException(
            status_code=400,
            detail="Insufficient valid return data for portfolio optimization"
        )

    print(f"DEBUG: ✓ fetch_returns_data completed successfully")
    print(f"  - Final tickers: {list(returns.columns)}")
    print(f"  - Returns shape: {returns.shape}")
    print(f"--- fetch_returns_data END ---\n")
    return returns, invalid_tickers


@router.post("/optimize", response_model=PortfolioResponse)
async def optimize_portfolio(request: PortfolioOptimizationRequest):
    """
    Optimize portfolio using Modern Portfolio Theory

    Supports multiple strategies: max_sharpe, min_variance, target_return, risk_parity, etc.
    """
    try:
        tickers = [asset.ticker for asset in request.assets]
        print(f"\n{'='*60}")
        print(f"DEBUG: optimize_portfolio called")
        print(f"DEBUG: tickers: {tickers}")
        print(f"DEBUG: strategy: {request.strategy}")
        print(f"DEBUG: constraints: {request.constraints}")
        print(f"DEBUG: lookback_days: {request.lookback_days}")
        print(f"DEBUG: risk_free_rate: {request.risk_free_rate}")
        print(f"{'='*60}\n")

        print("DEBUG: Fetching returns data...")
        returns, invalid_tickers = fetch_returns_data(tickers, request.lookback_days)
        print(f"DEBUG: ✓ Successfully fetched returns for {len(returns.columns)} tickers: {list(returns.columns)}")
        print(f"DEBUG: Returns shape: {returns.shape}")
        print(f"DEBUG: Date range: {returns.index[0]} to {returns.index[-1]}")
        
        # Update tickers list to only include valid ones
        tickers = list(returns.columns)

        # Calculate expected returns and covariance
        print("\nDEBUG: Calculating expected returns and covariance...")
        expected_returns = returns.mean().values * 252  # Annualize
        cov_matrix = returns.cov().values * 252
        print(f"DEBUG: Expected returns (annualized): {expected_returns}")
        print(f"DEBUG: Expected returns range: {expected_returns.min():.4f} to {expected_returns.max():.4f}")
        print(f"DEBUG: Covariance matrix shape: {cov_matrix.shape}")

        # Build constraints
        min_weight = request.constraints.get('min_weight', 0.0) if request.constraints else 0.0
        max_weight = request.constraints.get('max_weight', 1.0) if request.constraints else 1.0
        target_return = request.constraints.get('target_return') if request.constraints else None
        allow_short = request.constraints.get('allow_short', False) if request.constraints else False

        constraints = PortfolioConstraints(
            min_weight=min_weight,
            max_weight=max_weight,
            target_return=target_return,
            allow_short=allow_short
        )

        print(f"\nDEBUG: Portfolio Constraints:")
        print(f"  - min_weight: {min_weight} ({min_weight*100:.1f}%)")
        print(f"  - max_weight: {max_weight} ({max_weight*100:.1f}%)")
        print(f"  - target_return: {target_return} ({target_return*100:.1f}% if set)" if target_return else "  - target_return: None")
        print(f"  - allow_short: {allow_short}")
        print(f"  - Number of assets: {len(tickers)}")
        print(f"  - Minimum total allocation: {len(tickers) * min_weight * 100:.1f}%")
        print(f"  - Maximum total allocation possible: {min(len(tickers) * max_weight, 1.0) * 100:.1f}%")

        # Extract DCF upsides if provided (only for valid tickers)
        dcf_upsides = None
        if request.strategy == "dcf_weighted":
            # Create a mapping of ticker to dcf_upside
            ticker_to_upside = {asset.ticker: asset.dcf_upside or 0.0 for asset in request.assets}
            # Only include upsides for valid tickers
            dcf_upsides = np.array([ticker_to_upside.get(ticker, 0.0) for ticker in tickers])

        # Optimize
        print(f"\nDEBUG: Starting optimization with strategy: {request.strategy}")
        optimizer = PortfolioOptimizer(risk_free_rate=request.risk_free_rate)
        strategy = OptimizationStrategy(request.strategy)

        print("DEBUG: Calling optimizer.optimize()...")
        try:
            metrics = optimizer.optimize(
                tickers=tickers,
                expected_returns=expected_returns,
                cov_matrix=cov_matrix,
                strategy=strategy,
                constraints=constraints,
                dcf_upsides=dcf_upsides
            )
            print("DEBUG: ✓ Optimization completed successfully")
            print(f"DEBUG: Optimal weights: {metrics.weights}")
            print(f"DEBUG: Portfolio return: {metrics.expected_return:.4f}")
            print(f"DEBUG: Portfolio volatility: {metrics.volatility:.4f}")
            print(f"DEBUG: Sharpe ratio: {metrics.sharpe_ratio:.4f}")
        except Exception as opt_error:
            print(f"DEBUG: ✗ Optimization FAILED: {type(opt_error).__name__}: {str(opt_error)}")
            raise

        # Calculate risk contribution for each asset
        # Risk contribution = w_i * (Σw)_i / σ_p
        portfolio_vol = metrics.volatility
        marginal_contrib = np.dot(metrics.covariance_matrix, metrics.weights)
        risk_contributions = metrics.weights * marginal_contrib / portfolio_vol if portfolio_vol > 0 else np.zeros(len(tickers))

        # Build response
        holdings = []
        for i, ticker in enumerate(tickers):
            holdings.append(HoldingResponse(
                ticker=ticker,
                weight=float(metrics.weights[i]),
                expected_return=float(metrics.asset_returns[i]),
                volatility=float(metrics.asset_volatilities[i]),
                contribution_to_return=float(metrics.weights[i] * metrics.asset_returns[i]),
                contribution_to_risk=float(risk_contributions[i]) if portfolio_vol > 0 else 0.0
            ))

        print("\nDEBUG: Building response...")
        response = PortfolioResponse(
            portfolio_id=None,
            name=None,
            strategy=request.strategy,
            holdings=holdings,
            expected_return=float(metrics.expected_return),
            volatility=float(metrics.volatility),
            sharpe_ratio=float(metrics.sharpe_ratio)
        )
        print("DEBUG: ✓ Response built successfully")
        print(f"{'='*60}\n")
        return response

    except HTTPException as http_exc:
        # Re-raise HTTP exceptions as-is (don't convert to 500)
        print(f"\nDEBUG: HTTPException raised: {http_exc.status_code} - {http_exc.detail}")
        print(f"{'='*60}\n")
        raise
    except Exception as e:
        print(f"\nDEBUG: ✗ Unexpected exception: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*60}\n")
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


@router.post("/efficient-frontier", response_model=EfficientFrontierResponse)
async def calculate_efficient_frontier(request: EfficientFrontierRequest):
    """
    Calculate the efficient frontier

    Returns a series of optimal portfolios at different risk/return levels
    """
    try:
        returns, invalid_tickers = fetch_returns_data(request.tickers, request.lookback_days)
        
        # Update tickers to only valid ones
        valid_tickers = list(returns.columns)

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
            tickers=valid_tickers,
            frontier=frontier_points,
            max_sharpe_point=max_sharpe_point,
            min_variance_point=min_var_point
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/monte-carlo", response_model=MonteCarloResponse)
async def monte_carlo_simulation(request: MonteCarloRequest):
    """
    Run Monte Carlo simulation to generate random portfolio allocations
    and visualize risk/return distribution
    """
    try:
        returns, invalid_tickers = fetch_returns_data(request.tickers, request.lookback_days)
        valid_tickers = list(returns.columns)
        
        if len(valid_tickers) < 2:
            raise HTTPException(
                status_code=400,
                detail="Need at least 2 valid tickers for Monte Carlo simulation"
            )

        # Calculate expected returns and covariance (annualized)
        expected_returns = returns.mean().values * 252
        cov_matrix = returns.cov().values * 252
        
        n_assets = len(valid_tickers)
        n_sims = request.n_simulations
        
        # Generate random portfolio weights
        np.random.seed(42)  # For reproducibility
        simulations = []
        
        for _ in range(n_sims):
            # Generate random weights (Dirichlet distribution for uniform sampling)
            weights = np.random.dirichlet(np.ones(n_assets))
            
            # Calculate portfolio metrics
            portfolio_return = np.dot(weights, expected_returns)
            portfolio_variance = np.dot(weights, np.dot(cov_matrix, weights))
            portfolio_vol = np.sqrt(portfolio_variance)
            sharpe = (portfolio_return - request.risk_free_rate) / portfolio_vol if portfolio_vol > 0 else 0.0
            
            simulations.append(MonteCarloPoint(
                return_simulated=float(portfolio_return),
                volatility_simulated=float(portfolio_vol),
                sharpe_ratio=float(sharpe),
                weights=weights.tolist()
            ))
        
        # Calculate summary statistics
        returns_list = [s.return_simulated for s in simulations]
        volatilities_list = [s.volatility_simulated for s in simulations]
        
        mean_return = float(np.mean(returns_list))
        mean_volatility = float(np.mean(volatilities_list))
        percentile_5_return = float(np.percentile(returns_list, 5))
        percentile_95_return = float(np.percentile(returns_list, 95))
        
        return MonteCarloResponse(
            tickers=valid_tickers,
            simulations=simulations,
            mean_return=mean_return,
            mean_volatility=mean_volatility,
            percentile_5_return=percentile_5_return,
            percentile_95_return=percentile_95_return
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Monte Carlo simulation failed: {str(e)}")


@router.post("/risk-analytics", response_model=RiskAnalyticsResponse)
async def calculate_risk_analytics(request: RiskAnalyticsRequest):
    """
    Calculate comprehensive risk analytics for a portfolio

    Includes:
    - Volatility metrics (annualized, downside)
    - Market risk (Beta, Alpha, R-squared)
    - Downside risk (VaR, CVaR, Max Drawdown)
    - Risk-adjusted returns (Sharpe, Sortino, Calmar)
    - Risk decomposition by asset
    - Systematic vs Idiosyncratic risk
    """
    try:
        returns, invalid_tickers = fetch_returns_data(request.tickers, request.lookback_days)
        valid_tickers = list(returns.columns)

        if len(valid_tickers) < 1:
            raise HTTPException(
                status_code=400,
                detail="Need at least 1 valid ticker for risk analytics"
            )

        # Determine weights (equal weight if not provided)
        if request.weights is None:
            weights = np.ones(len(valid_tickers)) / len(valid_tickers)
        else:
            # Filter weights to match valid tickers
            ticker_to_weight = dict(zip(request.tickers, request.weights))
            weights = np.array([ticker_to_weight.get(t, 0.0) for t in valid_tickers])
            # Normalize weights
            weights = weights / weights.sum()

        # Calculate portfolio returns
        portfolio_returns = (returns * weights).sum(axis=1)

        # 1. VOLATILITY METRICS
        annualized_vol = returns.std().values * np.sqrt(252)
        portfolio_vol = portfolio_returns.std() * np.sqrt(252)

        # Downside volatility (volatility of negative returns)
        negative_returns = portfolio_returns[portfolio_returns < 0]
        downside_vol = negative_returns.std() * np.sqrt(252) if len(negative_returns) > 0 else 0.0

        # 2. MARKET RISK (using SPY as market proxy)
        try:
            spy_data = yf.download('SPY', period=f"{request.lookback_days}d", progress=False, auto_adjust=True)
            spy_returns = spy_data['Close'].pct_change(fill_method=None).dropna()

            # Align dates
            aligned_returns = portfolio_returns.reindex(spy_returns.index).dropna()
            aligned_spy = spy_returns.reindex(aligned_returns.index).dropna()

            if len(aligned_returns) > 10 and len(aligned_spy) > 10:
                # Calculate Beta
                covariance = np.cov(aligned_returns, aligned_spy)[0, 1]
                market_variance = np.var(aligned_spy)
                beta = covariance / market_variance if market_variance > 0 else None

                # Calculate Alpha (annualized)
                portfolio_mean_return = aligned_returns.mean() * 252
                market_mean_return = aligned_spy.mean() * 252
                alpha = portfolio_mean_return - (request.risk_free_rate + beta * (market_mean_return - request.risk_free_rate)) if beta is not None else None

                # Calculate R-squared
                correlation = np.corrcoef(aligned_returns, aligned_spy)[0, 1]
                r_squared = correlation ** 2 if not np.isnan(correlation) else None
            else:
                beta, alpha, r_squared = None, None, None
        except:
            beta, alpha, r_squared = None, None, None

        # 3. DOWNSIDE RISK
        # Value at Risk (VaR)
        var = np.percentile(portfolio_returns, (1 - request.confidence_level) * 100)
        var_annualized = var * np.sqrt(252)

        # Conditional Value at Risk (CVaR / Expected Shortfall)
        cvar_returns = portfolio_returns[portfolio_returns <= var]
        cvar = cvar_returns.mean() if len(cvar_returns) > 0 else var
        cvar_annualized = cvar * np.sqrt(252)

        # Maximum Drawdown
        cumulative_returns = (1 + portfolio_returns).cumprod()
        running_max = cumulative_returns.expanding().max()
        drawdown = (cumulative_returns - running_max) / running_max
        max_drawdown = drawdown.min()

        # 4. RISK-ADJUSTED RETURNS
        portfolio_mean_return = portfolio_returns.mean() * 252

        # Sharpe Ratio
        sharpe = (portfolio_mean_return - request.risk_free_rate) / portfolio_vol if portfolio_vol > 0 else 0.0

        # Sortino Ratio (uses downside volatility)
        sortino = (portfolio_mean_return - request.risk_free_rate) / downside_vol if downside_vol > 0 else 0.0

        # Calmar Ratio (return / max drawdown)
        calmar = portfolio_mean_return / abs(max_drawdown) if max_drawdown != 0 else 0.0

        # 5. DISTRIBUTION METRICS
        from scipy import stats
        skewness = float(stats.skew(portfolio_returns))
        kurtosis = float(stats.kurtosis(portfolio_returns))

        # 6. RISK DECOMPOSITION
        cov_matrix = returns.cov().values * 252
        portfolio_variance = np.dot(weights, np.dot(cov_matrix, weights))

        # Marginal VaR approximation using volatility contribution
        marginal_contrib = np.dot(cov_matrix, weights)
        marginal_var = marginal_contrib / np.sqrt(portfolio_variance) if portfolio_variance > 0 else np.zeros(len(valid_tickers))

        # Component VaR
        component_var = weights * marginal_var

        # Percent contribution to risk
        total_component_var = component_var.sum()
        percent_contrib = (component_var / total_component_var * 100) if total_component_var > 0 else np.zeros(len(valid_tickers))

        risk_decomposition = []
        for i, ticker in enumerate(valid_tickers):
            risk_decomposition.append(RiskDecomposition(
                ticker=ticker,
                weight=float(weights[i]),
                marginal_var=float(marginal_var[i]),
                component_var=float(component_var[i]),
                percent_contribution_to_risk=float(percent_contrib[i])
            ))

        # 7. SYSTEMATIC VS IDIOSYNCRATIC RISK
        if beta is not None and r_squared is not None:
            systematic_risk = portfolio_vol * np.sqrt(r_squared)
            idiosyncratic_risk = portfolio_vol * np.sqrt(1 - r_squared)
        else:
            # Fallback: use diversification ratio
            weighted_vols = np.dot(weights, annualized_vol)
            systematic_risk = portfolio_vol
            idiosyncratic_risk = weighted_vols - portfolio_vol

        # Build response
        portfolio_metrics = RiskMetrics(
            annualized_volatility=float(portfolio_vol),
            downside_volatility=float(downside_vol),
            beta=float(beta) if beta is not None else None,
            alpha=float(alpha) if alpha is not None else None,
            r_squared=float(r_squared) if r_squared is not None else None,
            value_at_risk=float(var_annualized),
            conditional_value_at_risk=float(cvar_annualized),
            max_drawdown=float(max_drawdown),
            sharpe_ratio=float(sharpe),
            sortino_ratio=float(sortino),
            calmar_ratio=float(calmar),
            skewness=skewness,
            kurtosis=kurtosis
        )

        return RiskAnalyticsResponse(
            portfolio_metrics=portfolio_metrics,
            risk_decomposition=risk_decomposition,
            systematic_risk=float(systematic_risk),
            idiosyncratic_risk=float(idiosyncratic_risk)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk analytics calculation failed: {str(e)}")

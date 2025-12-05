"""Risk Analytics Module for Portfolio and Asset Risk Assessment"""
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from dataclasses import dataclass
from scipy import stats


@dataclass
class RiskMetrics:
    """Comprehensive risk metrics for an asset or portfolio"""
    # Volatility measures
    volatility: float  # Annualized standard deviation
    downside_volatility: float  # Semi-deviation (downside only)

    # Market risk
    beta: float  # Systematic risk vs market
    alpha: float  # Excess return vs market (Jensen's alpha)
    r_squared: float  # Correlation with market

    # Downside risk
    var_95: float  # Value at Risk (95% confidence)
    var_99: float  # Value at Risk (99% confidence)
    cvar_95: float  # Conditional VaR (Expected Shortfall)
    max_drawdown: float  # Maximum peak-to-trough decline
    max_drawdown_duration: int  # Days in drawdown

    # Return metrics
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float  # Return / Max Drawdown

    # Distribution properties
    skewness: float
    kurtosis: float


@dataclass
class PortfolioRisk:
    """Portfolio-level risk decomposition"""
    total_risk: float  # Portfolio volatility
    systematic_risk: float  # Market-related risk
    idiosyncratic_risk: float  # Diversifiable risk

    # Risk contributions by asset
    marginal_var: Dict[str, float]  # Marginal VaR contribution
    component_var: Dict[str, float]  # Component VaR
    percent_contribution: Dict[str, float]  # % contribution to total risk


class RiskAnalytics:
    """Risk analytics calculator"""

    def __init__(self, trading_days_per_year: int = 252):
        self.trading_days = trading_days_per_year

    def calculate_volatility(
        self,
        returns: np.ndarray,
        annualize: bool = True
    ) -> float:
        """Calculate annualized volatility"""
        vol = np.std(returns, ddof=1)
        if annualize:
            vol *= np.sqrt(self.trading_days)
        return vol

    def calculate_downside_volatility(
        self,
        returns: np.ndarray,
        target_return: float = 0.0,
        annualize: bool = True
    ) -> float:
        """
        Calculate downside volatility (semi-deviation)
        Only considers returns below target
        """
        downside_returns = returns[returns < target_return]
        if len(downside_returns) == 0:
            return 0.0

        downside_vol = np.std(downside_returns, ddof=1)
        if annualize:
            downside_vol *= np.sqrt(self.trading_days)
        return downside_vol

    def calculate_beta(
        self,
        asset_returns: np.ndarray,
        market_returns: np.ndarray
    ) -> Tuple[float, float, float]:
        """
        Calculate beta, alpha, and R-squared

        Beta = Cov(R_asset, R_market) / Var(R_market)
        Alpha = R_asset - (R_f + Beta * (R_market - R_f))
        """
        # Ensure same length
        min_len = min(len(asset_returns), len(market_returns))
        asset_returns = asset_returns[-min_len:]
        market_returns = market_returns[-min_len:]

        # Calculate beta
        covariance = np.cov(asset_returns, market_returns)[0, 1]
        market_variance = np.var(market_returns, ddof=1)
        beta = covariance / market_variance if market_variance > 0 else 1.0

        # Calculate R-squared (correlation^2)
        correlation = np.corrcoef(asset_returns, market_returns)[0, 1]
        r_squared = correlation ** 2

        # Calculate alpha (using simple CAPM, assuming Rf=0 for daily returns)
        avg_asset_return = np.mean(asset_returns)
        avg_market_return = np.mean(market_returns)
        alpha = avg_asset_return - (beta * avg_market_return)

        # Annualize alpha
        alpha_annual = alpha * self.trading_days

        return beta, alpha_annual, r_squared

    def calculate_var(
        self,
        returns: np.ndarray,
        confidence_level: float = 0.95,
        method: str = 'historical'
    ) -> float:
        """
        Calculate Value at Risk (VaR)

        Methods:
        - historical: Use empirical quantile
        - parametric: Assume normal distribution
        - cornish-fisher: Adjust for skew and kurtosis
        """
        if method == 'historical':
            var = np.percentile(returns, (1 - confidence_level) * 100)

        elif method == 'parametric':
            mean = np.mean(returns)
            std = np.std(returns, ddof=1)
            z_score = stats.norm.ppf(1 - confidence_level)
            var = mean + z_score * std

        elif method == 'cornish-fisher':
            mean = np.mean(returns)
            std = np.std(returns, ddof=1)
            skew = stats.skew(returns)
            kurt = stats.kurtosis(returns)

            # Cornish-Fisher adjustment
            z = stats.norm.ppf(1 - confidence_level)
            z_cf = z + (z**2 - 1) * skew / 6 + \
                   (z**3 - 3*z) * kurt / 24 - \
                   (2*z**3 - 5*z) * skew**2 / 36

            var = mean + z_cf * std

        else:
            raise ValueError(f"Unknown VaR method: {method}")

        return var

    def calculate_cvar(
        self,
        returns: np.ndarray,
        confidence_level: float = 0.95
    ) -> float:
        """
        Calculate Conditional VaR (CVaR / Expected Shortfall)
        Expected loss given that loss exceeds VaR
        """
        var = self.calculate_var(returns, confidence_level, method='historical')
        # CVaR is the mean of all returns below VaR
        tail_losses = returns[returns <= var]
        cvar = np.mean(tail_losses) if len(tail_losses) > 0 else var
        return cvar

    def calculate_max_drawdown(
        self,
        returns: np.ndarray
    ) -> Tuple[float, int]:
        """
        Calculate maximum drawdown and duration

        Returns:
            (max_drawdown, duration_in_days)
        """
        cumulative = np.cumprod(1 + returns)
        running_max = np.maximum.accumulate(cumulative)
        drawdown = (cumulative - running_max) / running_max

        max_dd = np.min(drawdown)

        # Calculate duration
        if max_dd < 0:
            max_dd_idx = np.argmin(drawdown)
            # Find the peak before this drawdown
            peak_idx = np.argmax(cumulative[:max_dd_idx + 1])
            duration = max_dd_idx - peak_idx
        else:
            duration = 0

        return max_dd, duration

    def calculate_sharpe_ratio(
        self,
        returns: np.ndarray,
        risk_free_rate: float = 0.045,
        annualize: bool = True
    ) -> float:
        """Calculate Sharpe ratio"""
        excess_returns = returns - (risk_free_rate / self.trading_days)
        mean_excess = np.mean(excess_returns)
        std_excess = np.std(excess_returns, ddof=1)

        if std_excess == 0:
            return 0.0

        sharpe = mean_excess / std_excess

        if annualize:
            sharpe *= np.sqrt(self.trading_days)

        return sharpe

    def calculate_sortino_ratio(
        self,
        returns: np.ndarray,
        risk_free_rate: float = 0.045,
        target_return: float = 0.0,
        annualize: bool = True
    ) -> float:
        """Calculate Sortino ratio (Sharpe with downside deviation)"""
        excess_returns = returns - (risk_free_rate / self.trading_days)
        mean_excess = np.mean(excess_returns)

        downside_vol = self.calculate_downside_volatility(
            returns, target_return, annualize=False
        )

        if downside_vol == 0:
            return 0.0

        sortino = mean_excess / downside_vol

        if annualize:
            sortino *= np.sqrt(self.trading_days)

        return sortino

    def calculate_calmar_ratio(
        self,
        returns: np.ndarray,
        annualize: bool = True
    ) -> float:
        """Calculate Calmar ratio (Return / Max Drawdown)"""
        avg_return = np.mean(returns)
        if annualize:
            avg_return *= self.trading_days

        max_dd, _ = self.calculate_max_drawdown(returns)

        if max_dd == 0:
            return 0.0

        calmar = avg_return / abs(max_dd)
        return calmar

    def comprehensive_risk_analysis(
        self,
        returns: np.ndarray,
        market_returns: Optional[np.ndarray] = None,
        risk_free_rate: float = 0.045
    ) -> RiskMetrics:
        """
        Perform comprehensive risk analysis on return series

        Args:
            returns: Asset/portfolio return series
            market_returns: Market benchmark returns (for beta calculation)
            risk_free_rate: Annual risk-free rate

        Returns:
            RiskMetrics object with all metrics
        """
        # Volatility
        vol = self.calculate_volatility(returns)
        downside_vol = self.calculate_downside_volatility(returns)

        # Market risk (if benchmark provided)
        if market_returns is not None:
            beta, alpha, r_squared = self.calculate_beta(returns, market_returns)
        else:
            beta, alpha, r_squared = 1.0, 0.0, 0.0

        # VaR and CVaR
        var_95 = self.calculate_var(returns, 0.95)
        var_99 = self.calculate_var(returns, 0.99)
        cvar_95 = self.calculate_cvar(returns, 0.95)

        # Drawdown
        max_dd, dd_duration = self.calculate_max_drawdown(returns)

        # Risk-adjusted returns
        sharpe = self.calculate_sharpe_ratio(returns, risk_free_rate)
        sortino = self.calculate_sortino_ratio(returns, risk_free_rate)
        calmar = self.calculate_calmar_ratio(returns)

        # Distribution moments
        skew = float(stats.skew(returns))
        kurt = float(stats.kurtosis(returns))

        return RiskMetrics(
            volatility=vol,
            downside_volatility=downside_vol,
            beta=beta,
            alpha=alpha,
            r_squared=r_squared,
            var_95=var_95,
            var_99=var_99,
            cvar_95=cvar_95,
            max_drawdown=max_dd,
            max_drawdown_duration=dd_duration,
            sharpe_ratio=sharpe,
            sortino_ratio=sortino,
            calmar_ratio=calmar,
            skewness=skew,
            kurtosis=kurt
        )

    def portfolio_risk_decomposition(
        self,
        weights: np.ndarray,
        returns: pd.DataFrame,
        cov_matrix: np.ndarray,
        tickers: List[str]
    ) -> PortfolioRisk:
        """
        Decompose portfolio risk into contributions from each asset

        Args:
            weights: Portfolio weights
            returns: DataFrame of asset returns
            cov_matrix: Covariance matrix
            tickers: List of ticker symbols

        Returns:
            PortfolioRisk with decomposed risk metrics
        """
        # Portfolio variance
        portfolio_variance = np.dot(weights, np.dot(cov_matrix, weights))
        portfolio_vol = np.sqrt(portfolio_variance)

        # Marginal contribution to risk (MCR)
        # MCR_i = (Σw)_i / σ_p
        marginal_contrib = np.dot(cov_matrix, weights) / portfolio_vol

        # Component contribution to risk (CCR)
        # CCR_i = w_i * MCR_i
        component_contrib = weights * marginal_contrib

        # Percentage contribution
        percent_contrib = component_contrib / portfolio_vol * 100

        marginal_var = {ticker: float(mc) for ticker, mc in zip(tickers, marginal_contrib)}
        component_var = {ticker: float(cc) for ticker, cc in zip(tickers, component_contrib)}
        percent_contribution = {ticker: float(pc) for ticker, pc in zip(tickers, percent_contrib)}

        # Systematic vs idiosyncratic risk (simplified)
        # This would require market model estimation for each asset
        # For now, we'll use portfolio variance as total risk
        systematic_risk = portfolio_vol * 0.7  # Placeholder
        idiosyncratic_risk = portfolio_vol * 0.3  # Placeholder

        return PortfolioRisk(
            total_risk=portfolio_vol,
            systematic_risk=systematic_risk,
            idiosyncratic_risk=idiosyncratic_risk,
            marginal_var=marginal_var,
            component_var=component_var,
            percent_contribution=percent_contribution
        )

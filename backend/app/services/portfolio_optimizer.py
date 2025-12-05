"""Portfolio Optimization Engine using Modern Portfolio Theory"""
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from dataclasses import dataclass
from enum import Enum
import cvxpy as cp
from scipy.optimize import minimize


class OptimizationStrategy(str, Enum):
    """Portfolio optimization strategies"""
    MAX_SHARPE = "max_sharpe"
    MIN_VARIANCE = "min_variance"
    TARGET_RETURN = "target_return"
    RISK_PARITY = "risk_parity"
    DCF_WEIGHTED = "dcf_weighted"
    EQUAL_WEIGHT = "equal_weight"


@dataclass
class PortfolioConstraints:
    """Constraints for portfolio optimization"""
    min_weight: float = 0.0
    max_weight: float = 1.0
    target_return: Optional[float] = None
    allow_short: bool = False
    sum_to_one: bool = True


@dataclass
class PortfolioMetrics:
    """Portfolio performance metrics"""
    weights: np.ndarray
    tickers: List[str]
    expected_return: float
    volatility: float
    sharpe_ratio: float

    # Individual asset contributions
    asset_returns: np.ndarray
    asset_volatilities: np.ndarray

    # Correlation and covariance
    correlation_matrix: Optional[np.ndarray] = None
    covariance_matrix: Optional[np.ndarray] = None


class PortfolioOptimizer:
    """Modern Portfolio Theory optimizer"""

    def __init__(self, risk_free_rate: float = 0.045):
        self.risk_free_rate = risk_free_rate

    @staticmethod
    def calculate_portfolio_metrics(
        weights: np.ndarray,
        expected_returns: np.ndarray,
        cov_matrix: np.ndarray,
        risk_free_rate: float = 0.045
    ) -> Tuple[float, float, float]:
        """Calculate portfolio return, volatility, and Sharpe ratio"""
        portfolio_return = np.dot(weights, expected_returns)
        portfolio_variance = np.dot(weights, np.dot(cov_matrix, weights))
        portfolio_volatility = np.sqrt(portfolio_variance)
        sharpe_ratio = (portfolio_return - risk_free_rate) / portfolio_volatility if portfolio_volatility > 0 else 0.0

        return portfolio_return, portfolio_volatility, sharpe_ratio

    def max_sharpe_optimization(
        self,
        expected_returns: np.ndarray,
        cov_matrix: np.ndarray,
        constraints: PortfolioConstraints
    ) -> np.ndarray:
        """
        Maximize Sharpe Ratio using convex optimization

        We solve: min w^T Σ w (minimize variance)
        subject to: w^T μ = target_return
                   sum(w) = 1
                   w_min <= w <= w_max
        """
        n_assets = len(expected_returns)

        # Use CVXPY for convex optimization
        w = cp.Variable(n_assets)

        # Objective: minimize variance (equivalently maximizes Sharpe for fixed return)
        # We'll do this iteratively to find the max Sharpe
        portfolio_return = expected_returns @ w
        portfolio_variance = cp.quad_form(w, cov_matrix)

        # Constraints
        constraints_list = [cp.sum(w) == 1]

        if not constraints.allow_short:
            constraints_list.append(w >= constraints.min_weight)

        constraints_list.append(w <= constraints.max_weight)

        # Maximize Sharpe = maximize (R - Rf) / σ
        # Equivalent to: max (R - Rf)^2 / σ^2
        # Or we can solve for efficient frontier and pick max Sharpe

        # We'll use a trick: minimize -log(R - Rf) + log(σ)
        # But simpler: maximize expected return for increasing volatility targets

        # Generate efficient frontier
        target_returns = np.linspace(expected_returns.min(), expected_returns.max(), 50)
        sharpe_ratios = []
        optimal_weights_list = []

        for target_ret in target_returns:
            prob_constraints = constraints_list + [portfolio_return >= target_ret]
            prob = cp.Problem(cp.Minimize(portfolio_variance), prob_constraints)

            try:
                prob.solve()
                if w.value is not None:
                    ret, vol, sharpe = self.calculate_portfolio_metrics(
                        w.value, expected_returns, cov_matrix, self.risk_free_rate
                    )
                    sharpe_ratios.append(sharpe)
                    optimal_weights_list.append(w.value.copy())
                else:
                    sharpe_ratios.append(-np.inf)
                    optimal_weights_list.append(None)
            except:
                sharpe_ratios.append(-np.inf)
                optimal_weights_list.append(None)

        # Find max Sharpe
        max_sharpe_idx = np.argmax(sharpe_ratios)
        return optimal_weights_list[max_sharpe_idx]

    def min_variance_optimization(
        self,
        expected_returns: np.ndarray,
        cov_matrix: np.ndarray,
        constraints: PortfolioConstraints
    ) -> np.ndarray:
        """Minimize portfolio variance"""
        n_assets = len(expected_returns)
        w = cp.Variable(n_assets)

        portfolio_variance = cp.quad_form(w, cov_matrix)

        constraints_list = [cp.sum(w) == 1]

        if not constraints.allow_short:
            constraints_list.append(w >= constraints.min_weight)

        constraints_list.append(w <= constraints.max_weight)

        prob = cp.Problem(cp.Minimize(portfolio_variance), constraints_list)
        prob.solve()

        return w.value

    def target_return_optimization(
        self,
        expected_returns: np.ndarray,
        cov_matrix: np.ndarray,
        target_return: float,
        constraints: PortfolioConstraints
    ) -> np.ndarray:
        """Minimize variance for a target return"""
        n_assets = len(expected_returns)
        w = cp.Variable(n_assets)

        portfolio_return = expected_returns @ w
        portfolio_variance = cp.quad_form(w, cov_matrix)

        constraints_list = [
            cp.sum(w) == 1,
            portfolio_return >= target_return
        ]

        if not constraints.allow_short:
            constraints_list.append(w >= constraints.min_weight)

        constraints_list.append(w <= constraints.max_weight)

        prob = cp.Problem(cp.Minimize(portfolio_variance), constraints_list)
        prob.solve()

        return w.value

    def risk_parity_optimization(
        self,
        expected_returns: np.ndarray,
        cov_matrix: np.ndarray,
        constraints: PortfolioConstraints
    ) -> np.ndarray:
        """
        Risk Parity: each asset contributes equally to portfolio risk
        Risk contribution_i = w_i * (Σw)_i / (w^T Σ w)
        """
        n_assets = len(expected_returns)

        def risk_parity_objective(weights):
            portfolio_vol = np.sqrt(np.dot(weights, np.dot(cov_matrix, weights)))
            marginal_contrib = np.dot(cov_matrix, weights)
            risk_contrib = weights * marginal_contrib / portfolio_vol

            # Minimize variance of risk contributions (forces them to be equal)
            return np.var(risk_contrib)

        # Constraints
        cons = [{'type': 'eq', 'fun': lambda w: np.sum(w) - 1}]

        # Bounds
        bounds = [(constraints.min_weight, constraints.max_weight) for _ in range(n_assets)]

        # Initial guess: equal weight
        w0 = np.ones(n_assets) / n_assets

        result = minimize(
            risk_parity_objective,
            w0,
            method='SLSQP',
            bounds=bounds,
            constraints=cons
        )

        return result.x

    def dcf_weighted_optimization(
        self,
        expected_returns: np.ndarray,
        cov_matrix: np.ndarray,
        dcf_upsides: np.ndarray,
        constraints: PortfolioConstraints
    ) -> np.ndarray:
        """
        DCF-weighted: weight assets by their DCF upside potential
        Combines valuation insight with risk management
        """
        # Normalize DCF upsides to positive values
        min_upside = dcf_upsides.min()
        if min_upside < 0:
            dcf_upsides = dcf_upsides - min_upside + 1

        # Create scores combining upside and expected return
        scores = dcf_upsides * (1 + expected_returns)

        # Normalize to weights
        weights = scores / scores.sum()

        # Apply constraints
        weights = np.clip(weights, constraints.min_weight, constraints.max_weight)
        weights = weights / weights.sum()  # Re-normalize

        return weights

    def equal_weight_optimization(
        self,
        n_assets: int,
        constraints: PortfolioConstraints
    ) -> np.ndarray:
        """Simple equal-weight portfolio"""
        weights = np.ones(n_assets) / n_assets
        return weights

    def optimize(
        self,
        tickers: List[str],
        expected_returns: np.ndarray,
        cov_matrix: np.ndarray,
        strategy: OptimizationStrategy,
        constraints: PortfolioConstraints,
        dcf_upsides: Optional[np.ndarray] = None
    ) -> PortfolioMetrics:
        """
        Main optimization interface

        Args:
            tickers: List of asset tickers
            expected_returns: Expected returns for each asset
            cov_matrix: Covariance matrix
            strategy: Optimization strategy to use
            constraints: Portfolio constraints
            dcf_upsides: DCF upside percentages (for DCF_WEIGHTED strategy)

        Returns:
            PortfolioMetrics with optimal weights and performance
        """
        if strategy == OptimizationStrategy.MAX_SHARPE:
            weights = self.max_sharpe_optimization(expected_returns, cov_matrix, constraints)
        elif strategy == OptimizationStrategy.MIN_VARIANCE:
            weights = self.min_variance_optimization(expected_returns, cov_matrix, constraints)
        elif strategy == OptimizationStrategy.TARGET_RETURN:
            if constraints.target_return is None:
                raise ValueError("target_return must be specified for TARGET_RETURN strategy")
            weights = self.target_return_optimization(
                expected_returns, cov_matrix, constraints.target_return, constraints
            )
        elif strategy == OptimizationStrategy.RISK_PARITY:
            weights = self.risk_parity_optimization(expected_returns, cov_matrix, constraints)
        elif strategy == OptimizationStrategy.DCF_WEIGHTED:
            if dcf_upsides is None:
                raise ValueError("dcf_upsides must be provided for DCF_WEIGHTED strategy")
            weights = self.dcf_weighted_optimization(
                expected_returns, cov_matrix, dcf_upsides, constraints
            )
        elif strategy == OptimizationStrategy.EQUAL_WEIGHT:
            weights = self.equal_weight_optimization(len(tickers), constraints)
        else:
            raise ValueError(f"Unknown strategy: {strategy}")

        # Calculate portfolio metrics
        port_return, port_vol, sharpe = self.calculate_portfolio_metrics(
            weights, expected_returns, cov_matrix, self.risk_free_rate
        )

        # Calculate individual asset volatilities
        asset_volatilities = np.sqrt(np.diag(cov_matrix))

        # Calculate correlation matrix
        vol_matrix = np.outer(asset_volatilities, asset_volatilities)
        corr_matrix = cov_matrix / vol_matrix

        return PortfolioMetrics(
            weights=weights,
            tickers=tickers,
            expected_return=port_return,
            volatility=port_vol,
            sharpe_ratio=sharpe,
            asset_returns=expected_returns,
            asset_volatilities=asset_volatilities,
            correlation_matrix=corr_matrix,
            covariance_matrix=cov_matrix
        )

    def efficient_frontier(
        self,
        expected_returns: np.ndarray,
        cov_matrix: np.ndarray,
        constraints: PortfolioConstraints,
        n_points: int = 50
    ) -> pd.DataFrame:
        """
        Generate efficient frontier

        Returns DataFrame with columns: target_return, volatility, sharpe_ratio, weights
        """
        min_ret = expected_returns.min()
        max_ret = expected_returns.max()
        target_returns = np.linspace(min_ret, max_ret, n_points)

        frontier = []

        for target_ret in target_returns:
            try:
                weights = self.target_return_optimization(
                    expected_returns, cov_matrix, target_ret, constraints
                )

                if weights is not None:
                    ret, vol, sharpe = self.calculate_portfolio_metrics(
                        weights, expected_returns, cov_matrix, self.risk_free_rate
                    )

                    frontier.append({
                        'target_return': target_ret,
                        'return': ret,
                        'volatility': vol,
                        'sharpe_ratio': sharpe,
                        'weights': weights.tolist()
                    })
            except:
                continue

        return pd.DataFrame(frontier)

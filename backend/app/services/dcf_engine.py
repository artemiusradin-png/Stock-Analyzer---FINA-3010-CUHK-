"""Enhanced DCF Valuation Engine with Multi-Scenario & Sensitivity Analysis"""
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from dataclasses import dataclass
from enum import Enum


class ScenarioType(str, Enum):
    """DCF scenario types"""
    BASE = "base"
    BULL = "bull"
    BEAR = "bear"
    OPTIMISTIC = "optimistic"
    PESSIMISTIC = "pessimistic"


@dataclass
class DCFInputs:
    """Input parameters for DCF valuation"""
    # Starting values
    revenue_start: float
    revenue_growth_start: float
    ebit_margin_start: float
    dna_ratio_start: float
    capex_ratio_start: float
    nwc_ratio_start: float
    tax_rate_start: float
    nwc_level: float

    # Terminal values
    revenue_growth_terminal: float
    ebit_margin_terminal: float
    dna_ratio_terminal: float
    capex_ratio_terminal: float
    nwc_ratio_terminal: float
    tax_rate_terminal: float

    # Discount rate components
    risk_free_rate: float
    erp: float
    beta: float
    cost_of_debt: float
    debt: float
    equity: float
    tax_rate: float

    # Valuation parameters
    forecast_period: int = 10
    terminal_growth: float = 0.025
    manual_wacc: Optional[float] = None

    # Capital structure
    shares_outstanding: float = 0.0
    cash: float = 0.0


@dataclass
class DCFOutputs:
    """Output results from DCF valuation"""
    enterprise_value: float
    equity_value: float
    implied_price: float
    current_price: float
    upside_downside: float

    terminal_value: float
    pv_terminal: float

    wacc: float
    cost_of_equity: float
    levered_beta: float
    unlevered_beta: float

    projections: pd.DataFrame
    sensitivity_data: Optional[Dict] = None


class DCFEngine:
    """Enhanced DCF valuation engine"""

    @staticmethod
    def calculate_wacc(
        unlevered_beta: float,
        debt: float,
        equity: float,
        tax_rate: float,
        rf_rate: float,
        erp: float,
        cost_of_debt: float,
        years: int,
        manual_wacc: Optional[float] = None
    ) -> Tuple[pd.Series, float, float]:
        """
        Calculate WACC using proper methodology:
        WACC = (E/V * Re) + (D/V * Rd * (1-T))
        """
        if equity <= 0:
            equity = 1.0
        if debt < 0:
            debt = 0.0

        total_capital = equity + debt
        equity_weight = equity / total_capital
        debt_weight = debt / total_capital

        # Levered beta: βL = βU * (1 + (1-T) * (D/E))
        levered_beta = unlevered_beta * (1 + (1 - tax_rate) * (debt / equity))

        # Cost of Equity (CAPM): Re = Rf + βL * ERP
        cost_of_equity = rf_rate + levered_beta * erp

        # After-tax cost of debt
        after_tax_cost_of_debt = cost_of_debt * (1 - tax_rate)

        if manual_wacc is not None:
            wacc_series = pd.Series([manual_wacc] * years)
        else:
            # WACC = (E/V * Re) + (D/V * Rd * (1-T))
            wacc = equity_weight * cost_of_equity + debt_weight * after_tax_cost_of_debt
            wacc_series = pd.Series([wacc] * years)

        return wacc_series, cost_of_equity, levered_beta

    @staticmethod
    def build_projections(
        inputs: DCFInputs,
        wacc: pd.Series
    ) -> pd.DataFrame:
        """Build detailed projection table"""
        years = inputs.forecast_period
        df = pd.DataFrame(index=range(1, years + 1))

        # Linear interpolation from start to terminal values
        df["rev_growth"] = np.linspace(
            inputs.revenue_growth_start,
            inputs.revenue_growth_terminal,
            years
        )
        df["ebit_margin"] = np.linspace(
            inputs.ebit_margin_start,
            inputs.ebit_margin_terminal,
            years
        )
        df["dna_ratio"] = np.linspace(
            inputs.dna_ratio_start,
            inputs.dna_ratio_terminal,
            years
        )
        df["capex_ratio"] = np.linspace(
            inputs.capex_ratio_start,
            inputs.capex_ratio_terminal,
            years
        )
        df["tax_rate"] = np.linspace(
            inputs.tax_rate_start,
            inputs.tax_rate_terminal,
            years
        )
        df["nwc_ratio"] = np.linspace(
            inputs.nwc_ratio_start,
            inputs.nwc_ratio_terminal,
            years
        )

        # Revenue projection
        df["revenue"] = inputs.revenue_start * (1 + df["rev_growth"]).cumprod()

        # EBIT and tax
        df["ebit"] = df["revenue"] * df["ebit_margin"]
        df["tax"] = df["ebit"] * df["tax_rate"]
        df["nopat"] = df["ebit"] - df["tax"]

        # Depreciation & Amortization
        df["dna"] = df["revenue"] * df["dna_ratio"]

        # Capital expenditures
        df["capex"] = df["revenue"] * df["capex_ratio"]

        # Net working capital
        df["nwc"] = df["revenue"] * df["nwc_ratio"]
        df["delta_nwc"] = df["nwc"].diff().fillna(df["nwc"].iloc[0] - inputs.nwc_level)

        # Free Cash Flow = NOPAT + D&A - CapEx - ΔNWC
        df["fcf"] = df["nopat"] + df["dna"] - df["capex"] - df["delta_nwc"]

        # Present value of FCF
        discount_factors = np.cumprod(1 + wacc.values)
        df["pv_fcf"] = df["fcf"].values / discount_factors

        return df

    @staticmethod
    def calculate_terminal_value(
        terminal_fcf: float,
        terminal_growth: float,
        terminal_wacc: float,
        periods: int,
        wacc_series: pd.Series
    ) -> Tuple[float, float]:
        """Calculate terminal value and its present value"""
        # Terminal Value = FCF_n+1 / (WACC - g)
        # FCF_n+1 = FCF_n * (1 + g)
        fcf_n_plus_1 = terminal_fcf * (1 + terminal_growth)
        terminal_value = fcf_n_plus_1 / (terminal_wacc - terminal_growth)

        # Discount to present value
        pv_terminal = terminal_value / np.prod(1 + wacc_series.values)

        return terminal_value, pv_terminal

    def perform_dcf(self, inputs: DCFInputs, current_price: float = 0.0) -> DCFOutputs:
        """Perform complete DCF valuation"""
        # Calculate unlevered beta
        unlevered_beta = inputs.beta / (
            1 + (1 - inputs.tax_rate) * (inputs.debt / inputs.equity)
        ) if inputs.equity > 0 else inputs.beta

        # Calculate WACC
        wacc_series, cost_of_equity, levered_beta = self.calculate_wacc(
            unlevered_beta=unlevered_beta,
            debt=inputs.debt,
            equity=inputs.equity,
            tax_rate=inputs.tax_rate,
            rf_rate=inputs.risk_free_rate,
            erp=inputs.erp,
            cost_of_debt=inputs.cost_of_debt,
            years=inputs.forecast_period,
            manual_wacc=inputs.manual_wacc
        )

        # Build projections
        projections = self.build_projections(inputs, wacc_series)

        # Terminal value
        terminal_fcf = projections["fcf"].iloc[-1]
        terminal_wacc = wacc_series.iloc[-1]
        terminal_value, pv_terminal = self.calculate_terminal_value(
            terminal_fcf=terminal_fcf,
            terminal_growth=inputs.terminal_growth,
            terminal_wacc=terminal_wacc,
            periods=inputs.forecast_period,
            wacc_series=wacc_series
        )

        # Enterprise and equity value
        pv_fcf_sum = projections["pv_fcf"].sum()
        enterprise_value = pv_fcf_sum + pv_terminal
        equity_value = enterprise_value - inputs.debt + inputs.cash

        # Implied price per share
        implied_price = equity_value / inputs.shares_outstanding if inputs.shares_outstanding > 0 else 0.0
        upside = ((implied_price - current_price) / current_price * 100) if current_price > 0 else 0.0

        return DCFOutputs(
            enterprise_value=enterprise_value,
            equity_value=equity_value,
            implied_price=implied_price,
            current_price=current_price,
            upside_downside=upside,
            terminal_value=terminal_value,
            pv_terminal=pv_terminal,
            wacc=terminal_wacc,
            cost_of_equity=cost_of_equity,
            levered_beta=levered_beta,
            unlevered_beta=unlevered_beta,
            projections=projections
        )

    def multi_scenario_analysis(
        self,
        base_inputs: DCFInputs,
        current_price: float = 0.0
    ) -> Dict[str, DCFOutputs]:
        """Perform multi-scenario DCF analysis (Base, Bull, Bear)"""
        scenarios = {}

        # Base case
        scenarios[ScenarioType.BASE] = self.perform_dcf(base_inputs, current_price)

        # Bull case: Higher growth, better margins
        bull_inputs = DCFInputs(**base_inputs.__dict__)
        bull_inputs.revenue_growth_start *= 1.3
        bull_inputs.revenue_growth_terminal *= 1.2
        bull_inputs.ebit_margin_start *= 1.1
        bull_inputs.ebit_margin_terminal *= 1.1
        bull_inputs.terminal_growth = min(0.03, base_inputs.terminal_growth * 1.2)
        scenarios[ScenarioType.BULL] = self.perform_dcf(bull_inputs, current_price)

        # Bear case: Lower growth, compressed margins
        bear_inputs = DCFInputs(**base_inputs.__dict__)
        bear_inputs.revenue_growth_start *= 0.6
        bear_inputs.revenue_growth_terminal *= 0.7
        bear_inputs.ebit_margin_start *= 0.9
        bear_inputs.ebit_margin_terminal *= 0.9
        bear_inputs.terminal_growth = max(0.015, base_inputs.terminal_growth * 0.7)
        scenarios[ScenarioType.BEAR] = self.perform_dcf(bear_inputs, current_price)

        return scenarios

    def sensitivity_analysis(
        self,
        base_inputs: DCFInputs,
        wacc_range: Tuple[float, float] = (0.06, 0.18),
        tgr_range: Tuple[float, float] = (0.01, 0.04),
        grid_size: int = 25
    ) -> Dict:
        """
        Perform 2D sensitivity analysis: WACC vs Terminal Growth Rate
        Returns a grid of implied prices
        """
        # First get base case for PV of projected FCFs
        base_output = self.perform_dcf(base_inputs)
        pv_fcf_sum = base_output.projections["pv_fcf"].sum()
        terminal_fcf = base_output.projections["fcf"].iloc[-1]

        wacc_low, wacc_high = wacc_range
        tgr_low, tgr_high = tgr_range

        waccs = np.linspace(wacc_low, wacc_high, grid_size)
        tgrs = np.linspace(tgr_low, tgr_high, grid_size)

        surface = []
        for tgr in tgrs:
            row = []
            for wacc in waccs:
                if wacc <= tgr:
                    row.append(0.0)
                    continue

                # Calculate terminal value with this WACC and TGR
                fcf_n_plus_1 = terminal_fcf * (1 + tgr)
                tv = fcf_n_plus_1 / (wacc - tgr)
                pv_tv = tv / ((1 + wacc) ** base_inputs.forecast_period)

                # Enterprise and equity value
                ev = pv_fcf_sum + pv_tv
                equity_val = ev - base_inputs.debt + base_inputs.cash
                price = equity_val / base_inputs.shares_outstanding if base_inputs.shares_outstanding > 0 else 0.0

                row.append(float(price))
            surface.append(row)

        return {
            "waccs": waccs.tolist(),
            "tgrs": tgrs.tolist(),
            "price_surface": surface,
            "base_wacc": base_output.wacc,
            "base_tgr": base_inputs.terminal_growth,
            "base_price": base_output.implied_price
        }

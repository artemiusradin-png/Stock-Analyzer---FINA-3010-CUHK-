// DCF Engine - TypeScript implementation

export interface DCFInputs {
  revenue_start: number;
  revenue_growth_start: number;
  ebit_margin_start: number;
  dna_ratio_start: number;
  capex_ratio_start: number;
  nwc_ratio_start: number;
  tax_rate_start: number;
  nwc_level: number;
  revenue_growth_terminal: number;
  ebit_margin_terminal: number;
  dna_ratio_terminal: number;
  capex_ratio_terminal: number;
  nwc_ratio_terminal: number;
  tax_rate_terminal: number;
  risk_free_rate: number;
  erp: number;
  beta: number;
  cost_of_debt: number;
  debt: number;
  equity: number;
  tax_rate: number;
  forecast_period: number;
  terminal_growth: number;
  manual_wacc?: number;
  shares_outstanding: number;
  cash: number;
}

export interface ProjectionYear {
  year: number;
  revenue: number;
  rev_growth: number;
  ebit: number;
  ebit_margin: number;
  tax: number;
  nopat: number;
  dna: number;
  capex: number;
  nwc: number;
  delta_nwc: number;
  fcf: number;
  pv_fcf: number;
  tax_rate: number;
}

export interface DCFOutputs {
  enterprise_value: number;
  equity_value: number;
  implied_price: number;
  current_price: number;
  upside_downside: number;
  terminal_value: number;
  pv_terminal: number;
  wacc: number;
  cost_of_equity: number;
  levered_beta: number;
  unlevered_beta: number;
  projections: ProjectionYear[];
}

export class DCFEngine {
  static calculateWACC(
    unleveredBeta: number,
    debt: number,
    equity: number,
    taxRate: number,
    rfRate: number,
    erp: number,
    costOfDebt: number,
    years: number,
    manualWacc?: number
  ): { waccSeries: number[]; costOfEquity: number; leveredBeta: number } {
    if (equity <= 0) equity = 1.0;
    if (debt < 0) debt = 0.0;

    const totalCapital = equity + debt;
    const equityWeight = equity / totalCapital;
    const debtWeight = debt / totalCapital;

    // Levered beta: βL = βU * (1 + (1-T) * (D/E))
    const leveredBeta = unleveredBeta * (1 + (1 - taxRate) * (debt / equity));

    // Cost of Equity (CAPM): Re = Rf + βL * ERP
    const costOfEquity = rfRate + leveredBeta * erp;

    // After-tax cost of debt
    const afterTaxCostOfDebt = costOfDebt * (1 - taxRate);

    let wacc: number;
    if (manualWacc !== undefined) {
      wacc = manualWacc;
    } else {
      // WACC = (E/V * Re) + (D/V * Rd * (1-T))
      wacc = equityWeight * costOfEquity + debtWeight * afterTaxCostOfDebt;
    }

    const waccSeries = Array(years).fill(wacc);
    return { waccSeries, costOfEquity, leveredBeta };
  }

  static buildProjections(inputs: DCFInputs, waccSeries: number[]): ProjectionYear[] {
    const years = inputs.forecast_period;
    const projections: ProjectionYear[] = [];

    // Linear interpolation helper
    const linspace = (start: number, end: number, count: number): number[] => {
      const result: number[] = [];
      for (let i = 0; i < count; i++) {
        result.push(start + ((end - start) * i) / (count - 1));
      }
      return result;
    };

    const revGrowths = linspace(inputs.revenue_growth_start, inputs.revenue_growth_terminal, years);
    const ebitMargins = linspace(inputs.ebit_margin_start, inputs.ebit_margin_terminal, years);
    const dnaRatios = linspace(inputs.dna_ratio_start, inputs.dna_ratio_terminal, years);
    const capexRatios = linspace(inputs.capex_ratio_start, inputs.capex_ratio_terminal, years);
    const taxRates = linspace(inputs.tax_rate_start, inputs.tax_rate_terminal, years);
    const nwcRatios = linspace(inputs.nwc_ratio_start, inputs.nwc_ratio_terminal, years);

    let revenue = inputs.revenue_start;
    let previousNWC = inputs.nwc_level;

    for (let year = 1; year <= years; year++) {
      const idx = year - 1;
      const revGrowth = revGrowths[idx];
      const ebitMargin = ebitMargins[idx];
      const dnaRatio = dnaRatios[idx];
      const capexRatio = capexRatios[idx];
      const taxRate = taxRates[idx];
      const nwcRatio = nwcRatios[idx];

      // Revenue projection
      revenue = revenue * (1 + revGrowth);

      // EBIT and tax
      const ebit = revenue * ebitMargin;
      const tax = ebit * taxRate;
      const nopat = ebit - tax;

      // Depreciation & Amortization
      const dna = revenue * dnaRatio;

      // Capital expenditures
      const capex = revenue * capexRatio;

      // Net working capital
      const nwc = revenue * nwcRatio;
      const deltaNWC = year === 1 ? nwc - previousNWC : nwc - previousNWC;
      previousNWC = nwc;

      // Free Cash Flow = NOPAT + D&A - CapEx - ΔNWC
      const fcf = nopat + dna - capex - deltaNWC;

      // Present value of FCF
      let discountFactor = 1;
      for (let i = 0; i < year; i++) {
        discountFactor *= 1 + waccSeries[i];
      }
      const pvFcf = fcf / discountFactor;

      projections.push({
        year,
        revenue,
        rev_growth: revGrowth,
        ebit,
        ebit_margin: ebitMargin,
        tax,
        nopat,
        dna,
        capex,
        nwc,
        delta_nwc: deltaNWC,
        fcf,
        pv_fcf: pvFcf,
        tax_rate: taxRate,
      });
    }

    return projections;
  }

  static calculateTerminalValue(
    terminalFcf: number,
    terminalGrowth: number,
    terminalWacc: number,
    periods: number,
    waccSeries: number[]
  ): { terminalValue: number; pvTerminal: number } {
    // Terminal Value = FCF_n+1 / (WACC - g)
    // FCF_n+1 = FCF_n * (1 + g)
    const fcfNPlus1 = terminalFcf * (1 + terminalGrowth);
    const terminalValue = fcfNPlus1 / (terminalWacc - terminalGrowth);

    // Discount to present value
    let discountFactor = 1;
    for (const wacc of waccSeries) {
      discountFactor *= 1 + wacc;
    }
    const pvTerminal = terminalValue / discountFactor;

    return { terminalValue, pvTerminal };
  }

  static performDCF(inputs: DCFInputs, currentPrice: number = 0.0): DCFOutputs {
    // Calculate unlevered beta
    const unleveredBeta =
      inputs.equity > 0
        ? inputs.beta / (1 + (1 - inputs.tax_rate) * (inputs.debt / inputs.equity))
        : inputs.beta;

    // Calculate WACC
    const { waccSeries, costOfEquity, leveredBeta } = this.calculateWACC(
      unleveredBeta,
      inputs.debt,
      inputs.equity,
      inputs.tax_rate,
      inputs.risk_free_rate,
      inputs.erp,
      inputs.cost_of_debt,
      inputs.forecast_period,
      inputs.manual_wacc
    );

    // Build projections
    const projections = this.buildProjections(inputs, waccSeries);

    // Terminal value
    const terminalFcf = projections[projections.length - 1].fcf;
    const terminalWacc = waccSeries[waccSeries.length - 1];
    const { terminalValue, pvTerminal } = this.calculateTerminalValue(
      terminalFcf,
      inputs.terminal_growth,
      terminalWacc,
      inputs.forecast_period,
      waccSeries
    );

    // Enterprise and equity value
    const pvFcfSum = projections.reduce((sum, p) => sum + p.pv_fcf, 0);
    const enterpriseValue = pvFcfSum + pvTerminal;
    const equityValue = enterpriseValue - inputs.debt + inputs.cash;

    // Implied price per share
    const impliedPrice =
      inputs.shares_outstanding > 0 ? equityValue / inputs.shares_outstanding : 0.0;
    const upside =
      currentPrice > 0 ? ((impliedPrice - currentPrice) / currentPrice) * 100 : 0.0;

    return {
      enterprise_value: enterpriseValue,
      equity_value: equityValue,
      implied_price: impliedPrice,
      current_price: currentPrice,
      upside_downside: upside,
      terminal_value: terminalValue,
      pv_terminal: pvTerminal,
      wacc: terminalWacc,
      cost_of_equity: costOfEquity,
      levered_beta: leveredBeta,
      unlevered_beta: unleveredBeta,
      projections,
    };
  }

  static multiScenarioAnalysis(
    baseInputs: DCFInputs,
    currentPrice: number = 0.0
  ): { base: DCFOutputs; bull: DCFOutputs; bear: DCFOutputs } {
    // Base case
    const base = this.performDCF(baseInputs, currentPrice);

    // Bull case
    const bullInputs: DCFInputs = {
      ...baseInputs,
      revenue_growth_start: baseInputs.revenue_growth_start * 1.3,
      revenue_growth_terminal: baseInputs.revenue_growth_terminal * 1.2,
      ebit_margin_start: baseInputs.ebit_margin_start * 1.1,
      ebit_margin_terminal: baseInputs.ebit_margin_terminal * 1.1,
      terminal_growth: Math.min(0.03, baseInputs.terminal_growth * 1.2),
    };
    const bull = this.performDCF(bullInputs, currentPrice);

    // Bear case
    const bearInputs: DCFInputs = {
      ...baseInputs,
      revenue_growth_start: baseInputs.revenue_growth_start * 0.6,
      revenue_growth_terminal: baseInputs.revenue_growth_terminal * 0.7,
      ebit_margin_start: baseInputs.ebit_margin_start * 0.9,
      ebit_margin_terminal: baseInputs.ebit_margin_terminal * 0.9,
      terminal_growth: Math.max(0.015, baseInputs.terminal_growth * 0.7),
    };
    const bear = this.performDCF(bearInputs, currentPrice);

    return { base, bull, bear };
  }

  static sensitivityAnalysis(
    baseInputs: DCFInputs,
    waccRange: [number, number] = [0.06, 0.18],
    tgrRange: [number, number] = [0.01, 0.04],
    gridSize: number = 25
  ): {
    waccs: number[];
    tgrs: number[];
    price_surface: number[][];
    base_wacc: number;
    base_tgr: number;
    base_price: number;
  } {
    const baseOutput = this.performDCF(baseInputs);
    const pvFcfSum = baseOutput.projections.reduce((sum, p) => sum + p.pv_fcf, 0);
    const terminalFcf = baseOutput.projections[baseOutput.projections.length - 1].fcf;

    const [waccLow, waccHigh] = waccRange;
    const [tgrLow, tgrHigh] = tgrRange;

    const waccs: number[] = [];
    const tgrs: number[] = [];
    for (let i = 0; i < gridSize; i++) {
      waccs.push(waccLow + ((waccHigh - waccLow) * i) / (gridSize - 1));
      tgrs.push(tgrLow + ((tgrHigh - tgrLow) * i) / (gridSize - 1));
    }

    const surface: number[][] = [];
    for (const tgr of tgrs) {
      const row: number[] = [];
      for (const wacc of waccs) {
        if (wacc <= tgr) {
          row.push(0.0);
          continue;
        }

        // Calculate terminal value with this WACC and TGR
        const fcfNPlus1 = terminalFcf * (1 + tgr);
        const tv = fcfNPlus1 / (wacc - tgr);
        const pvTv = tv / Math.pow(1 + wacc, baseInputs.forecast_period);

        // Enterprise and equity value
        const ev = pvFcfSum + pvTv;
        const equityVal = ev - baseInputs.debt + baseInputs.cash;
        const price =
          baseInputs.shares_outstanding > 0 ? equityVal / baseInputs.shares_outstanding : 0.0;

        row.push(price);
      }
      surface.push(row);
    }

    return {
      waccs,
      tgrs,
      price_surface: surface,
      base_wacc: baseOutput.wacc,
      base_tgr: baseInputs.terminal_growth,
      base_price: baseOutput.implied_price,
    };
  }
}

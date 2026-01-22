// Risk Analytics Engine - TypeScript implementation

export interface RiskMetrics {
  returns: {
    total_return: number;
    annualized_return: number;
    monthly_returns: number[];
  };
  volatility: {
    annualized_vol: number;
    monthly_vol: number;
    downside_vol: number;
  };
  drawdown: {
    max_drawdown: number;
    max_drawdown_duration: number;
    current_drawdown: number;
    drawdown_series: { date: string; value: number }[];
  };
  beta: {
    current_beta: number;
    rolling_beta: { date: string; beta: number }[];
  };
  correlation: {
    market_correlation: number;
    rolling_correlation: { date: string; correlation: number }[];
  };
  var: {
    var_95: number;
    var_99: number;
    cvar_95: number;
    cvar_99: number;
  };
}

export interface RiskInputs {
  prices: number[];
  marketPrices: number[]; // For beta/correlation calculation
  dates: string[];
  riskFreeRate?: number;
  lookbackDays?: number;
}

export class RiskAnalytics {
  static calculateReturns(prices: number[]): {
    total_return: number;
    annualized_return: number;
    monthly_returns: number[];
  } {
    if (prices.length < 2) {
      return { total_return: 0, annualized_return: 0, monthly_returns: [] };
    }

    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const totalReturn = (prices[prices.length - 1] - prices[0]) / prices[0];
    const years = prices.length / 252; // Approximate trading days per year
    const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;

    return {
      total_return: totalReturn,
      annualized_return: annualizedReturn,
      monthly_returns: returns,
    };
  }

  static calculateVolatility(returns: number[]): {
    annualized_vol: number;
    monthly_vol: number;
    downside_vol: number;
  } {
    if (returns.length === 0) {
      return { annualized_vol: 0, monthly_vol: 0, downside_vol: 0 };
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const annualizedVol = stdDev * Math.sqrt(252); // Annualize

    // Downside volatility (only negative returns)
    const downsideReturns = returns.filter(r => r < 0);
    const downsideMean = downsideReturns.length > 0
      ? downsideReturns.reduce((a, b) => a + b, 0) / downsideReturns.length
      : 0;
    const downsideVariance = downsideReturns.length > 0
      ? downsideReturns.reduce((sum, r) => sum + Math.pow(r - downsideMean, 2), 0) / downsideReturns.length
      : 0;
    const downsideVol = Math.sqrt(downsideVariance) * Math.sqrt(252);

    return {
      annualized_vol: annualizedVol,
      monthly_vol: stdDev,
      downside_vol: downsideVol,
    };
  }

  static calculateDrawdown(prices: number[]): {
    max_drawdown: number;
    max_drawdown_duration: number;
    current_drawdown: number;
    drawdown_series: { date: string; value: number }[];
  } {
    if (prices.length === 0) {
      return {
        max_drawdown: 0,
        max_drawdown_duration: 0,
        current_drawdown: 0,
        drawdown_series: [],
      };
    }

    let maxPrice = prices[0];
    let maxDrawdown = 0;
    let maxDrawdownDuration = 0;
    let currentDrawdownDuration = 0;
    const drawdownSeries: { date: string; value: number }[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (prices[i] > maxPrice) {
        maxPrice = prices[i];
        currentDrawdownDuration = 0;
      } else {
        currentDrawdownDuration++;
        maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownDuration);
      }

      const drawdown = (maxPrice - prices[i]) / maxPrice;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      drawdownSeries.push({ date: `Day ${i}`, value: drawdown });
    }

    const currentDrawdown = (maxPrice - prices[prices.length - 1]) / maxPrice;

    return {
      max_drawdown: maxDrawdown,
      max_drawdown_duration: maxDrawdownDuration,
      current_drawdown: currentDrawdown,
      drawdown_series: drawdownSeries,
    };
  }

  static calculateBeta(
    stockReturns: number[],
    marketReturns: number[],
    window: number = 60
  ): {
    current_beta: number;
    rolling_beta: { date: string; beta: number }[];
  } {
    if (stockReturns.length !== marketReturns.length || stockReturns.length < window) {
      return { current_beta: 1.0, rolling_beta: [] };
    }

    // Calculate current beta using entire period
    const stockMean = stockReturns.reduce((a, b) => a + b, 0) / stockReturns.length;
    const marketMean = marketReturns.reduce((a, b) => a + b, 0) / marketReturns.length;

    let covariance = 0;
    let marketVariance = 0;

    for (let i = 0; i < stockReturns.length; i++) {
      covariance += (stockReturns[i] - stockMean) * (marketReturns[i] - marketMean);
      marketVariance += Math.pow(marketReturns[i] - marketMean, 2);
    }

    const currentBeta = marketVariance > 0 ? covariance / marketVariance : 1.0;

    // Calculate rolling beta
    const rollingBeta: { date: string; beta: number }[] = [];
    for (let i = window; i <= stockReturns.length; i++) {
      const windowStockReturns = stockReturns.slice(i - window, i);
      const windowMarketReturns = marketReturns.slice(i - window, i);

      const wsMean = windowStockReturns.reduce((a, b) => a + b, 0) / windowStockReturns.length;
      const wmMean = windowMarketReturns.reduce((a, b) => a + b, 0) / windowMarketReturns.length;

      let cov = 0;
      let mv = 0;
      for (let j = 0; j < windowStockReturns.length; j++) {
        cov += (windowStockReturns[j] - wsMean) * (windowMarketReturns[j] - wmMean);
        mv += Math.pow(windowMarketReturns[j] - wmMean, 2);
      }

      const beta = mv > 0 ? cov / mv : 1.0;
      rollingBeta.push({ date: `Day ${i}`, beta });
    }

    return { current_beta: currentBeta, rolling_beta: rollingBeta };
  }

  static calculateCorrelation(
    stockReturns: number[],
    marketReturns: number[],
    window: number = 60
  ): {
    market_correlation: number;
    rolling_correlation: { date: string; correlation: number }[];
  } {
    if (stockReturns.length !== marketReturns.length || stockReturns.length < 2) {
      return { market_correlation: 0, rolling_correlation: [] };
    }

    // Calculate overall correlation
    const stockMean = stockReturns.reduce((a, b) => a + b, 0) / stockReturns.length;
    const marketMean = marketReturns.reduce((a, b) => a + b, 0) / marketReturns.length;

    let covariance = 0;
    let stockStd = 0;
    let marketStd = 0;

    for (let i = 0; i < stockReturns.length; i++) {
      const sDiff = stockReturns[i] - stockMean;
      const mDiff = marketReturns[i] - marketMean;
      covariance += sDiff * mDiff;
      stockStd += sDiff * sDiff;
      marketStd += mDiff * mDiff;
    }

    const correlation = Math.sqrt(stockStd * marketStd) > 0
      ? covariance / Math.sqrt(stockStd * marketStd)
      : 0;

    // Rolling correlation
    const rollingCorr: { date: string; correlation: number }[] = [];
    for (let i = window; i <= stockReturns.length; i++) {
      const windowStockReturns = stockReturns.slice(i - window, i);
      const windowMarketReturns = marketReturns.slice(i - window, i);

      const wsMean = windowStockReturns.reduce((a, b) => a + b, 0) / windowStockReturns.length;
      const wmMean = windowMarketReturns.reduce((a, b) => a + b, 0) / windowMarketReturns.length;

      let cov = 0;
      let ss = 0;
      let ms = 0;
      for (let j = 0; j < windowStockReturns.length; j++) {
        const sDiff = windowStockReturns[j] - wsMean;
        const mDiff = windowMarketReturns[j] - wmMean;
        cov += sDiff * mDiff;
        ss += sDiff * sDiff;
        ms += mDiff * mDiff;
      }

      const corr = Math.sqrt(ss * ms) > 0 ? cov / Math.sqrt(ss * ms) : 0;
      rollingCorr.push({ date: `Day ${i}`, correlation: corr });
    }

    return { market_correlation: correlation, rolling_correlation: rollingCorr };
  }

  static calculateVaR(
    returns: number[],
    confidenceLevel: number = 0.95
  ): {
    var_95: number;
    var_99: number;
    cvar_95: number;
    cvar_99: number;
  } {
    if (returns.length === 0) {
      return { var_95: 0, var_99: 0, cvar_95: 0, cvar_99: 0 };
    }

    const sortedReturns = [...returns].sort((a, b) => a - b);

    // VaR is the negative of the percentile return
    const var95Index = Math.floor((1 - 0.95) * sortedReturns.length);
    const var99Index = Math.floor((1 - 0.99) * sortedReturns.length);

    const var95 = -sortedReturns[var95Index] || 0;
    const var99 = -sortedReturns[var99Index] || 0;

    // CVaR (Conditional VaR) is the mean of returns below VaR threshold
    const cvar95Returns = sortedReturns.slice(0, var95Index + 1);
    const cvar99Returns = sortedReturns.slice(0, var99Index + 1);

    const cvar95 = cvar95Returns.length > 0
      ? -cvar95Returns.reduce((a, b) => a + b, 0) / cvar95Returns.length
      : 0;
    const cvar99 = cvar99Returns.length > 0
      ? -cvar99Returns.reduce((a, b) => a + b, 0) / cvar99Returns.length
      : 0;

    return { var_95: var95, var_99: var99, cvar_95: cvar95, cvar_99: cvar99 };
  }

  static analyzeRisk(inputs: RiskInputs): RiskMetrics {
    const returns = this.calculateReturns(inputs.prices);
    const volatility = this.calculateVolatility(returns.monthly_returns);
    const drawdown = this.calculateDrawdown(inputs.prices);

    // Calculate stock and market returns for beta/correlation
    const stockReturns: number[] = [];
    const marketReturns: number[] = [];
    
    for (let i = 1; i < inputs.prices.length; i++) {
      stockReturns.push((inputs.prices[i] - inputs.prices[i - 1]) / inputs.prices[i - 1]);
    }
    
    for (let i = 1; i < inputs.marketPrices.length; i++) {
      marketReturns.push((inputs.marketPrices[i] - inputs.marketPrices[i - 1]) / inputs.marketPrices[i - 1]);
    }

    const beta = this.calculateBeta(stockReturns, marketReturns, inputs.lookbackDays);
    const correlation = this.calculateCorrelation(stockReturns, marketReturns, inputs.lookbackDays);
    const varMetrics = this.calculateVaR(returns.monthly_returns);

    return {
      returns,
      volatility,
      drawdown,
      beta,
      correlation,
      var: varMetrics,
    };
  }
}

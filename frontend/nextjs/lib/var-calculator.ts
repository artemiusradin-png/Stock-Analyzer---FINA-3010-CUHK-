// Value at Risk (VaR) Calculator
// Supports Historical, Parametric, and Monte Carlo methods

import { FinnhubService } from './finnhub-service';

export type VaRMethod = 'historical' | 'parametric' | 'monte_carlo';
export type ConfidenceLevel = 0.95 | 0.99 | 0.90;

export interface Position {
  ticker: string;
  quantity: number;
  price: number;
  value: number;
}

export interface VaRResult {
  var_amount: number;
  var_percentage: number;
  cvar_amount: number;
  cvar_percentage: number;
  confidence_level: number;
  time_horizon: number;
  method: VaRMethod;
  component_var?: ComponentVaR[];
  portfolio_value: number;
}

export interface ComponentVaR {
  ticker: string;
  var_amount: number;
  var_percentage: number;
  contribution_pct: number;
}

export class VaRCalculator {
  private portfolio: Position[];
  private confidenceLevel: ConfidenceLevel;
  private timeHorizon: number;
  private historicalDays: number;
  private finnhubService: FinnhubService;

  constructor(
    portfolio: Position[],
    confidenceLevel: ConfidenceLevel = 0.95,
    timeHorizon: number = 1,
    historicalDays: number = 252
  ) {
    this.portfolio = portfolio;
    this.confidenceLevel = confidenceLevel;
    this.timeHorizon = timeHorizon;
    this.historicalDays = historicalDays;
    this.finnhubService = new FinnhubService();
  }

  /**
   * Calculate VaR using specified method
   */
  async calculateVaR(method: VaRMethod = 'historical'): Promise<VaRResult> {
    const totalValue = this.portfolio.reduce((sum, p) => sum + p.value, 0);
    
    if (totalValue === 0 || this.portfolio.length === 0) {
      return this.emptyResult(method, totalValue);
    }

    switch (method) {
      case 'historical':
        return await this.historicalVaR();
      case 'parametric':
        return await this.parametricVaR();
      case 'monte_carlo':
        return await this.monteCarloVaR();
      default:
        return await this.historicalVaR();
    }
  }

  /**
   * Historical VaR - uses actual historical returns
   */
  private async historicalVaR(): Promise<VaRResult> {
    try {
      // Get historical prices for all positions
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - this.historicalDays);

      // Fetch historical prices for all tickers in parallel
      const pricePromises = this.portfolio.map(async (pos) => {
        try {
          const prices = await this.finnhubService.getHistoricalPrices(
            pos.ticker,
            startDate,
            endDate,
            'D'
          );
          return { ticker: pos.ticker, prices };
        } catch (error) {
          console.warn(`Failed to fetch prices for ${pos.ticker}:`, error);
          return { ticker: pos.ticker, prices: [] };
        }
      });

      const priceData = await Promise.all(pricePromises);
      
      // Filter out tickers with insufficient data
      const validData = priceData.filter(d => d.prices.length >= 20);
      if (validData.length === 0) {
        return this.emptyResult('historical', this.getTotalValue());
      }

      // Calculate daily returns for each ticker
      const returnsByTicker: { [ticker: string]: number[] } = {};
      const dates: Date[] = [];
      
      for (const { ticker, prices } of validData) {
        if (prices.length === 0) continue;
        
        const tickerReturns: number[] = [];
        for (let i = 1; i < prices.length; i++) {
          const prevPrice = prices[i - 1].close || prices[i - 1].c || 0;
          const currPrice = prices[i].close || prices[i].c || 0;
          
          if (prevPrice > 0 && currPrice > 0) {
            const dailyReturn = (currPrice - prevPrice) / prevPrice;
            tickerReturns.push(dailyReturn);
            
            // Store dates from first ticker
            if (dates.length < tickerReturns.length) {
              dates.push(new Date(prices[i].timestamp * 1000));
            }
          }
        }
        
        if (tickerReturns.length > 0) {
          returnsByTicker[ticker] = tickerReturns;
        }
      }

      // Find common date range (minimum length)
      const returnLengths = Object.values(returnsByTicker).map(r => r.length);
      const minLength = returnLengths.length > 0 ? Math.min(...returnLengths) : 0;
      console.log('Return lengths:', returnLengths, 'minLength:', minLength);
      
      if (minLength < 10) {
        console.warn('Insufficient return data for VaR calculation:', minLength);
        return this.emptyResult('historical', this.getTotalValue());
      }

      // Calculate portfolio returns
      // Only use positions that have valid return data
      const validTickers = new Set(Object.keys(returnsByTicker));
      const validPositions = this.portfolio.filter(pos => validTickers.has(pos.ticker));
      
      if (validPositions.length === 0) {
        console.warn('No valid positions with return data');
        return this.emptyResult('historical', this.getTotalValue());
      }
      
      // Recalculate total value using only valid positions
      const validTotalValue = validPositions.reduce((sum, p) => sum + p.value, 0);
      
      const portfolioReturns: number[] = [];
      
      for (let i = 0; i < minLength; i++) {
        let portfolioReturn = 0;
        
        for (const pos of validPositions) {
          const tickerReturns = returnsByTicker[pos.ticker];
          if (tickerReturns && tickerReturns[i] !== undefined) {
            const weight = pos.value / validTotalValue;
            portfolioReturn += tickerReturns[i] * weight;
          }
        }
        
        portfolioReturns.push(portfolioReturn);
      }
      
      console.log('Portfolio returns calculated:', {
        validPositions: validPositions.length,
        totalPositions: this.portfolio.length,
        validTotalValue,
        portfolioReturnsCount: portfolioReturns.length,
      });

      // Sort returns to find percentile
      const sortedReturns = [...portfolioReturns].sort((a, b) => a - b);
      const percentileIndex = Math.floor(sortedReturns.length * (1 - this.confidenceLevel));
      const varReturn = sortedReturns[percentileIndex];

      // Calculate CVaR (average of losses beyond VaR)
      const varIndex = sortedReturns.indexOf(varReturn);
      const tailReturns = sortedReturns.slice(0, varIndex + 1);
      const cvarReturn = tailReturns.length > 0
        ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length
        : varReturn;

      // Scale for time horizon
      const timeScale = Math.sqrt(this.timeHorizon);
      const varAmount = Math.abs(varReturn * validTotalValue * timeScale);
      const cvarAmount = Math.abs(cvarReturn * validTotalValue * timeScale);

      // Calculate component VaR
      const componentVar = await this.calculateComponentVaR(
        returnsByTicker,
        varReturn,
        timeScale,
        validPositions
      );

      console.log('Historical VaR calculation:', {
        portfolioReturns: portfolioReturns.length,
        sortedReturns: sortedReturns.length,
        percentileIndex,
        varReturn,
        varAmount,
        validTotalValue,
        originalTotalValue: this.getTotalValue(),
      });

      return {
        var_amount: varAmount,
        var_percentage: Math.abs(varReturn * 100 * timeScale),
        cvar_amount: cvarAmount,
        cvar_percentage: Math.abs(cvarReturn * 100 * timeScale),
        confidence_level: this.confidenceLevel,
        time_horizon: this.timeHorizon,
        method: 'historical',
        component_var: componentVar,
        portfolio_value: validTotalValue,
      };
    } catch (error) {
      console.error('Historical VaR calculation error:', error);
      return this.emptyResult('historical', this.getTotalValue());
    }
  }

  /**
   * Parametric VaR - assumes normal distribution
   */
  private async parametricVaR(): Promise<VaRResult> {
    try {
      // Get historical returns (reuse logic from historical method)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - this.historicalDays);

      const pricePromises = this.portfolio.map(async (pos) => {
        try {
          const prices = await this.finnhubService.getHistoricalPrices(
            pos.ticker,
            startDate,
            endDate,
            'D'
          );
          return { ticker: pos.ticker, prices };
        } catch {
          return { ticker: pos.ticker, prices: [] };
        }
      });

      const priceData = await Promise.all(pricePromises);
      const validData = priceData.filter(d => d.prices.length >= 20);
      
      if (validData.length === 0) {
        return this.emptyResult('parametric', this.getTotalValue());
      }

      // Calculate returns
      const returnsByTicker: { [ticker: string]: number[] } = {};
      for (const { ticker, prices } of validData) {
        const tickerReturns: number[] = [];
        for (let i = 1; i < prices.length; i++) {
          const prevPrice = prices[i - 1].close || prices[i - 1].c || 0;
          const currPrice = prices[i].close || prices[i].c || 0;
          if (prevPrice > 0 && currPrice > 0) {
            tickerReturns.push((currPrice - prevPrice) / prevPrice);
          }
        }
        if (tickerReturns.length > 0) {
          returnsByTicker[ticker] = tickerReturns;
        }
      }

      const minLength = Math.min(...Object.values(returnsByTicker).map(r => r.length));
      if (minLength < 10) {
        return this.emptyResult('parametric', this.getTotalValue());
      }

      // Calculate portfolio returns
      const portfolioReturns: number[] = [];
      const totalValue = this.getTotalValue();
      
      for (let i = 0; i < minLength; i++) {
        let portfolioReturn = 0;
        for (const pos of this.portfolio) {
          const tickerReturns = returnsByTicker[pos.ticker];
          if (tickerReturns && tickerReturns[i] !== undefined) {
            const weight = pos.value / totalValue;
            portfolioReturn += tickerReturns[i] * weight;
          }
        }
        portfolioReturns.push(portfolioReturn);
      }

      // Calculate mean and standard deviation
      const meanReturn = portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length;
      const variance = portfolioReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / portfolioReturns.length;
      const stdDev = Math.sqrt(variance);

      // Get Z-score for confidence level
      const zScore = this.getZScore(this.confidenceLevel);

      // Calculate VaR (mean - z * std)
      const varReturn = meanReturn - (zScore * stdDev);
      const cvarReturn = meanReturn - (zScore * stdDev * 1.2); // Approximation for CVaR

      // Scale for time horizon
      const timeScale = Math.sqrt(this.timeHorizon);
      const varAmount = Math.abs(varReturn * totalValue * timeScale);
      const cvarAmount = Math.abs(cvarReturn * totalValue * timeScale);

      return {
        var_amount: varAmount,
        var_percentage: Math.abs(varReturn * 100 * timeScale),
        cvar_amount: cvarAmount,
        cvar_percentage: Math.abs(cvarReturn * 100 * timeScale),
        confidence_level: this.confidenceLevel,
        time_horizon: this.timeHorizon,
        method: 'parametric',
        portfolio_value: totalValue,
      };
    } catch (error) {
      console.error('Parametric VaR calculation error:', error);
      return this.emptyResult('parametric', this.getTotalValue());
    }
  }

  /**
   * Monte Carlo VaR - simulates returns using historical statistics
   */
  private async monteCarloVaR(simulations: number = 10000): Promise<VaRResult> {
    try {
      // Get historical statistics (reuse from historical method)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - this.historicalDays);

      const pricePromises = this.portfolio.map(async (pos) => {
        try {
          const prices = await this.finnhubService.getHistoricalPrices(
            pos.ticker,
            startDate,
            endDate,
            'D'
          );
          return { ticker: pos.ticker, prices };
        } catch {
          return { ticker: pos.ticker, prices: [] };
        }
      });

      const priceData = await Promise.all(pricePromises);
      const validData = priceData.filter(d => d.prices.length >= 20);
      
      if (validData.length === 0) {
        return this.emptyResult('monte_carlo', this.getTotalValue());
      }

      // Calculate returns and statistics
      const returnsByTicker: { [ticker: string]: number[] } = {};
      for (const { ticker, prices } of validData) {
        const tickerReturns: number[] = [];
        for (let i = 1; i < prices.length; i++) {
          const prevPrice = prices[i - 1].close || prices[i - 1].c || 0;
          const currPrice = prices[i].close || prices[i].c || 0;
          if (prevPrice > 0 && currPrice > 0) {
            tickerReturns.push((currPrice - prevPrice) / prevPrice);
          }
        }
        if (tickerReturns.length > 0) {
          returnsByTicker[ticker] = tickerReturns;
        }
      }

      const minLength = Math.min(...Object.values(returnsByTicker).map(r => r.length));
      if (minLength < 10) {
        return this.emptyResult('monte_carlo', this.getTotalValue());
      }

      // Calculate mean returns and covariance matrix
      const tickers = Object.keys(returnsByTicker);
      const meanReturns: { [ticker: string]: number } = {};
      const covMatrix: number[][] = [];

      for (const ticker of tickers) {
        const returns = returnsByTicker[ticker];
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        meanReturns[ticker] = mean;
      }

      // Build covariance matrix
      for (let i = 0; i < tickers.length; i++) {
        const row: number[] = [];
        const returnsI = returnsByTicker[tickers[i]];
        const meanI = meanReturns[tickers[i]];
        
        for (let j = 0; j < tickers.length; j++) {
          const returnsJ = returnsByTicker[tickers[j]];
          const meanJ = meanReturns[tickers[j]];
          
          let covariance = 0;
          for (let k = 0; k < minLength; k++) {
            covariance += (returnsI[k] - meanI) * (returnsJ[k] - meanJ);
          }
          covariance /= minLength;
          row.push(covariance);
        }
        covMatrix.push(row);
      }

      // Run Monte Carlo simulations
      const simulatedReturns: number[] = [];
      const totalValue = this.getTotalValue();

      for (let sim = 0; sim < simulations; sim++) {
        // Generate correlated random returns
        const randomReturns: { [ticker: string]: number } = {};
        
        // Simple approach: use Cholesky decomposition or sample from historical
        // For simplicity, sample from historical distribution
        const randomIndex = Math.floor(Math.random() * minLength);
        
        let portfolioReturn = 0;
        for (const pos of this.portfolio) {
          const tickerReturns = returnsByTicker[pos.ticker];
          if (tickerReturns && tickerReturns[randomIndex] !== undefined) {
            const weight = pos.value / totalValue;
            // Add some randomness
            const randomReturn = tickerReturns[randomIndex] + 
              (Math.random() - 0.5) * 0.01; // Small random perturbation
            portfolioReturn += randomReturn * weight;
          }
        }
        
        simulatedReturns.push(portfolioReturn);
      }

      // Sort and find VaR
      const sortedReturns = [...simulatedReturns].sort((a, b) => a - b);
      const percentileIndex = Math.floor(simulations * (1 - this.confidenceLevel));
      const varReturn = sortedReturns[percentileIndex];

      // Calculate CVaR
      const varIndex = sortedReturns.indexOf(varReturn);
      const tailReturns = sortedReturns.slice(0, varIndex + 1);
      const cvarReturn = tailReturns.length > 0
        ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length
        : varReturn;

      // Scale for time horizon
      const timeScale = Math.sqrt(this.timeHorizon);
      const varAmount = Math.abs(varReturn * totalValue * timeScale);
      const cvarAmount = Math.abs(cvarReturn * totalValue * timeScale);

      return {
        var_amount: varAmount,
        var_percentage: Math.abs(varReturn * 100 * timeScale),
        cvar_amount: cvarAmount,
        cvar_percentage: Math.abs(cvarReturn * 100 * timeScale),
        confidence_level: this.confidenceLevel,
        time_horizon: this.timeHorizon,
        method: 'monte_carlo',
        portfolio_value: totalValue,
      };
    } catch (error) {
      console.error('Monte Carlo VaR calculation error:', error);
      return this.emptyResult('monte_carlo', this.getTotalValue());
    }
  }

  /**
   * Calculate Component VaR (contribution of each position)
   */
  private async calculateComponentVaR(
    returnsByTicker: { [ticker: string]: number[] },
    portfolioVaRReturn: number,
    timeScale: number,
    validPositions?: Position[]
  ): Promise<ComponentVaR[]> {
    const componentVar: ComponentVaR[] = [];
    const positionsToUse = validPositions || this.portfolio;
    const totalValue = positionsToUse.reduce((sum, p) => sum + p.value, 0);
    const totalVaR = Math.abs(portfolioVaRReturn * totalValue * timeScale);

    for (const pos of positionsToUse) {
      const tickerReturns = returnsByTicker[pos.ticker];
      if (!tickerReturns || tickerReturns.length === 0) continue;

      // Calculate position's contribution to portfolio VaR
      // Simplified: use position's individual VaR weighted by correlation
      const sortedReturns = [...tickerReturns].sort((a, b) => a - b);
      const percentileIndex = Math.floor(sortedReturns.length * (1 - this.confidenceLevel));
      const positionVaRReturn = sortedReturns[percentileIndex];
      
      const weight = pos.value / totalValue;
      const positionVaR = Math.abs(positionVaRReturn * pos.value * timeScale);
      
      // Contribution is proportional to weight and individual VaR
      const contribution = positionVaR * weight;
      const contributionPct = totalVaR > 0 ? (contribution / totalVaR) * 100 : 0;

      componentVar.push({
        ticker: pos.ticker,
        var_amount: positionVaR,
        var_percentage: Math.abs(positionVaRReturn * 100 * timeScale),
        contribution_pct: contributionPct,
      });
    }

    // Sort by contribution
    componentVar.sort((a, b) => b.contribution_pct - a.contribution_pct);

    return componentVar;
  }

  /**
   * Get Z-score for confidence level
   */
  private getZScore(confidence: ConfidenceLevel): number {
    const zScores: { [key: number]: number } = {
      0.90: 1.282,
      0.95: 1.645,
      0.99: 2.326,
    };
    return zScores[confidence] || 1.645;
  }

  /**
   * Get total portfolio value
   */
  private getTotalValue(): number {
    return this.portfolio.reduce((sum, p) => sum + p.value, 0);
  }

  /**
   * Return empty result when calculation fails
   */
  private emptyResult(method: VaRMethod, portfolioValue: number): VaRResult {
    return {
      var_amount: 0,
      var_percentage: 0,
      cvar_amount: 0,
      cvar_percentage: 0,
      confidence_level: this.confidenceLevel,
      time_horizon: this.timeHorizon,
      method,
      portfolio_value: portfolioValue,
    };
  }
}

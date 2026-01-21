// Portfolio Optimization Engine - TypeScript implementation

import { FinnhubService } from './finnhub-service';

export type OptimizationStrategy = 
  | 'max_sharpe'
  | 'monte_carlo_sharpe'
  | 'min_volatility'
  | 'equal_weight'
  | 'risk_parity'
  | 'max_diversification';

export interface OptimizedPosition {
  ticker: string;
  weight: number;
  quantity: number;
  price: number;
  value: number;
  percentage: number;
}

export interface OptimizationResult {
  strategy: OptimizationStrategy;
  positions: OptimizedPosition[];
  expected_return: number;
  volatility: number;
  sharpe_ratio: number;
  total_value: number;
}

export interface OptimizationInputs {
  tickers: string[];
  prices: number[];
  portfolioValue: number;
  riskFreeRate?: number;
  returns?: number[];
  covarianceMatrix?: number[][];
}

export class PortfolioOptimizer {
  private static readonly MIN_WEIGHT = 0.05;
  private static readonly MAX_WEIGHT = 0.10;
  private static readonly DEFAULT_RISK_FREE_RATE = 0.02;
  private static readonly EPSILON = 1e-6;
  private static readonly TOLERANCE = 1e-6;
  private static readonly MAX_ITERATIONS = 200;

  // Helper: Clamp value to bounds
  private static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  // Helper: Clamp weights array to bounds
  private static clampWeights(weights: number[]): void {
    for (let i = 0; i < weights.length; i++) {
      weights[i] = this.clamp(weights[i], this.MIN_WEIGHT, this.MAX_WEIGHT);
    }
  }

  // Helper: Normalize weights to sum to 1.0
  private static normalize(weights: number[]): void {
    const total = weights.reduce((s, w) => s + w, 0);
    if (total > this.TOLERANCE) {
      for (let i = 0; i < weights.length; i++) {
        weights[i] /= total;
      }
    } else {
      const n = weights.length;
      for (let i = 0; i < n; i++) {
        weights[i] = 1 / n;
      }
    }
  }

  // Helper: Create positions from weights
  private static createPositions(
    tickers: string[],
    weights: number[],
    prices: number[],
    portfolioValue: number
  ): OptimizedPosition[] {
    return tickers.map((ticker, i) => {
      const value = portfolioValue * weights[i];
      const quantity = Math.floor(value / prices[i]);
      const actualValue = quantity * prices[i];

      return {
        ticker,
        weight: weights[i],
        quantity,
        price: prices[i],
        value: actualValue,
        percentage: weights[i] * 100,
      };
    });
  }

  // Helper: Calculate portfolio metrics
  private static calculateMetrics(
    weights: number[],
    returns: number[],
    covMatrix: number[][],
    riskFreeRate: number
  ): { return: number; volatility: number; sharpeRatio: number } {
    const portfolioReturn = weights.reduce((sum, w, i) => sum + w * returns[i], 0);
    const portfolioVariance = this.calculatePortfolioVariance(weights, covMatrix);
    const portfolioVol = Math.sqrt(portfolioVariance);
    const sharpeRatio = portfolioVol > this.TOLERANCE 
      ? (portfolioReturn - riskFreeRate) / portfolioVol 
      : 0;

    return { return: portfolioReturn, volatility: portfolioVol, sharpeRatio };
  }

  // Helper: Check if constraints are satisfied
  private static areConstraintsSatisfied(weights: number[], minWeight?: number, maxWeight?: number): boolean {
    const total = weights.reduce((s, w) => s + w, 0);
    if (Math.abs(total - 1.0) > this.TOLERANCE) return false;

    const minW = minWeight !== undefined ? minWeight : this.MIN_WEIGHT;
    const maxW = maxWeight !== undefined ? maxWeight : this.MAX_WEIGHT;
    for (const w of weights) {
      if (w < minW - this.TOLERANCE || w > maxW + this.TOLERANCE) return false;
    }
    return true;
  }

  // Helper: Calculate portfolio variance: w^T * Σ * w
  private static calculatePortfolioVariance(weights: number[], covMatrix: number[][]): number {
    let variance = 0;
    const n = weights.length;
    
    for (let i = 0; i < n; i++) {
      const wi = weights[i];
      for (let j = 0; j < n; j++) {
        variance += wi * weights[j] * covMatrix[i][j];
      }
    }
    
    return variance;
  }

  // Helper: Calculate matrix-vector product Σw
  private static matrixVectorProduct(matrix: number[][], vector: number[]): number[] {
    const n = matrix.length;
    const result = new Array(n).fill(0);
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        result[i] += matrix[i][j] * vector[j];
      }
    }
    
    return result;
  }

  // Helper: Regularize covariance matrix (add ridge term)
  private static regularizeCovariance(covMatrix: number[][]): number[][] {
    return covMatrix.map((row, i) => 
      row.map((val, j) => val + (i === j ? this.EPSILON : 0))
    );
  }

  /**
   * Calculate expected returns from historical data
   */
  static async calculateExpectedReturns(tickers: string[], prices: number[]): Promise<number[]> {
    const finnhubService = new FinnhubService();
    const returns: number[] = [];
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 252); // 1 year of trading days
    
    // Fetch historical data for all tickers in parallel
    const pricePromises = tickers.map(async (ticker) => {
      try {
        const historicalPrices = await finnhubService.getHistoricalPrices(
          ticker,
          startDate,
          endDate,
          'D'
        );
        
        if (historicalPrices.length < 20) {
          return null;
        }
        
        // Calculate daily returns
        const dailyReturns: number[] = [];
        for (let i = 1; i < historicalPrices.length; i++) {
          const prevPrice = historicalPrices[i - 1].close || historicalPrices[i - 1].c || 0;
          const currPrice = historicalPrices[i].close || historicalPrices[i].c || 0;
          if (prevPrice > 0 && currPrice > 0) {
            dailyReturns.push((currPrice - prevPrice) / prevPrice);
          }
        }
        
        if (dailyReturns.length === 0) {
          return null;
        }
        
        // Calculate annualized mean return
        const meanDailyReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
        const annualizedReturn = meanDailyReturn * 252; // Annualize
        
        return this.clamp(annualizedReturn, 0.03, 0.15);
      } catch (error) {
        console.warn(`Failed to fetch historical data for ${ticker}, using fallback:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(pricePromises);
    
    // Use real data where available, fallback to deterministic for missing data
    const baseReturns = [0.12, 0.10, 0.08, 0.06, 0.09, 0.11, 0.07, 0.09, 0.13, 0.08, 0.10, 0.09];
    for (let i = 0; i < tickers.length; i++) {
      if (results[i] !== null && results[i] !== undefined) {
        returns.push(results[i] as number);
      } else {
        // Fallback to deterministic
        const base = baseReturns[i % baseReturns.length] || 0.08;
        const variation = ((i % 5) - 2) * 0.005;
        returns.push(this.clamp(base + variation, 0.03, 0.15));
      }
    }
    
    console.log('Expected returns calculated:', tickers.map((t, i) => ({ ticker: t, return: returns[i] })));
    
    return returns;
  }

  /**
   * Calculate covariance matrix from historical returns
   */
  static async calculateCovarianceMatrix(tickers: string[]): Promise<number[][]> {
    const n = tickers.length;
    const finnhubService = new FinnhubService();
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 252); // 1 year
    
    // Fetch historical data for all tickers
    const returnsData: { [ticker: string]: number[] } = {};
    
    const pricePromises = tickers.map(async (ticker) => {
      try {
        const historicalPrices = await finnhubService.getHistoricalPrices(
          ticker,
          startDate,
          endDate,
          'D'
        );
        
        if (historicalPrices.length < 20) {
          return { ticker, returns: null };
        }
        
        // Calculate daily returns
        const dailyReturns: number[] = [];
        for (let i = 1; i < historicalPrices.length; i++) {
          const prevPrice = historicalPrices[i - 1].close || historicalPrices[i - 1].c || 0;
          const currPrice = historicalPrices[i].close || historicalPrices[i].c || 0;
          if (prevPrice > 0 && currPrice > 0) {
            dailyReturns.push((currPrice - prevPrice) / prevPrice);
          }
        }
        
        return { ticker, returns: dailyReturns.length > 0 ? dailyReturns : null };
      } catch (error) {
        console.warn(`Failed to fetch covariance data for ${ticker}:`, error);
        return { ticker, returns: null };
      }
    });
    
    const results = await Promise.all(pricePromises);
    
    // Build returns matrix
    results.forEach(({ ticker, returns }) => {
      if (returns) {
        returnsData[ticker] = returns;
      }
    });
    
    // Find common length (minimum)
    const returnLengths = Object.values(returnsData).map(r => r.length);
    const minLength = returnLengths.length > 0 ? Math.min(...returnLengths) : 0;
    
    if (minLength < 20) {
      // Fallback to deterministic if insufficient data
      console.warn('Insufficient historical data for covariance, using fallback');
      return this.calculateCovarianceMatrixFallback(tickers);
    }
    
    // Calculate covariance matrix from historical returns
    const meanReturns: { [ticker: string]: number } = {};
    for (const ticker of Object.keys(returnsData)) {
      const returns = returnsData[ticker];
      meanReturns[ticker] = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    }
    
    // Calculate covariances
    for (let i = 0; i < n; i++) {
      const tickerI = tickers[i];
      const returnsI = returnsData[tickerI];
      const meanI = meanReturns[tickerI];
      
      if (!returnsI || meanI === undefined) {
        // Use fallback for this row
        const baseVols = [0.25, 0.28, 0.22, 0.30, 0.26, 0.24];
        const vol = baseVols[i % baseVols.length];
        matrix[i][i] = vol * vol;
        continue;
      }
      
      for (let j = 0; j < n; j++) {
        const tickerJ = tickers[j];
        const returnsJ = returnsData[tickerJ];
        const meanJ = meanReturns[tickerJ];
        
        if (!returnsJ || meanJ === undefined) {
          if (i === j) {
            const baseVols = [0.25, 0.28, 0.22, 0.30, 0.26, 0.24];
            const vol = baseVols[j % baseVols.length];
            matrix[i][j] = vol * vol;
          }
          continue;
        }
        
        // Calculate covariance
        let covariance = 0;
        for (let k = 0; k < minLength; k++) {
          covariance += (returnsI[k] - meanI) * (returnsJ[k] - meanJ);
        }
        covariance /= minLength;
        
        // Annualize (multiply by 252 for daily returns)
        covariance *= 252;
        
        matrix[i][j] = covariance;
      }
    }
    
    console.log('Covariance matrix calculated from historical data');
    
    return matrix;
  }
  
  /**
   * Fallback covariance matrix (deterministic)
   */
  private static calculateCovarianceMatrixFallback(tickers: string[]): number[][] {
    const n = tickers.length;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    const baseVols = [0.25, 0.28, 0.22, 0.30, 0.26, 0.24, 0.29, 0.23, 0.27, 0.31, 0.25, 0.26];
    const volatilities: number[] = [];
    
    // Set diagonal (variances)
    for (let i = 0; i < n; i++) {
      const vol = this.clamp(
        baseVols[i % baseVols.length] + ((i % 5) - 2) * 0.01,
        0.15,
        0.35
      );
      volatilities.push(vol);
      matrix[i][i] = vol * vol;
    }
    
    // Set off-diagonal (covariances) - symmetric
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const correlation = this.clamp(0.4 + ((i + j) % 7) * 0.05, 0.2, 0.8);
        const covariance = correlation * volatilities[i] * volatilities[j];
        matrix[i][j] = covariance;
        matrix[j][i] = covariance;
      }
    }
    
    return matrix;
  }

  /**
   * Equal Weight Portfolio
   */
  static equalWeight(inputs: OptimizationInputs): OptimizationResult {
    const n = inputs.tickers.length;
    const weightPerAsset = 1 / n;
    const positions = this.createPositions(
      inputs.tickers,
      Array(n).fill(weightPerAsset),
      inputs.prices,
      inputs.portfolioValue
    );

    const returns = inputs.returns || Array(n).fill(0.08);
    const expectedReturn = returns.reduce((sum, r) => sum + r * weightPerAsset, 0);
    const riskFreeRate = inputs.riskFreeRate || this.DEFAULT_RISK_FREE_RATE;
    const sharpeRatio = (expectedReturn - riskFreeRate) / 0.15; // Simplified estimate

    return {
      strategy: 'equal_weight',
      positions,
      expected_return: expectedReturn,
      volatility: 0.15,
      sharpe_ratio: sharpeRatio,
      total_value: positions.reduce((sum, p) => sum + p.value, 0),
    };
  }

  /**
   * Monte Carlo Sharpe Ratio Portfolio
   * Generates random allocations respecting constraints and selects maximum Sharpe
   */
  static async monteCarloSharpe(
    inputs: OptimizationInputs,
    returns: number[],
    covMatrix: number[][],
    numSimulations: number = 10000
  ): Promise<OptimizationResult> {
    const n = inputs.tickers.length;
    const riskFreeRate = inputs.riskFreeRate || this.DEFAULT_RISK_FREE_RATE;
    
    // Adjust bounds based on number of assets
    // For n < 10: allow larger positions (min = 1/n, max = 10%)
    // For n >= 10: use standard 5-10% bounds
    // For n > 20: allow smaller positions (min = 5%, max = 1/n)
    let effectiveMinWeight = this.MIN_WEIGHT;
    let effectiveMaxWeight = this.MAX_WEIGHT;
    
    if (n < 10) {
      // With fewer assets, we need larger positions
      effectiveMinWeight = Math.max(1 / n, this.MIN_WEIGHT);
      effectiveMaxWeight = Math.min(1.0, this.MAX_WEIGHT);
      console.log(`Monte Carlo: ${n} assets. Using adjusted bounds: ${(effectiveMinWeight*100).toFixed(1)}%-${(effectiveMaxWeight*100).toFixed(1)}%`);
    } else if (n > 20) {
      // With more assets, we need smaller positions
      effectiveMinWeight = this.MIN_WEIGHT;
      effectiveMaxWeight = Math.min(1 / n, this.MAX_WEIGHT);
      console.log(`Monte Carlo: ${n} assets. Using adjusted bounds: ${(effectiveMinWeight*100).toFixed(1)}%-${(effectiveMaxWeight*100).toFixed(1)}%`);
    } else {
      console.log(`Monte Carlo: ${n} assets. Using standard bounds: ${(effectiveMinWeight*100).toFixed(1)}%-${(effectiveMaxWeight*100).toFixed(1)}%`);
    }
    
    // If even adjusted bounds are impossible, use equal weight
    if (n * effectiveMinWeight > 1.0 || n * effectiveMaxWeight < 1.0) {
      console.warn(`Cannot satisfy bounds with ${n} assets. Using equal weight.`);
      return this.equalWeight(inputs);
    }

    let bestWeights: number[] | null = null;
    let bestSharpe = -Infinity;
    let improvementCount = 0;

    // Generate random allocations
    for (let sim = 0; sim < numSimulations; sim++) {
      // Generate random weights that satisfy constraints
      // For n < 10, we use adjusted bounds
      const weights = new Array(n);
      let attempts = 0;
      let valid = false;
      
      while (!valid && attempts < 100) {
        attempts++;
        
        // Generate random values in [effectiveMinWeight, effectiveMaxWeight] range
        for (let i = 0; i < n; i++) {
          weights[i] = effectiveMinWeight + Math.random() * (effectiveMaxWeight - effectiveMinWeight);
        }
        
        // Normalize to sum to 1.0
        let total = weights.reduce((s, w) => s + w, 0);
        if (total < this.TOLERANCE) continue;
        
        // Scale to sum to 1.0
        for (let i = 0; i < n; i++) {
          weights[i] /= total;
        }
        
        // Check if all weights are within bounds after normalization
        let allInBounds = true;
        for (let i = 0; i < n; i++) {
          if (weights[i] < effectiveMinWeight - this.TOLERANCE || weights[i] > effectiveMaxWeight + this.TOLERANCE) {
            allInBounds = false;
            break;
          }
        }
        
        if (allInBounds) {
          // Final check: ensure sum is exactly 1.0
          total = weights.reduce((s, w) => s + w, 0);
          if (Math.abs(total - 1.0) < this.TOLERANCE) {
            valid = true;
          } else {
            // One more normalization
            for (let i = 0; i < n; i++) {
              weights[i] /= total;
            }
            // Check bounds again after final normalization
            allInBounds = true;
            for (let i = 0; i < n; i++) {
              if (weights[i] < effectiveMinWeight - this.TOLERANCE || weights[i] > effectiveMaxWeight + this.TOLERANCE) {
                allInBounds = false;
                break;
              }
            }
            if (allInBounds) {
              valid = true;
            }
          }
        }
      }
      
      // If we couldn't generate valid weights, skip this simulation
      if (!valid) {
        continue;
      }

      // Calculate Sharpe ratio for this allocation
      const metrics = this.calculateMetrics(weights, returns, covMatrix, riskFreeRate);
      
      // Only update if we found a better Sharpe ratio (with some tolerance to avoid numerical issues)
      if (metrics.sharpeRatio > bestSharpe + this.TOLERANCE) {
        bestSharpe = metrics.sharpeRatio;
        bestWeights = [...weights];
        improvementCount++;
        
        // Log every 100th improvement
        if (improvementCount % 100 === 0) {
          console.log(`Monte Carlo improvement #${improvementCount}: Sharpe=${bestSharpe.toFixed(4)}, weights=`, 
            weights.map((w, i) => `${inputs.tickers[i]}:${(w*100).toFixed(1)}%`).join(', '));
        }
      }
    }
    
    console.log('Monte Carlo Sharpe optimization:', {
      simulations: numSimulations,
      bestSharpe,
      bestWeights: bestWeights?.map((w, i) => ({ ticker: inputs.tickers[i], weight: w })),
      returns: returns.map((r, i) => ({ ticker: inputs.tickers[i], return: r })),
    });

    // Fallback if no valid allocation found
    if (!bestWeights || bestSharpe === -Infinity) {
      console.warn('Monte Carlo failed to find valid allocation, using equal weight');
      return this.equalWeight(inputs);
    }

    // Calculate final positions and metrics
    const positions = this.createPositions(inputs.tickers, bestWeights, inputs.prices, inputs.portfolioValue);
    const finalMetrics = this.calculateMetrics(bestWeights, returns, covMatrix, riskFreeRate);

    return {
      strategy: 'monte_carlo_sharpe',
      positions,
      expected_return: finalMetrics.return,
      volatility: finalMetrics.volatility,
      sharpe_ratio: finalMetrics.sharpeRatio,
      total_value: positions.reduce((sum, p) => sum + p.value, 0),
    };
  }

  /**
   * Max Sharpe Ratio Portfolio
   * Unconstrained tangency: w* ∝ Σ^-1(μ - rf·1)
   * Then applies constraints: 5% ≤ w_i ≤ 10%, Σw = 1
   * Feasibility: 10 ≤ N ≤ 20 assets required
   */
  static maxSharpe(inputs: OptimizationInputs, returns: number[], covMatrix: number[][]): OptimizationResult {
    const n = inputs.tickers.length;
    
    // Adjust bounds based on number of assets
    let effectiveMinWeight = this.MIN_WEIGHT;
    let effectiveMaxWeight = this.MAX_WEIGHT;
    
    if (n < 10) {
      effectiveMinWeight = Math.max(1 / n, this.MIN_WEIGHT);
      effectiveMaxWeight = Math.min(1.0, this.MAX_WEIGHT);
      console.log(`Max Sharpe: ${n} assets. Using adjusted bounds: ${(effectiveMinWeight*100).toFixed(1)}%-${(effectiveMaxWeight*100).toFixed(1)}%`);
    } else if (n > 20) {
      effectiveMinWeight = this.MIN_WEIGHT;
      effectiveMaxWeight = Math.min(1 / n, this.MAX_WEIGHT);
      console.log(`Max Sharpe: ${n} assets. Using adjusted bounds: ${(effectiveMinWeight*100).toFixed(1)}%-${(effectiveMaxWeight*100).toFixed(1)}%`);
    }
    
    // If even adjusted bounds are impossible, use equal weight
    if (n * effectiveMinWeight > 1.0 || n * effectiveMaxWeight < 1.0) {
      console.warn(`Cannot satisfy bounds with ${n} assets. Using equal weight.`);
      return this.equalWeight(inputs);
    }

    const riskFreeRate = inputs.riskFreeRate || this.DEFAULT_RISK_FREE_RATE;
    const regularizedCov = this.regularizeCovariance(covMatrix);
    const excessReturns = returns.map(r => r - riskFreeRate);

    // Step 1: Unconstrained tangency portfolio
    let weights = this.calculateTangencyPortfolio(excessReturns, regularizedCov);

    // Step 2: Apply constraints iteratively with adjusted bounds
    weights = this.applyConstraintsWithGradient(
      weights,
      excessReturns,
      returns,
      regularizedCov,
      riskFreeRate
    );

    // Calculate final positions and metrics
    const positions = this.createPositions(inputs.tickers, weights, inputs.prices, inputs.portfolioValue);
    const metrics = this.calculateMetrics(weights, returns, covMatrix, riskFreeRate);

    return {
      strategy: 'max_sharpe',
      positions,
      expected_return: metrics.return,
      volatility: metrics.volatility,
      sharpe_ratio: metrics.sharpeRatio,
      total_value: positions.reduce((sum, p) => sum + p.value, 0),
    };
  }

  // Calculate unconstrained tangency portfolio
  private static calculateTangencyPortfolio(
    excessReturns: number[],
    covMatrix: number[][]
  ): number[] {
    const n = excessReturns.length;
    let invCov: number[][];
    
    try {
      invCov = this.invertMatrix(covMatrix);
    } catch {
      // Fallback: diagonal approximation
      invCov = covMatrix.map((row, i) => 
        row.map((_, j) => i === j ? 1 / row[i] : 0)
      );
    }

    // Calculate Σ^-1 * (μ - rf)
    const invCovTimesExcess = this.matrixVectorProduct(invCov, excessReturns);
    const sum = invCovTimesExcess.reduce((s, val) => s + val, 0);

    if (Math.abs(sum) < this.TOLERANCE) {
      return Array(n).fill(1 / n);
    }

    // Normalize and enforce long-only
    let weights = invCovTimesExcess.map(val => val / sum);
    weights = weights.map(w => Math.max(0, w));
    this.normalize(weights);

    return weights;
  }

  // Apply constraints using true Sharpe gradient
  private static applyConstraintsWithGradient(
    weights: number[],
    excessReturns: number[],
    returns: number[],
    covMatrix: number[][],
    riskFreeRate: number
  ): number[] {
    const n = weights.length;

    for (let iter = 0; iter < this.MAX_ITERATIONS; iter++) {
      if (this.areConstraintsSatisfied(weights)) break;

      // Calculate portfolio metrics
      const portfolioReturn = weights.reduce((sum, w, i) => sum + w * returns[i], 0);
      const portfolioVariance = this.calculatePortfolioVariance(weights, covMatrix);
      const portfolioVol = Math.sqrt(portfolioVariance);

      if (portfolioVol < this.TOLERANCE) {
        return Array(n).fill(1 / n);
      }

      // Calculate true Sharpe gradient: ∇S = a/σ_p - (a^T w/σ_p³)·Σw
      const excessPortfolioReturn = portfolioReturn - riskFreeRate;
      const covTimesWeights = this.matrixVectorProduct(covMatrix, weights);
      const vol3 = portfolioVol * portfolioVol * portfolioVol;
      const gradient = excessReturns.map((a, i) => 
        a / portfolioVol - (excessPortfolioReturn / vol3) * covTimesWeights[i]
      );

      // Clamp and redistribute
      this.clampWeights(weights);
      const totalAfterClamp = weights.reduce((s, w) => s + w, 0);
      const deficit = 1.0 - totalAfterClamp;

      if (Math.abs(deficit) < this.TOLERANCE) break;

      this.redistributeWeights(weights, gradient, deficit);
      this.normalize(weights);
      this.clampWeights(weights);
    }

    return weights;
  }

  // Redistribute weights based on gradient
  private static redistributeWeights(
    weights: number[],
    gradient: number[],
    deficit: number,
    minWeight?: number,
    maxWeight?: number
  ): void {
    const n = weights.length;
    const minW = minWeight !== undefined ? minWeight : this.MIN_WEIGHT;
    const maxW = maxWeight !== undefined ? maxWeight : this.MAX_WEIGHT;
    const freeIndices: number[] = [];
    const freeGradients: number[] = [];
    const freeRoom: number[] = [];

    if (deficit > 0) {
      // Add weight to assets with positive gradient and room
      for (let i = 0; i < n; i++) {
        if (weights[i] < maxW && gradient[i] > 0) {
          freeIndices.push(i);
          freeGradients.push(gradient[i]);
          freeRoom.push(maxW - weights[i]);
        }
      }
    } else {
      // Remove weight from assets with negative gradient and room
      for (let i = 0; i < n; i++) {
        if (weights[i] > minW && gradient[i] < 0) {
          freeIndices.push(i);
          freeGradients.push(Math.abs(gradient[i]));
          freeRoom.push(weights[i] - minW);
        }
      }
    }

    if (freeIndices.length === 0) return;

    // Calculate adjustment weights: gradient × available room
    const adjustmentWeights = freeGradients.map((g, idx) => g * freeRoom[idx]);
    const totalAdjustmentWeight = adjustmentWeights.reduce((s, w) => s + w, 0);

    if (totalAdjustmentWeight < this.TOLERANCE) {
      // Equal distribution fallback
      const perAsset = Math.abs(deficit) / freeIndices.length;
      for (const idx of freeIndices) {
        weights[idx] += deficit > 0 ? perAsset : -perAsset;
      }
      return;
    }

    // Proportional redistribution
    for (let j = 0; j < freeIndices.length; j++) {
      const idx = freeIndices[j];
      const adjustment = (adjustmentWeights[j] / totalAdjustmentWeight) * deficit;
      weights[idx] += adjustment;
    }
  }

  /**
   * Minimum Volatility Portfolio
   */
  static minVolatility(inputs: OptimizationInputs, covMatrix: number[][]): OptimizationResult {
    const n = inputs.tickers.length;
    const variances = covMatrix.map((row, i) => row[i]);
    const invVariances = variances.map(v => 1 / v);
    const sumInvVar = invVariances.reduce((sum, iv) => sum + iv, 0);
    let weights = invVariances.map(iv => iv / sumInvVar);

    // Iteratively minimize volatility
    for (let iter = 0; iter < 50; iter++) {
      const newWeights = weights.map((w, i) => 
        w * (1 + 0.01 / Math.sqrt(variances[i]))
      );
      
      this.normalize(newWeights);
      this.clampWeights(newWeights);
      this.normalize(newWeights);
      
      // Check convergence
      const maxChange = Math.max(...weights.map((w, i) => Math.abs(w - newWeights[i])));
      if (maxChange < this.TOLERANCE) break;
      
      weights = newWeights;
    }

    const positions = this.createPositions(inputs.tickers, weights, inputs.prices, inputs.portfolioValue);
    const returns = inputs.returns || Array(n).fill(0.08);
    const riskFreeRate = inputs.riskFreeRate || this.DEFAULT_RISK_FREE_RATE;
    const metrics = this.calculateMetrics(weights, returns, covMatrix, riskFreeRate);

    return {
      strategy: 'min_volatility',
      positions,
      expected_return: metrics.return,
      volatility: metrics.volatility,
      sharpe_ratio: metrics.sharpeRatio,
      total_value: positions.reduce((sum, p) => sum + p.value, 0),
    };
  }

  /**
   * Risk Parity Portfolio (equal risk contribution)
   */
  static riskParity(inputs: OptimizationInputs, covMatrix: number[][]): OptimizationResult {
    const n = inputs.tickers.length;
    let weights = Array(n).fill(1 / n);

    // Iteratively equalize risk contributions
    for (let iter = 0; iter < 50; iter++) {
      const portfolioVariance = this.calculatePortfolioVariance(weights, covMatrix);
      const portfolioVol = Math.sqrt(portfolioVariance);
      
      // Calculate marginal contribution to risk
      const covTimesWeights = this.matrixVectorProduct(covMatrix, weights);
      const marginalContribs = covTimesWeights.map(c => c / portfolioVol);
      const riskContribs = weights.map((w, i) => w * marginalContribs[i]);
      const avgRiskContrib = riskContribs.reduce((sum, rc) => sum + rc, 0) / n;

      // Adjust weights toward equal risk contribution
      const newWeights = weights.map((w, i) => 
        riskContribs[i] > avgRiskContrib ? w * 0.99 : w * 1.01
      );

      this.normalize(newWeights);
      this.clampWeights(newWeights);
      this.normalize(newWeights);

      // Check convergence
      const maxChange = Math.max(...weights.map((w, i) => Math.abs(w - newWeights[i])));
      if (maxChange < this.TOLERANCE) break;

      weights = newWeights;
    }

    const positions = this.createPositions(inputs.tickers, weights, inputs.prices, inputs.portfolioValue);
    const returns = inputs.returns || Array(n).fill(0.08);
    const riskFreeRate = inputs.riskFreeRate || this.DEFAULT_RISK_FREE_RATE;
    const metrics = this.calculateMetrics(weights, returns, covMatrix, riskFreeRate);

    return {
      strategy: 'risk_parity',
      positions,
      expected_return: metrics.return,
      volatility: metrics.volatility,
      sharpe_ratio: metrics.sharpeRatio,
      total_value: positions.reduce((sum, p) => sum + p.value, 0),
    };
  }

  /**
   * Invert matrix using Gaussian elimination
   */
  private static invertMatrix(matrix: number[][]): number[][] {
    const n = matrix.length;
    const augmented: number[][] = matrix.map((row, i) => {
      const identityRow = new Array(n).fill(0);
      identityRow[i] = 1;
      return [...row, ...identityRow];
    });

    // Gaussian elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }

      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      const pivot = augmented[i][i];
      if (Math.abs(pivot) < this.TOLERANCE) {
        throw new Error('Singular matrix');
      }

      // Normalize pivot row
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }

      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }

    // Extract inverse
    return augmented.map(row => row.slice(n));
  }

  /**
   * Optimize portfolio with specified strategy
   */
  static async optimize(
    strategy: OptimizationStrategy,
    inputs: OptimizationInputs
  ): Promise<OptimizationResult> {
    console.log('PortfolioOptimizer.optimize called:', {
      strategy,
      tickers: inputs.tickers,
      hasReturns: !!inputs.returns,
      hasCovMatrix: !!inputs.covarianceMatrix,
    });
    
    const returns = inputs.returns || await this.calculateExpectedReturns(inputs.tickers, inputs.prices);
    const covMatrix = inputs.covarianceMatrix || await this.calculateCovarianceMatrix(inputs.tickers);
    
    console.log('Optimization inputs prepared:', {
      returns: returns.map((r, i) => ({ ticker: inputs.tickers[i], return: r, returnPct: (r * 100).toFixed(2) + '%' })),
      covMatrixSample: covMatrix.slice(0, Math.min(3, covMatrix.length)).map(row => 
        row.slice(0, Math.min(3, row.length))
      ),
    });

    switch (strategy) {
      case 'equal_weight':
        return this.equalWeight(inputs);
      case 'max_sharpe':
        return this.maxSharpe(inputs, returns, covMatrix);
      case 'monte_carlo_sharpe':
        return await this.monteCarloSharpe(inputs, returns, covMatrix, 10000);
      case 'min_volatility':
        return this.minVolatility(inputs, covMatrix);
      case 'risk_parity':
        return this.riskParity(inputs, covMatrix);
      default:
        return this.equalWeight(inputs);
    }
  }
}

// Unified Scoring Engine - 0-100 score with multiple factors

export interface ScoreComponents {
  dcf_upside: number; // 0-100 based on upside/downside percentage
  momentum: number; // 0-100 based on price momentum
  sentiment: number; // 0-100 based on sentiment score
  quality: number; // 0-100 based on financial quality metrics
  risk_flags: number; // Penalty score (subtracted from total)
  fragility: number; // DCF sensitivity fragility flag
}

export interface UnifiedScore {
  overall_score: number; // 0-100 final score
  components: ScoreComponents;
  flags: {
    high_fragility: boolean;
    high_risk: boolean;
    negative_sentiment: boolean;
    negative_momentum: boolean;
  };
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
}

export class ScoringEngine {
  static calculateDCFUpside(upsideDownside: number): number {
    // Convert upside/downside percentage to 0-100 score
    // +50% upside = 100, 0% = 50, -50% downside = 0
    const score = 50 + (upsideDownside / 50) * 50;
    return Math.max(0, Math.min(100, score));
  }

  static calculateSentiment(sentimentScore: number): number {
    // Sentiment score is typically -1 to +1
    // Convert to 0-100: -1 = 0, 0 = 50, +1 = 100
    return Math.max(0, Math.min(100, 50 + sentimentScore * 50));
  }

  static calculateQuality(metrics: {
    // Profitability
    roic?: number; // Return on Invested Capital (%)
    wacc?: number; // Weighted Average Cost of Capital (%)
    operatingMargin_5yAvg?: number; // Operating margin 5-year average (%)
    operatingMargin_industryPercentile?: number; // 0-100 percentile vs industry
    
    // Earnings Quality
    accrualsRatio?: number; // CFO / Net Income
    fcfNetIncome_5yAvg?: number; // FCF / Net Income 5-year average
    
    // Balance Sheet Strength
    netDebtEBITDA?: number; // Net Debt / EBITDA
    interestCoverage?: number; // EBITDA / Interest Expense
    
    // Growth Durability
    revenueCAGR_5y?: number; // Revenue CAGR over 5 years (%)
    revenueCAGR_industryStdDev?: number; // Revenue CAGR vs industry (in std devs)
    revenueVolatility_5y?: number; // Revenue volatility (std/avg) over 5 years
    revenueVolatility_industryPercentile?: number; // 0-100 percentile vs industry
    
    // Capital Allocation
    reinvestmentEfficiency?: number; // ΔRevenue / (CapEx + R&D) over 3-5 years
    reinvestmentEfficiency_industryPercentile?: number; // 0-100 percentile vs industry
    shareholderReturns_pctFCF?: number; // (Dividends + Buybacks) / FCF as %
    netDebtEBITDA_trend?: 'rising' | 'stable' | 'falling'; // Trend in leverage
    
    // Risk/Volatility
    beta?: number;
    priceVolatility?: number; // Annualized price volatility
    priceVolatility_industryPercentile?: number; // 0-100 percentile vs industry
    
    // Data Completeness
    dataCompleteness?: number; // 0-1, 1 = all data available
    yearsOfData?: number; // Years of financial data available
    hasData?: boolean;
  }): number {
    let score = 50; // Base: 50 points
    
    // 1. PROFITABILITY (max ±20 points)
    let profitabilityScore = 0;
    
    // ROIC vs WACC
    if (metrics.roic !== undefined && metrics.wacc !== undefined) {
      const roicWaccSpread = metrics.roic - metrics.wacc;
      if (roicWaccSpread >= 5) {
        profitabilityScore += 12; // +12 if ROIC ≥ WACC+5%
      } else if (roicWaccSpread >= 2) {
        profitabilityScore += 6; // +6 if ROIC ≥ WACC+2%
      } else if (roicWaccSpread >= -2) {
        profitabilityScore += 0; // 0 if ±2%
      } else if (roicWaccSpread >= -5) {
        profitabilityScore -= 6; // -6 if ROIC ≤ WACC-2%
      } else {
        profitabilityScore -= 12; // -12 if ROIC ≤ WACC-5%
      }
    }
    
    // Operating margin (5y avg) vs industry
    if (metrics.operatingMargin_industryPercentile !== undefined) {
      const percentile = metrics.operatingMargin_industryPercentile;
      if (percentile >= 75) {
        profitabilityScore += 8; // Top quartile
      } else if (percentile >= 50) {
        profitabilityScore += 4; // Above median
      } else if (percentile >= 25) {
        profitabilityScore += 0; // Below median
      } else {
        profitabilityScore -= 8; // Bottom quartile
      }
    } else if (metrics.operatingMargin_5yAvg !== undefined) {
      // Fallback to absolute thresholds if no industry data
      const margin = metrics.operatingMargin_5yAvg;
      if (margin >= 20) profitabilityScore += 8;
      else if (margin >= 15) profitabilityScore += 4;
      else if (margin >= 10) profitabilityScore += 0;
      else if (margin >= 5) profitabilityScore -= 4;
      else profitabilityScore -= 8;
    }
    
    score += Math.max(-20, Math.min(20, profitabilityScore)); // Cap at ±20
    
    // 2. EARNINGS QUALITY (max ±12 points)
    let earningsQualityScore = 0;
    
    // Accruals ratio (CFO/Net Income)
    if (metrics.accrualsRatio !== undefined) {
      if (metrics.accrualsRatio >= 1.1) {
        earningsQualityScore += 6; // High quality earnings
      } else if (metrics.accrualsRatio >= 0.9) {
        earningsQualityScore += 3;
      } else if (metrics.accrualsRatio >= 0.7) {
        earningsQualityScore -= 3;
      } else {
        earningsQualityScore -= 6; // Low quality
      }
    }
    
    // FCF/Net Income (5y avg)
    if (metrics.fcfNetIncome_5yAvg !== undefined) {
      if (metrics.fcfNetIncome_5yAvg >= 1.2) {
        earningsQualityScore += 6;
      } else if (metrics.fcfNetIncome_5yAvg >= 1.0) {
        earningsQualityScore += 3;
      } else if (metrics.fcfNetIncome_5yAvg >= 0.8) {
        earningsQualityScore -= 3;
      } else {
        earningsQualityScore -= 6;
      }
    }
    
    score += Math.max(-12, Math.min(12, earningsQualityScore)); // Cap at ±12
    
    // 3. BALANCE SHEET STRENGTH (max ±18 points)
    let balanceSheetScore = 0;
    
    // Net debt / EBITDA
    if (metrics.netDebtEBITDA !== undefined) {
      if (metrics.netDebtEBITDA < 1) {
        balanceSheetScore += 8; // <1x
      } else if (metrics.netDebtEBITDA <= 2) {
        balanceSheetScore += 4; // 1-2x
      } else if (metrics.netDebtEBITDA <= 3) {
        balanceSheetScore += 0; // 2-3x
      } else if (metrics.netDebtEBITDA <= 4) {
        balanceSheetScore -= 6; // 3-4x
      } else {
        balanceSheetScore -= 10; // >4x
      }
    }
    
    // Interest coverage
    if (metrics.interestCoverage !== undefined) {
      if (metrics.interestCoverage > 10) {
        balanceSheetScore += 10; // >10x
      } else if (metrics.interestCoverage >= 6) {
        balanceSheetScore += 6; // 6-10x
      } else if (metrics.interestCoverage >= 3) {
        balanceSheetScore += 2; // 3-6x
      } else if (metrics.interestCoverage >= 1.5) {
        balanceSheetScore -= 6; // 1.5-3x
      } else {
        balanceSheetScore -= 10; // <1.5x
      }
    }
    
    score += Math.max(-18, Math.min(18, balanceSheetScore)); // Cap at ±18
    
    // 4. GROWTH DURABILITY (max ±14 points)
    let growthScore = 0;
    
    // Revenue CAGR (5y) vs industry
    if (metrics.revenueCAGR_industryStdDev !== undefined) {
      const stdDev = metrics.revenueCAGR_industryStdDev;
      if (stdDev >= 1) {
        growthScore += 8; // ≥+1σ
      } else if (stdDev >= 0) {
        growthScore += 4; // 0 to +1σ
      } else if (stdDev >= -1) {
        growthScore -= 4; // -1σ to 0
      } else {
        growthScore -= 8; // < -1σ
      }
    } else if (metrics.revenueCAGR_5y !== undefined) {
      // Fallback to absolute growth
      const cagr = metrics.revenueCAGR_5y;
      if (cagr >= 15) growthScore += 8;
      else if (cagr >= 10) growthScore += 4;
      else if (cagr >= 5) growthScore += 0;
      else if (cagr >= 0) growthScore -= 4;
      else growthScore -= 8;
    }
    
    // Revenue volatility (stability)
    if (metrics.revenueVolatility_industryPercentile !== undefined) {
      const percentile = metrics.revenueVolatility_industryPercentile;
      if (percentile <= 25) {
        growthScore += 6; // Bottom quartile (most stable)
      } else if (percentile <= 50) {
        growthScore += 3; // Below median
      } else if (percentile <= 75) {
        growthScore -= 3; // Above median
      } else {
        growthScore -= 6; // Top quartile (most volatile)
      }
    } else if (metrics.revenueVolatility_5y !== undefined) {
      // Fallback to absolute volatility
      const vol = metrics.revenueVolatility_5y;
      if (vol <= 0.10) growthScore += 6; // Very stable
      else if (vol <= 0.15) growthScore += 3;
      else if (vol <= 0.25) growthScore -= 3;
      else growthScore -= 6; // Very volatile
    }
    
    score += Math.max(-14, Math.min(14, growthScore)); // Cap at ±14
    
    // 5. CAPITAL ALLOCATION (max ±10 points)
    let capitalAllocScore = 0;
    
    // Reinvestment efficiency
    if (metrics.reinvestmentEfficiency_industryPercentile !== undefined) {
      const percentile = metrics.reinvestmentEfficiency_industryPercentile;
      if (percentile >= 75) capitalAllocScore += 6; // Top quartile
      else if (percentile >= 50) capitalAllocScore += 3; // Above median
      else if (percentile >= 25) capitalAllocScore -= 3; // Below median
      else capitalAllocScore -= 6; // Bottom quartile
    } else if (metrics.reinvestmentEfficiency !== undefined) {
      // Fallback to absolute
      const eff = metrics.reinvestmentEfficiency;
      if (eff >= 0.5) capitalAllocScore += 6;
      else if (eff >= 0.3) capitalAllocScore += 3;
      else if (eff >= 0.1) capitalAllocScore -= 3;
      else capitalAllocScore -= 6;
    }
    
    // Shareholder returns
    if (metrics.shareholderReturns_pctFCF !== undefined) {
      const pct = metrics.shareholderReturns_pctFCF;
      const isLeverageRising = metrics.netDebtEBITDA_trend === 'rising';
      
      if (pct >= 30 && pct <= 70 && !isLeverageRising) {
        capitalAllocScore += 4; // Balanced returns
      } else if ((pct >= 0 && pct < 30) || (pct > 70 && pct <= 90)) {
        capitalAllocScore += 0; // Neutral
      } else if (pct > 90 && isLeverageRising) {
        capitalAllocScore -= 4; // Excessive returns with rising leverage
      }
    }
    
    score += Math.max(-10, Math.min(10, capitalAllocScore)); // Cap at ±10
    
    // 6. RISK/VOLATILITY (max ±12 points)
    let riskScore = 0;
    
    // Beta
    if (metrics.beta !== undefined) {
      if (metrics.beta >= 0.6 && metrics.beta <= 1.0) {
        riskScore += 4; // Moderate beta
      } else if (metrics.beta > 1.2) {
        riskScore -= 4; // High beta
      } else if (metrics.beta < 0.6) {
        riskScore -= 2; // Very low beta (may indicate issues)
      }
    }
    
    // Price volatility vs industry
    if (metrics.priceVolatility_industryPercentile !== undefined) {
      const percentile = metrics.priceVolatility_industryPercentile;
      if (percentile <= 25) riskScore += 8; // Bottom quartile (most stable)
      else if (percentile <= 50) riskScore += 4; // Below median
      else if (percentile <= 75) riskScore -= 4; // Above median
      else riskScore -= 8; // Top quartile (most volatile)
    } else if (metrics.priceVolatility !== undefined) {
      // Fallback to absolute volatility
      const vol = metrics.priceVolatility;
      if (vol <= 0.15) riskScore += 8; // Very stable
      else if (vol <= 0.25) riskScore += 4;
      else if (vol <= 0.35) riskScore += 0;
      else if (vol <= 0.50) riskScore -= 4;
      else riskScore -= 8; // Very volatile
    }
    
    score += Math.max(-12, Math.min(12, riskScore)); // Cap at ±12
    
    // 7. DATA COMPLETENESS (penalty up to -10)
    if (metrics.dataCompleteness !== undefined) {
      const completeness = metrics.dataCompleteness;
      if (completeness < 0.5) {
        score -= 10; // Missing >50% of data
      } else if (completeness < 0.7) {
        score -= 7; // Missing 30-50%
      } else if (completeness < 0.9) {
        score -= 5; // Missing 10-30%
      }
    } else if (metrics.yearsOfData !== undefined) {
      if (metrics.yearsOfData < 3) {
        score -= 8; // Less than 3 years
      } else if (metrics.yearsOfData < 5) {
        score -= 5; // Less than 5 years
      }
    } else if (metrics.hasData === false) {
      score -= 10; // No data available
    }
    
    return Math.max(0, Math.min(100, score));
  }

  static calculateFragility(sensitivityData: {
    wacc_range: [number, number];
    price_range: [number, number];
    base_price: number;
  }): number {
    const priceRange = sensitivityData.price_range[1] - sensitivityData.price_range[0];
    const waccRange = sensitivityData.wacc_range[1] - sensitivityData.wacc_range[0];

    if (waccRange <= 0 || sensitivityData.base_price <= 0) return 0;

    // Use percentage swing per 1% WACC change to avoid huge penalties
    const priceSwingPct = (priceRange / sensitivityData.base_price) * 100;
    const waccRangePct = waccRange * 100;
    const fragilityRatio = priceSwingPct / waccRangePct; // % price move per 1% WACC

    // Softer scaling and cap so fragility doesn't dominate the score
    const raw = fragilityRatio * 5;
    return Math.max(0, Math.min(30, raw));
  }

  static calculateRiskFlags(riskMetrics: {
    max_drawdown?: number;
    volatility?: number;
    beta?: number;
    var_95?: number;
  }): number {
    let penalty = 0;

    if (riskMetrics.max_drawdown && riskMetrics.max_drawdown > 0.3) {
      penalty += 10; // High drawdown
    }

    if (riskMetrics.volatility && riskMetrics.volatility > 0.4) {
      penalty += 10; // High volatility
    }

    if (riskMetrics.beta && riskMetrics.beta > 1.5) {
      penalty += 5; // High beta
    }

    if (riskMetrics.var_95 && riskMetrics.var_95 > 0.05) {
      penalty += 5; // High VaR
    }

    return penalty;
  }

  static calculateUnifiedScore(inputs: {
    dcf_upside_downside?: number;
    momentum_score?: number;
    sentiment_score?: number;
    quality_metrics?: {
      marketCap?: number;
      avgVolume?: number;
      exchange?: string;
      priceVolatility?: number;
      priceMomentum?: number;
      yearsSinceIPO?: number;
      currentPrice?: number;
      hasData?: boolean;
    };
    sensitivity_data?: {
      wacc_range: [number, number];
      price_range: [number, number];
      base_price: number;
    };
    risk_metrics?: {
      max_drawdown?: number;
      volatility?: number;
      beta?: number;
      var_95?: number;
    };
  }): UnifiedScore {
    const components: ScoreComponents = {
      dcf_upside: inputs.dcf_upside_downside !== undefined
        ? this.calculateDCFUpside(inputs.dcf_upside_downside)
        : 50,
      momentum: inputs.momentum_score !== undefined
        ? Math.max(0, Math.min(100, inputs.momentum_score))
        : 50,
      sentiment: inputs.sentiment_score !== undefined
        ? this.calculateSentiment(inputs.sentiment_score)
        : 50,
      quality: inputs.quality_metrics
        ? this.calculateQuality(inputs.quality_metrics)
        : 50,
      risk_flags: inputs.risk_metrics
        ? this.calculateRiskFlags(inputs.risk_metrics)
        : 0,
      fragility: inputs.sensitivity_data
        ? this.calculateFragility(inputs.sensitivity_data)
        : 0,
    };

    // Calculate overall score (weighted average minus penalties)
    const weights = {
      dcf: 0.30,
      momentum: 0.20,
      sentiment: 0.20,
      quality: 0.30,
    };

    let overallScore =
      components.dcf_upside * weights.dcf +
      components.momentum * weights.momentum +
      components.sentiment * weights.sentiment +
      components.quality * weights.quality;

    // Subtract penalties
    overallScore -= components.risk_flags;
    // Fragility is an informative penalty but should not dominate the score.
    // Use a gentle 0.25x weight so a max fragility of 40 can subtract up to 10 points.
    overallScore -= components.fragility * 0.25;

    overallScore = Math.max(0, Math.min(100, overallScore));

    // Determine flags
    const flags = {
      high_fragility: components.fragility > 20,
      high_risk: components.risk_flags > 15,
      negative_sentiment: components.sentiment < 40,
      negative_momentum: components.momentum < 40,
    };

    // Determine recommendation
    let recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    if (overallScore >= 80) {
      recommendation = 'strong_buy';
    } else if (overallScore >= 65) {
      recommendation = 'buy';
    } else if (overallScore >= 45) {
      recommendation = 'hold';
    } else if (overallScore >= 30) {
      recommendation = 'sell';
    } else {
      recommendation = 'strong_sell';
    }

    return {
      overall_score: overallScore,
      components,
      flags,
      recommendation,
    };
  }
}

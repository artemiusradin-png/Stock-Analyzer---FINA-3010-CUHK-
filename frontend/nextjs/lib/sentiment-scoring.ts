// Robust Sentiment Scoring Engine
// Implements comprehensive methodology for analyzing hundreds of news articles

export interface NewsArticle {
  headline: string;
  summary?: string;
  source: string;
  datetime?: number;
  url?: string;
  _source_type?: 'finnhub' | 'yahoo';
}

export interface ScoredArticle {
  article: NewsArticle;
  rawSentiment: number; // -1 to +1 from NLP
  recencyWeight: number;
  sourceWeight: number;
  impactWeight: number;
  intensityWeight: number;
  weightedSentiment: number;
  finalScore: number; // 0-100
}

export interface SentimentAnalysisResult {
  overallScore: number; // 0-100
  sentimentLabel: string;
  confidence: number; // 0-1
  articleCount: number;
  qualityFlag: 'sufficient' | 'low_volume' | 'insufficient_data';
  momentum: number; // -10 to +10 (momentum adjustment)
  reputableSources: string[];
  keyThemes: string[];
  scoredArticles: ScoredArticle[];
  redFlags: string[];
}

export class SentimentScoringEngine {
  // Source credibility tiers
  // Tier 1: top global outlets – max 34% of decision weight
  private static readonly TIER_1_SOURCES = [
    'financial times', 'ft.com', 'ft ',
    'bloomberg',
    'wall street journal', 'the wall street journal', 'wsj',
    'reuters',
    'forbes'
  ];
  
  // Tier 2: major finance/business media – max 33% of decision weight
  private static readonly TIER_2_SOURCES = [
    'yahoo finance', 'yahoo!',
    'cnbc',
    'finnhub',
    'marketwatch',
    'barron\'s', 'barrons', 'barrons.com',
    'business insider',
    'seeking alpha',
    'motley fool', 'the motley fool',
  ];
  
  // Tier 3: other popular finance sites / blogs – max 33% of decision weight
  private static readonly TIER_3_SOURCES = [
    'the street', 'thestreet',
    'investing.com', 'investing ',
    'nasdaq',
    'morningstar',
    'fool.com',
    'tipranks',
    'zacks',
    'benzinga'
  ];

  // Impact keywords (major news indicators)
  private static readonly MAJOR_IMPACT_KEYWORDS = [
    'earnings', 'revenue', 'profit', 'loss', 'quarter', 'guidance',
    'merger', 'acquisition', 'm&a', 'buyout', 'takeover',
    'ceo', 'executive', 'leadership', 'resignation', 'appointment',
    'ipo', 'stock split', 'dividend', 'buyback',
    'lawsuit', 'regulatory', 'sec', 'fda', 'approval', 'rejection'
  ];
  
  private static readonly PRODUCT_ANNOUNCEMENT_KEYWORDS = [
    'launch', 'release', 'product', 'service', 'innovation', 'technology',
    'partnership', 'deal', 'contract', 'agreement', 'expansion'
  ];
  
  private static readonly ANALYST_KEYWORDS = [
    'upgrade', 'downgrade', 'rating', 'price target', 'analyst', 'maintain',
    'initiate', 'coverage', 'outperform', 'underperform', 'buy', 'sell', 'hold'
  ];

  // Intensity keywords
  private static readonly STRONG_POSITIVE = [
    'revolutionary', 'breakthrough', 'exceptional', 'outstanding', 'triumph',
    'surge', 'soar', 'skyrocket', 'rally', 'boom'
  ];
  
  private static readonly STRONG_NEGATIVE = [
    'catastrophic', 'collapse', 'crash', 'plunge', 'devastating',
    'crisis', 'scandal', 'failure', 'bankruptcy', 'default'
  ];
  
  private static readonly MODERATE_KEYWORDS = [
    'improved', 'declined', 'gained', 'lost', 'increased', 'decreased',
    'growth', 'decline', 'better', 'worse', 'strong', 'weak'
  ];

  /**
   * Calculate recency weight (40% of total)
   */
  private static getRecencyWeight(articleDate: number | undefined): number {
    if (!articleDate) return 0.5; // Unknown date gets lower weight
    
    const now = Date.now() / 1000; // Convert to seconds
    const ageInDays = (now - articleDate) / (24 * 60 * 60);
    
    if (ageInDays <= 7) return 1.0;      // Last 7 days: 100%
    if (ageInDays <= 30) return 0.7;     // 8-30 days: 70%
    if (ageInDays <= 90) return 0.4;     // 31-90 days: 40%
    return 0.2;                           // 90+ days: 20%
  }

  /**
   * Map source to qualitative tier (1, 2, 3).
   * Unknown sources are treated as Tier 3 (lowest, but still capped).
   */
  private static getSourceTier(source: string): 1 | 2 | 3 {
    const sourceLower = source.toLowerCase();
    
    // Check tier 1
    for (const tier1 of this.TIER_1_SOURCES) {
      if (sourceLower.includes(tier1)) return 1;
    }
    
    // Check tier 2
    for (const tier2 of this.TIER_2_SOURCES) {
      if (sourceLower.includes(tier2)) return 2;
    }
    
    // Check tier 3
    for (const tier3 of this.TIER_3_SOURCES) {
      if (sourceLower.includes(tier3)) return 3;
    }
    
    // Default: treat as Tier 3 / long tail
    return 3;
  }
  
  /**
   * Legacy per-article source weight (kept for debugging / article-level display).
   * Internally, tier caps are enforced at aggregation level.
   */
  private static getSourceWeight(source: string): number {
    const tier = this.getSourceTier(source);
    if (tier === 1) return 1.0;
    if (tier === 2) return 0.85;
    return 0.70; // Tier 3 / unknown
  }

  /**
   * Calculate article impact weight (20% of total)
   */
  private static getImpactWeight(article: NewsArticle): number {
    const text = `${article.headline} ${article.summary || ''}`.toLowerCase();
    
    // Major news (earnings, M&A, CEO changes)
    for (const keyword of this.MAJOR_IMPACT_KEYWORDS) {
      if (text.includes(keyword)) return 1.0;
    }
    
    // Analyst upgrades/downgrades
    for (const keyword of this.ANALYST_KEYWORDS) {
      if (text.includes(keyword)) return 0.85;
    }
    
    // Product/service announcements
    for (const keyword of this.PRODUCT_ANNOUNCEMENT_KEYWORDS) {
      if (text.includes(keyword)) return 0.75;
    }
    
    // General mentions
    return 0.50;
  }

  /**
   * Calculate sentiment intensity weight (15% of total)
   */
  private static getIntensityWeight(article: NewsArticle): number {
    const text = `${article.headline} ${article.summary || ''}`.toLowerCase();
    
    // Strong positive/negative language
    for (const keyword of [...this.STRONG_POSITIVE, ...this.STRONG_NEGATIVE]) {
      if (text.includes(keyword)) return 1.0;
    }
    
    // Moderate language
    for (const keyword of this.MODERATE_KEYWORDS) {
      if (text.includes(keyword)) return 0.70;
    }
    
    // Mild language (default)
    return 0.40;
  }

  /**
   * Extract raw sentiment from article using keyword analysis
   * Returns -1 to +1
   */
  private static extractRawSentiment(article: NewsArticle): number {
    const text = `${article.headline} ${article.summary || ''}`.toLowerCase();
    
    const positiveKeywords = [
      'growth', 'profit', 'gain', 'up', 'rise', 'strong', 'beat', 'exceed',
      'surge', 'rally', 'positive', 'bullish', 'outperform', 'upgrade',
      'success', 'win', 'improve', 'expand', 'launch', 'innovative'
    ];
    
    const negativeKeywords = [
      'loss', 'decline', 'down', 'fall', 'weak', 'miss', 'drop', 'plunge',
      'crash', 'warn', 'negative', 'bearish', 'underperform', 'downgrade',
      'fail', 'cut', 'reduce', 'close', 'delay', 'investigation'
    ];
    
    let posCount = 0;
    let negCount = 0;
    
    for (const kw of positiveKeywords) {
      if (text.includes(kw)) posCount++;
    }
    
    for (const kw of negativeKeywords) {
      if (text.includes(kw)) negCount++;
    }
    
    const total = posCount + negCount;
    if (total === 0) return 0;
    
    // Raw sentiment: -1 to +1
    const raw = (posCount - negCount) / total;
    
    // Soften extreme values (tanh-like)
    return raw / (1 + Math.abs(raw));
  }

  /**
   * Calculate momentum (compare current 30-day vs previous 30-day sentiment)
   * Returns -10 to +10 adjustment
   */
  private static calculateMomentum(
    recentArticles: NewsArticle[],
    olderArticles: NewsArticle[]
  ): number {
    if (olderArticles.length === 0) return 0;
    
    // Calculate average sentiment for recent period
    const recentScore = this.calculateAverageSentiment(recentArticles);
    
    // Calculate average sentiment for previous period
    const olderScore = this.calculateAverageSentiment(olderArticles);
    
    const diff = recentScore - olderScore;
    
    // Convert to momentum adjustment (-10 to +10)
    // Significant change (20+ points) = 10 adjustment
    // Moderate change (10-20 points) = 5 adjustment
    // Small change (<10 points) = proportional
    
    if (Math.abs(diff) >= 20) {
      return diff > 0 ? 10 : -10;
    } else if (Math.abs(diff) >= 10) {
      return diff > 0 ? 5 : -5;
    } else {
      return Math.round((diff / 10) * 5);
    }
  }

  /**
   * Calculate average sentiment for a group of articles
   */
  private static calculateAverageSentiment(articles: NewsArticle[]): number {
    if (articles.length === 0) return 50; // Neutral default
    
    // Tier-based aggregation with caps:
    // Tier 1: max 34%, Tier 2: max 33%, Tier 3: max 33% of decision weight.
    const tierWeighted: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    const tierWeights: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    
    for (const article of articles) {
      const rawSentiment = this.extractRawSentiment(article); // -1..1
      const recencyWeight = this.getRecencyWeight(article.datetime);
      const impactWeight = this.getImpactWeight(article);
      const intensityWeight = this.getIntensityWeight(article);
      const tier = this.getSourceTier(article.source);
      
      // Base qualitative weight (no source multiplier here – tier handles that)
      const baseWeight = recencyWeight * impactWeight * intensityWeight;
      if (baseWeight <= 0) continue;
      
      tierWeighted[tier] += rawSentiment * baseWeight;
      tierWeights[tier] += baseWeight;
    }
    
    const totalBase = tierWeights[1] + tierWeights[2] + tierWeights[3];
    if (totalBase === 0) return 50;
    
    // Per-tier average sentiments (-1..1)
    const tierAvg: Record<1 | 2 | 3, number> = {
      1: tierWeights[1] > 0 ? tierWeighted[1] / tierWeights[1] : 0,
      2: tierWeights[2] > 0 ? tierWeighted[2] / tierWeights[2] : 0,
      3: tierWeights[3] > 0 ? tierWeighted[3] / tierWeights[3] : 0,
    };
    
    // Raw share by qualitative weight
    const tierShare: Record<1 | 2 | 3, number> = {
      1: tierWeights[1] / totalBase,
      2: tierWeights[2] / totalBase,
      3: tierWeights[3] / totalBase,
    };
    
    // Caps: Tier 1 max 34%, Tier 2 max 33%, Tier 3 max 33%
    const caps: Record<1 | 2 | 3, number> = { 1: 0.34, 2: 0.33, 3: 0.33 };
    
    const cappedShare: Record<1 | 2 | 3, number> = {
      1: Math.min(tierShare[1], caps[1]),
      2: Math.min(tierShare[2], caps[2]),
      3: Math.min(tierShare[3], caps[3]),
    };
    
    const sumCapped = cappedShare[1] + cappedShare[2] + cappedShare[3];
    if (sumCapped === 0) return 50;
    
    // Renormalize so capped shares sum to 1
    const normShare: Record<1 | 2 | 3, number> = {
      1: cappedShare[1] / sumCapped,
      2: cappedShare[2] / sumCapped,
      3: cappedShare[3] / sumCapped,
    };
    
    // Final average sentiment as weighted sum of tier averages
    const avgRaw =
      tierAvg[1] * normShare[1] +
      tierAvg[2] * normShare[2] +
      tierAvg[3] * normShare[3];
    
    // Map from [-1,1] -> [0,100]
    return 50 + avgRaw * 50;
  }

  /**
   * Detect outliers (>2 standard deviations from mean)
   */
  private static removeOutliers(scores: number[]): number[] {
    if (scores.length < 3) return scores;
    
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    
    const threshold = 2 * stdDev;
    return scores.filter(s => Math.abs(s - mean) <= threshold);
  }

  /**
   * Detect red flags
   */
  private static detectRedFlags(
    articles: NewsArticle[],
    currentScore: number,
    previousScore: number | null
  ): string[] {
    const flags: string[] = [];
    
    // Sudden drop of >30 points
    if (previousScore !== null && currentScore < previousScore - 30) {
      flags.push(`Sentiment dropped ${Math.round(previousScore - currentScore)} points`);
    }
    
    // High volume of conflicting sentiments
    const positiveArticles = articles.filter(a => this.extractRawSentiment(a) > 0.15);
    const negativeArticles = articles.filter(a => this.extractRawSentiment(a) < -0.15);
    
    if (positiveArticles.length > 5 && negativeArticles.length > 5) {
      flags.push('High volume of conflicting sentiments detected');
    }
    
    // Rapid change (>20 points in 7 days)
    const recent7Days = articles.filter(a => {
      if (!a.datetime) return false;
      const ageInDays = (Date.now() / 1000 - a.datetime) / (24 * 60 * 60);
      return ageInDays <= 7;
    });
    
    if (previousScore !== null && recent7Days.length > 0) {
      const recentScore = this.calculateAverageSentiment(recent7Days);
      if (Math.abs(recentScore - previousScore) > 20) {
        flags.push(`Rapid sentiment change detected (${Math.round(recentScore - previousScore)} points)`);
      }
    }
    
    return flags;
  }

  /**
   * Main scoring function
   */
  static scoreSentiment(
    articles: NewsArticle[],
    previousScore: number | null = null
  ): SentimentAnalysisResult {
    if (articles.length === 0) {
      return {
        overallScore: 50,
        sentimentLabel: 'Neutral',
        confidence: 0,
        articleCount: 0,
        qualityFlag: 'insufficient_data',
        momentum: 0,
        reputableSources: [],
        keyThemes: [],
        scoredArticles: [],
        redFlags: [],
      };
    }

    // Filter articles with valid dates and sort by date (newest first)
    const validArticles = articles
      .filter(a => a.datetime)
      .sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
    
    const now = Date.now() / 1000;
    const recentArticles = validArticles.filter(a => {
      const ageInDays = (now - (a.datetime || 0)) / (24 * 60 * 60);
      return ageInDays <= 30;
    });
    
    const olderArticles = validArticles.filter(a => {
      const ageInDays = (now - (a.datetime || 0)) / (24 * 60 * 60);
      return ageInDays > 30 && ageInDays <= 60;
    });

    // Quality check: minimum article threshold
    const articlesLast90Days = validArticles.filter(a => {
      const ageInDays = (now - (a.datetime || 0)) / (24 * 60 * 60);
      return ageInDays <= 90;
    });

    let qualityFlag: 'sufficient' | 'low_volume' | 'insufficient_data';
    if (articlesLast90Days.length < 10) {
      qualityFlag = articlesLast90Days.length === 0 ? 'insufficient_data' : 'low_volume';
    } else {
      qualityFlag = 'sufficient';
    }

    // Score each article
    const scoredArticles: ScoredArticle[] = validArticles.map(article => {
      const rawSentiment = this.extractRawSentiment(article);
      const recencyWeight = this.getRecencyWeight(article.datetime);
      const sourceWeight = this.getSourceWeight(article.source);
      const impactWeight = this.getImpactWeight(article);
      const intensityWeight = this.getIntensityWeight(article);
      
      // Weighted sentiment: raw * all weights
      const weightedSentiment = rawSentiment * recencyWeight * sourceWeight * impactWeight * intensityWeight;
      
      // Final score: 50 + (weighted_sentiment * 50)
      // This maps [-1, 1] range to [0, 100] range
      const finalScore = 50 + (weightedSentiment * 50);
      
      return {
        article,
        rawSentiment,
        recencyWeight,
        sourceWeight,
        impactWeight,
        intensityWeight,
        weightedSentiment,
        finalScore,
      };
    });

    // Extract scores and remove outliers
    const articleScores = scoredArticles.map(s => s.finalScore);
    const filteredScores = this.removeOutliers(articleScores);
    
    // Tier-based aggregation for overall score (uses raw sentiment + qualitative weights)
    const tierWeighted: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    const tierWeights: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    
    scoredArticles.forEach((scored) => {
      if (!filteredScores.includes(scored.finalScore)) return;
      const tier = this.getSourceTier(scored.article.source);
      const baseWeight =
        scored.recencyWeight * scored.impactWeight * scored.intensityWeight;
      if (baseWeight <= 0) return;
      tierWeighted[tier] += scored.rawSentiment * baseWeight;
      tierWeights[tier] += baseWeight;
    });
    
    const totalBase = tierWeights[1] + tierWeights[2] + tierWeights[3];
    // Fallback to neutral if no usable weight
    let averageScore = 50;
    if (totalBase > 0) {
      const tierAvg: Record<1 | 2 | 3, number> = {
        1: tierWeights[1] > 0 ? tierWeighted[1] / tierWeights[1] : 0,
        2: tierWeights[2] > 0 ? tierWeighted[2] / tierWeights[2] : 0,
        3: tierWeights[3] > 0 ? tierWeighted[3] / tierWeights[3] : 0,
      };
      const tierShare: Record<1 | 2 | 3, number> = {
        1: tierWeights[1] / totalBase,
        2: tierWeights[2] / totalBase,
        3: tierWeights[3] / totalBase,
      };
      const caps: Record<1 | 2 | 3, number> = { 1: 0.34, 2: 0.33, 3: 0.33 };
      const cappedShare: Record<1 | 2 | 3, number> = {
        1: Math.min(tierShare[1], caps[1]),
        2: Math.min(tierShare[2], caps[2]),
        3: Math.min(tierShare[3], caps[3]),
      };
      const sumCapped = cappedShare[1] + cappedShare[2] + cappedShare[3];
      if (sumCapped > 0) {
        const normShare: Record<1 | 2 | 3, number> = {
          1: cappedShare[1] / sumCapped,
          2: cappedShare[2] / sumCapped,
          3: cappedShare[3] / sumCapped,
        };
        const avgRaw =
          tierAvg[1] * normShare[1] +
          tierAvg[2] * normShare[2] +
          tierAvg[3] * normShare[3];
        averageScore = 50 + avgRaw * 50;
      }
    }

    // Calculate momentum
    const momentum = this.calculateMomentum(recentArticles, olderArticles);
    
    // Apply momentum adjustment
    const finalScore = Math.max(0, Math.min(100, averageScore + momentum));

    // Determine sentiment label
    let sentimentLabel: string;
    if (finalScore >= 81) sentimentLabel = 'Very Positive';
    else if (finalScore >= 61) sentimentLabel = 'Positive';
    else if (finalScore >= 41) sentimentLabel = 'Neutral/Mixed';
    else if (finalScore >= 21) sentimentLabel = 'Negative';
    else sentimentLabel = 'Very Negative';

    // Calculate confidence based on volume
    let confidence: number;
    const articleCount = articlesLast90Days.length;
    if (articleCount >= 50) confidence = 1.0;
    else if (articleCount >= 10) confidence = 0.85;
    else if (articleCount >= 5) confidence = 0.65;
    else confidence = 0.40;

    // Identify reputable sources
    const reputableSourcesSet = new Set<string>();
    scoredArticles.forEach(scored => {
      if (scored.sourceWeight >= 0.85) {
        reputableSourcesSet.add(scored.article.source);
      }
    });
    const reputableSources = Array.from(reputableSourcesSet);

    // Extract key themes (simplified - could be enhanced with NLP)
    const keyThemes = this.extractKeyThemes(validArticles.slice(0, 20));

    // Detect red flags
    const redFlags = this.detectRedFlags(validArticles, finalScore, previousScore);

    return {
      overallScore: Math.round(finalScore * 10) / 10, // Round to 1 decimal
      sentimentLabel,
      confidence,
      articleCount: articleCount,
      qualityFlag,
      momentum,
      reputableSources,
      keyThemes,
      scoredArticles: scoredArticles.slice(0, 20), // Top 20 for response
      redFlags,
    };
  }

  /**
   * Extract key themes from articles (simplified version)
   */
  private static extractKeyThemes(articles: NewsArticle[]): string[] {
    const themeKeywords: Record<string, number> = {};
    
    const themes = [
      'earnings', 'revenue', 'profit', 'guidance',
      'product', 'launch', 'innovation', 'technology',
      'partnership', 'expansion', 'acquisition', 'merger',
      'analyst', 'upgrade', 'downgrade', 'rating',
      'regulatory', 'compliance', 'lawsuit', 'approval'
    ];
    
    for (const article of articles) {
      const text = `${article.headline} ${article.summary || ''}`.toLowerCase();
      for (const theme of themes) {
        if (text.includes(theme)) {
          themeKeywords[theme] = (themeKeywords[theme] || 0) + 1;
        }
      }
    }
    
    // Return top 5 themes
    return Object.entries(themeKeywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme]) => theme);
  }
}

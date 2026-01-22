/**
 * Research Cache Utility
 * 
 * Caches research results (DCF, sentiment, risk, overview) in localStorage
 * with TTL (time-to-live) to avoid redundant API calls.
 */

export interface CachedResearchData {
  ticker: string;
  data: any;
  timestamp: number;
  ttl: number; // Time-to-live in milliseconds
}

const CACHE_PREFIX = 'fina3010_research_cache_';
const DEFAULT_TTL = {
  overview: 24 * 60 * 60 * 1000, // 24 hours
  dcf: 60 * 60 * 1000, // 1 hour
  sentiment: 60 * 60 * 1000, // 1 hour
  risk: 24 * 60 * 60 * 1000, // 24 hours
};

export type ResearchType = 'overview' | 'dcf' | 'sentiment' | 'risk';

/**
 * Get cached research data for a ticker and type
 * Returns null if cache miss or expired
 */
export function getCachedResearch(
  ticker: string,
  type: ResearchType
): any | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = `${CACHE_PREFIX}${type}_${ticker.toUpperCase()}`;
    const cached = localStorage.getItem(key);
    
    if (!cached) return null;

    const parsed: CachedResearchData = JSON.parse(cached);
    const now = Date.now();
    const age = now - parsed.timestamp;

    // Check if expired
    if (age > parsed.ttl) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.warn('Failed to read cache:', error);
    return null;
  }
}

/**
 * Save research data to cache
 */
export function saveCachedResearch(
  ticker: string,
  type: ResearchType,
  data: any
): void {
  if (typeof window === 'undefined') return;

  const key = `${CACHE_PREFIX}${type}_${ticker.toUpperCase()}`;
  const ttl = DEFAULT_TTL[type];
  
  const cacheEntry: CachedResearchData = {
    ticker: ticker.toUpperCase(),
    data,
    timestamp: Date.now(),
    ttl,
  };

  try {
    localStorage.setItem(key, JSON.stringify(cacheEntry));
  } catch (error) {
    console.warn('Failed to save cache:', error);
    // If localStorage is full, try to clear old entries
    if (error instanceof DOMException && error.code === 22) {
      clearExpiredCache();
      // Retry once
      try {
        localStorage.setItem(key, JSON.stringify(cacheEntry));
      } catch (retryError) {
        console.warn('Failed to save cache after cleanup:', retryError);
      }
    }
  }
}

/**
 * Clear all expired cache entries
 */
export function clearExpiredCache(): void {
  if (typeof window === 'undefined') return;

  try {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CACHE_PREFIX)) continue;

      try {
        const cached = localStorage.getItem(key);
        if (!cached) continue;

        const parsed: CachedResearchData = JSON.parse(cached);
        const age = now - parsed.timestamp;

        if (age > parsed.ttl) {
          keysToRemove.push(key);
        }
      } catch {
        // Invalid cache entry, remove it
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed to clear expired cache:', error);
  }
}

/**
 * Clear all research cache (for a specific ticker or all)
 */
export function clearResearchCache(ticker?: string): void {
  if (typeof window === 'undefined') return;

  try {
    if (ticker) {
      const upperTicker = ticker.toUpperCase();
      Object.keys(DEFAULT_TTL).forEach((type) => {
        const key = `${CACHE_PREFIX}${type}_${upperTicker}`;
        localStorage.removeItem(key);
      });
    } else {
      // Clear all research cache
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }
  } catch (error) {
    console.warn('Failed to clear cache:', error);
  }
}

/**
 * Check if cached data exists and is fresh
 */
export function isCachedResearchFresh(
  ticker: string,
  type: ResearchType
): boolean {
  return getCachedResearch(ticker, type) !== null;
}

import { clamp } from './utils';

type PricePoint = {
  date: string;
  close: number;
};

type MomentumComponent = {
  value: number;
  available: boolean;
};

export type MomentumScore = {
  ticker: string;
  asOf: string;
  score0to100: number;
  rawScore: number;
  components: {
    sixMonthReturn: MomentumComponent;
    twelveMonthExRecent: MomentumComponent;
    trendStrength: MomentumComponent;
  };
};

const WEIGHTS = {
  sixMonth: 0.4,
  twelveExRecent: 0.4,
  trend: 0.2,
};

const lookbacks = {
  oneMonth: 21, // ~21 trading days
  sixMonth: 126, // ~6 months of trading days
  twelveMonth: 252, // ~12 months of trading days
  sma: 200, // 200-day SMA
};

function getLookbackPrice(prices: PricePoint[], days: number): number | undefined {
  if (!prices.length || prices.length <= days) return undefined;
  return prices[prices.length - 1 - days]?.close;
}

function simpleMovingAverage(prices: PricePoint[], window: number): number | undefined {
  if (prices.length < window) return undefined;
  const slice = prices.slice(prices.length - window);
  const sum = slice.reduce((acc, p) => acc + (p?.close ?? 0), 0);
  return sum / window;
}

export function computeMomentumScore(ticker: string, prices: PricePoint[]): MomentumScore {
  if (!prices || prices.length === 0) {
    throw new Error('No price history provided');
  }

  // Ensure prices are sorted ascending by date (oldest -> newest)
  const sorted = [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latest = sorted[sorted.length - 1];

  const priceToday = latest.close;
  const price6M = getLookbackPrice(sorted, lookbacks.sixMonth);
  const price12M = getLookbackPrice(sorted, lookbacks.twelveMonth);
  const price1M = getLookbackPrice(sorted, lookbacks.oneMonth);
  const sma200 = simpleMovingAverage(sorted, lookbacks.sma);

  // Component calculations
  const sixMonthReturnRaw = price6M ? priceToday / price6M - 1 : undefined;
  const twelveExRecentRaw = price12M && price1M ? price1M / price12M - 1 : undefined;
  const trendStrengthRaw = sma200 ? priceToday / sma200 - 1 : undefined;

  const sixMonthReturn: MomentumComponent = {
    value: sixMonthReturnRaw !== undefined ? clamp(sixMonthReturnRaw, -1, 1) : 0,
    available: sixMonthReturnRaw !== undefined,
  };
  const twelveMonthExRecent: MomentumComponent = {
    value: twelveExRecentRaw !== undefined ? clamp(twelveExRecentRaw, -1, 1) : 0,
    available: twelveExRecentRaw !== undefined,
  };
  const trendStrength: MomentumComponent = {
    value: trendStrengthRaw !== undefined ? clamp(trendStrengthRaw, -1, 1) : 0,
    available: trendStrengthRaw !== undefined,
  };

  // Weighted score on [-1, 1]
  const rawScore =
    WEIGHTS.sixMonth * sixMonthReturn.value +
    WEIGHTS.twelveExRecent * twelveMonthExRecent.value +
    WEIGHTS.trend * trendStrength.value;

  // Rescale to 0-100
  const score0to100 = ((rawScore + 1) / 2) * 100;

  return {
    ticker: ticker.toUpperCase(),
    asOf: latest.date,
    score0to100,
    rawScore,
    components: {
      sixMonthReturn,
      twelveMonthExRecent,
      trendStrength,
    },
  };
}

import { NextRequest, NextResponse } from 'next/server';
import { FinnhubService } from '@/lib/finnhub-service';

type TradeInput = {
  date: string;
  ticker: string;
  action: 'buy' | 'sell' | 'short_sell';
  quantity: number;
  price: number;
  commission?: number;
};

type PricePoint = { date: string; close: number };

const STARTING_CASH = 100000;
const BENCHMARK = 'SPY';

function generateDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor).toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function buildPriceLookup(prices: PricePoint[]): Map<string, number> {
  const lookup = new Map<string, number>();
  prices.forEach((p) => lookup.set(p.date, p.close));
  return lookup;
}

function getPriceForDate(lookup: Map<string, number>, date: string, lastPrice: number): number {
  return lookup.get(date) ?? lastPrice;
}

function calculateMetrics(equitySeries: number[], benchmarkSeries: number[]) {
  if (!equitySeries.length) {
    return {
      totalReturn: 0,
      benchmarkReturn: 0,
      alpha: 0,
      trackingError: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
    };
  }

  const start = equitySeries[0];
  const end = equitySeries[equitySeries.length - 1];
  const totalReturn = (end - start) / start;

  const bStart = benchmarkSeries[0] || start;
  const bEnd = benchmarkSeries[benchmarkSeries.length - 1] || bStart;
  const benchmarkReturn = bStart ? (bEnd - bStart) / bStart : 0;

  let peak = start;
  let maxDrawdown = 0;
  let currentDrawdown = 0;
  equitySeries.forEach((val) => {
    if (val > peak) peak = val;
    const dd = (val - peak) / peak;
    maxDrawdown = Math.min(maxDrawdown, dd);
    currentDrawdown = dd;
  });

  const activeReturns: number[] = [];
  for (let i = 1; i < equitySeries.length; i++) {
    const rP = (equitySeries[i] - equitySeries[i - 1]) / equitySeries[i - 1];
    const rB = benchmarkSeries[i - 1]
      ? (benchmarkSeries[i] - benchmarkSeries[i - 1]) / benchmarkSeries[i - 1]
      : 0;
    activeReturns.push(rP - rB);
  }

  const meanActive = activeReturns.reduce((s, r) => s + r, 0) / (activeReturns.length || 1);
  const trackingError = Math.sqrt(
    activeReturns.reduce((s, r) => s + Math.pow(r - meanActive, 2), 0) / (activeReturns.length || 1)
  );

  const alpha = totalReturn - benchmarkReturn;

  return { totalReturn, benchmarkReturn, alpha, trackingError, maxDrawdown, currentDrawdown };
}

async function fetchPrices(finnhub: FinnhubService, ticker: string, start: Date, end: Date): Promise<PricePoint[]> {
  try {
    const data = await finnhub.getHistoricalPrices(ticker, start, end, 'D');
    return data.map((d) => ({ date: d.date, close: d.close }));
  } catch (err) {
    console.warn(`Price fetch failed for ${ticker}, using mock data.`, err);
    const dates = generateDateRange(start, end);
    let price = 100;
    return dates.map((d) => {
      price *= 1 + (Math.random() - 0.5) * 0.02;
      return { date: d, close: price };
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const trades: TradeInput[] = Array.isArray(body.trades) ? body.trades : [];

    if (!trades.length) {
      return NextResponse.json({ error: 'Trades are required' }, { status: 400 });
    }

    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const minDate = new Date(sortedTrades[0].date);
    const maxDate = new Date();
    const dateRange = generateDateRange(minDate, maxDate);

    const tickers = Array.from(new Set(sortedTrades.map((t) => t.ticker.toUpperCase())));
    const finnhub = new FinnhubService();

    // Parallelize price fetches for all tickers and benchmark
    const priceMapPerTicker = new Map<string, Map<string, number>>();
    const priceFetchPromises = tickers.map(async (t) => {
      const prices = await fetchPrices(finnhub, t, minDate, maxDate);
      return { ticker: t, lookup: buildPriceLookup(prices) };
    });
    
    // Fetch benchmark in parallel with ticker prices
    const [priceResults, benchmarkPrices] = await Promise.all([
      Promise.all(priceFetchPromises),
      fetchPrices(finnhub, BENCHMARK, minDate, maxDate),
    ]);
    
    // Build price map from parallel results
    priceResults.forEach(({ ticker, lookup }) => {
      priceMapPerTicker.set(ticker, lookup);
    });
    
    const benchmarkLookup = buildPriceLookup(benchmarkPrices);

    const holdings: Record<string, { qty: number; lastPrice: number }> = {};
    let cash = STARTING_CASH;
    const equitySeries: number[] = [];
    const benchmarkSeries: number[] = [];

    let lastBenchmark = benchmarkPrices[0]?.close ?? STARTING_CASH;

    dateRange.forEach((date) => {
      const todaysTrades = sortedTrades.filter((t) => t.date === date);
      todaysTrades.forEach((t) => {
        const ticker = t.ticker.toUpperCase();
        if (!holdings[ticker]) holdings[ticker] = { qty: 0, lastPrice: t.price };
        const commission = t.commission ?? 5;

        if (t.action === 'buy') {
          holdings[ticker].qty += t.quantity;
          cash -= t.quantity * t.price + commission;
        } else if (t.action === 'sell') {
          holdings[ticker].qty -= t.quantity;
          cash += t.quantity * t.price - commission;
        } else if (t.action === 'short_sell') {
          holdings[ticker].qty -= t.quantity;
          cash += t.quantity * t.price - commission;
        }

        holdings[ticker].lastPrice = t.price;
      });

      // mark to market
      let equity = cash;
      for (const [ticker, pos] of Object.entries(holdings)) {
        const lookup = priceMapPerTicker.get(ticker);
        const px = lookup ? getPriceForDate(lookup, date, pos.lastPrice) : pos.lastPrice;
        pos.lastPrice = px;
        equity += pos.qty * px;
      }

      const benchPx = getPriceForDate(benchmarkLookup, date, lastBenchmark);
      lastBenchmark = benchPx;

      equitySeries.push(equity);
      benchmarkSeries.push(benchPx);
    });

    const metrics = calculateMetrics(equitySeries, benchmarkSeries);

    return NextResponse.json({
      start_date: dateRange[0],
      end_date: dateRange[dateRange.length - 1],
      dates: dateRange,
      equitySeries,
      benchmarkSeries,
      metrics,
      benchmark: BENCHMARK,
    });
  } catch (error: any) {
    console.error('Equity performance error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

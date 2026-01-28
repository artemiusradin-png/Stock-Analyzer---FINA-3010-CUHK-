import { NextRequest, NextResponse } from 'next/server';
import { FinnhubService } from '@/lib/finnhub-service';
import { computeMomentumScore } from '@/lib/momentum-score';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ticker = (body?.ticker || '').toString().trim().toUpperCase();

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    const finnhub = new FinnhubService();
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 420); // ~400 trading days to cover lookbacks

    const prices = await finnhub.getHistoricalPrices(ticker, from, to, 'D');

    if (!prices || prices.length < 220) {
      return NextResponse.json(
        { error: 'Insufficient price history to compute momentum score' },
        { status: 400 }
      );
    }

    const score = computeMomentumScore(
      ticker,
      prices.map((p) => ({ date: p.date, close: p.close }))
    );

    return NextResponse.json(score);
  } catch (error: any) {
    console.error('Momentum score error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to compute momentum score' },
      { status: 500 }
    );
  }
}

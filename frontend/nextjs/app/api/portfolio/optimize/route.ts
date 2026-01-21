import { NextRequest, NextResponse } from 'next/server';
import { PortfolioOptimizer, OptimizationStrategy, OptimizationInputs } from '@/lib/portfolio-optimizer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategy, tickers, prices, portfolioValue, riskFreeRate } = body;

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json(
        { error: 'Tickers array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!prices || !Array.isArray(prices) || prices.length !== tickers.length) {
      return NextResponse.json(
        { error: 'Prices array is required and must match tickers length' },
        { status: 400 }
      );
    }

    if (!portfolioValue || portfolioValue <= 0) {
      return NextResponse.json(
        { error: 'Portfolio value must be greater than 0' },
        { status: 400 }
      );
    }

    const validStrategies: OptimizationStrategy[] = [
      'max_sharpe',
      'monte_carlo_sharpe',
      'min_volatility',
      'equal_weight',
      'risk_parity',
      'max_diversification',
    ];

    const selectedStrategy: OptimizationStrategy = validStrategies.includes(strategy)
      ? strategy
      : 'equal_weight';

    // Enforce FINA3010 position-size constraints: 5–10% per asset implies feasibility only when 10–20 assets.
    // We hard-stop here to avoid misleading equal-weight fallbacks (e.g., 20% each with 5 assets).
    const n = tickers.length;
    if (n < 10 || n > 20) {
      return NextResponse.json(
        {
          error:
            `Optimization with 5–10% per-position constraints is only feasible with 10–20 assets. ` +
            `You provided ${n}. Add/remove assets and try again.`,
        },
        { status: 400 }
      );
    }

    const inputs: OptimizationInputs = {
      tickers,
      prices,
      portfolioValue,
      riskFreeRate: riskFreeRate || 0.02,
    };

    // For production: Fetch real historical returns and covariance from Finnhub
    // For now, use the optimizer's built-in estimation
    const result = await PortfolioOptimizer.optimize(selectedStrategy, inputs);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Portfolio optimization error:', error);
    return NextResponse.json(
      { error: `Failed to optimize portfolio: ${error.message}` },
      { status: 500 }
    );
  }
}

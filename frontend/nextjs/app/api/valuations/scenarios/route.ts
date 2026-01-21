import { NextRequest, NextResponse } from 'next/server';
import { DCFEngine, DCFInputs } from '@/lib/dcf-engine';
import { FinnhubService } from '@/lib/finnhub-service';
import { config } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      ticker,
      revenue_override,
      revenue_growth_start,
      ebit_margin_start,
      tax_rate_start,
      revenue_growth_terminal,
      risk_free_rate,
      erp,
      cost_of_debt,
      forecast_period,
      terminal_growth,
    } = body;

    // Similar company data fetching as calculate endpoint
    const finnhubService = new FinnhubService();
    let finnhubProfile;
    let finnhubQuote;
    let finnhubNews: any[] = [];
    try {
      finnhubProfile = await finnhubService.getCompanyProfile(ticker);
      finnhubQuote = await finnhubService.getCompanyQuote(ticker);

      // Use Finnhub company-news for sensitivity context (last 30 days)
      const today = new Date();
      const fromDate = new Date();
      fromDate.setDate(today.getDate() - 30);
      finnhubNews = await finnhubService.getNews(
        ticker,
        fromDate.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      );
    } catch (error) {
      // Continue without Finnhub data
    }

    const companyData = {
      info: finnhubProfile || { ticker },
      market_cap: finnhubProfile?.marketCap || 0,
      current_price: finnhubQuote?.c || finnhubQuote?.pc || 0,
      shares_outstanding: (finnhubProfile?.shareOutstanding || 0) * 1000000,
      beta: 1.0,
      revenue: revenue_override || 0,
      debt: 0,
      cash: 0,
      cost_of_debt: cost_of_debt || 0.04,
    };

    let revenueStart = revenue_override || companyData.revenue || 0;
    if (!revenueStart || revenueStart <= 0) {
      return NextResponse.json(
        { error: 'Unable to determine starting revenue. Please provide revenue_override.' },
        { status: 400 }
      );
    }

    const fcfMargin = ebit_margin_start || 0.20;
    const effTax = tax_rate_start || config.DEFAULT_TAX_RATE;
    const ebitMarginStart = fcfMargin / Math.max(1e-6, 1.0 - effTax);

    let terminalGrowth = terminal_growth || config.DEFAULT_TERMINAL_GROWTH;
    try {
      const rec = await finnhubService.getRecommendationTrend(ticker);
      if (rec && rec.total) {
        const total = parseFloat(rec.total);
        const strongBuy = parseFloat(rec.strongBuy || 0);
        const buy = parseFloat(rec.buy || 0);
        const sell = parseFloat(rec.sell || 0);
        const strongSell = parseFloat(rec.strongSell || 0);
        const rawScore = (2.0 * strongBuy + buy - sell - 2.0 * strongSell) / total;
        const maxAdjustment = 0.005;
        const adj = (rawScore / 2.0) * maxAdjustment;
        terminalGrowth = Math.max(
          config.MIN_TERMINAL_GROWTH,
          Math.min(config.MAX_TERMINAL_GROWTH, terminalGrowth + adj)
        );
      }
    } catch (error) {
      // Use base terminal growth
    }

    const baseInputs: DCFInputs = {
      revenue_start: revenueStart,
      revenue_growth_start: revenue_growth_start || 0.08,
      ebit_margin_start: ebitMarginStart,
      dna_ratio_start: 0.0,
      capex_ratio_start: 0.0,
      nwc_ratio_start: 0.0,
      tax_rate_start: effTax,
      nwc_level: 0.0,
      revenue_growth_terminal: revenue_growth_terminal || 0.03,
      ebit_margin_terminal: ebitMarginStart,
      dna_ratio_terminal: 0.0,
      capex_ratio_terminal: 0.0,
      nwc_ratio_terminal: 0.0,
      tax_rate_terminal: effTax,
      risk_free_rate: risk_free_rate || config.DEFAULT_RISK_FREE_RATE,
      erp: erp || config.DEFAULT_ERP,
      beta: companyData.beta || 1.0,
      cost_of_debt: cost_of_debt || companyData.cost_of_debt || 0.04,
      debt: companyData.debt || 0,
      equity: companyData.market_cap || 1.0,
      tax_rate: effTax,
      forecast_period: forecast_period || config.DEFAULT_FORECAST_YEARS,
      terminal_growth: terminalGrowth,
      shares_outstanding: companyData.shares_outstanding,
      cash: companyData.cash || 0,
    };

    const currentPrice = companyData.current_price || 0;
    if (currentPrice <= 0) {
      return NextResponse.json(
        { error: `Unable to fetch current stock price for ${ticker}` },
        { status: 400 }
      );
    }

    const scenarios = DCFEngine.multiScenarioAnalysis(baseInputs, currentPrice);

    const recentNews = (finnhubNews || []).slice(0, 8).map((n: any) => ({
      datetime: n.datetime,
      headline: n.headline,
      source: n.source,
      summary: n.summary,
      url: n.url,
    }));

    const scenarioResponses = [
      {
        scenario_type: 'base',
        implied_price: scenarios.base.implied_price,
        upside_downside: scenarios.base.upside_downside,
        assumptions: {
          wacc: scenarios.base.wacc * 100,
          terminal_growth: terminalGrowth * 100,
        },
      },
      {
        scenario_type: 'bull',
        implied_price: scenarios.bull.implied_price,
        upside_downside: scenarios.bull.upside_downside,
        assumptions: {
          wacc: scenarios.bull.wacc * 100,
          terminal_growth: terminalGrowth * 100,
        },
      },
      {
        scenario_type: 'bear',
        implied_price: scenarios.bear.implied_price,
        upside_downside: scenarios.bear.upside_downside,
        assumptions: {
          wacc: scenarios.bear.wacc * 100,
          terminal_growth: terminalGrowth * 100,
        },
      },
    ];

    return NextResponse.json({
      ticker,
      current_price: currentPrice,
      scenarios: scenarioResponses,
      news: {
        count: finnhubNews.length,
        recent: recentNews,
      },
    });
  } catch (error: any) {
    console.error('Scenarios calculation error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

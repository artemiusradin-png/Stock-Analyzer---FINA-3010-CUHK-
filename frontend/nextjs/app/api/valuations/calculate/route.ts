import { NextRequest, NextResponse } from 'next/server';
import { DCFEngine, DCFInputs } from '@/lib/dcf-engine';
import { FinnhubService } from '@/lib/finnhub-service';
import { config } from '@/lib/config';
import { CurrencyConverter } from '@/lib/currency-converter';
import { OpenAIService } from '@/lib/openai-service';

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
      discount_rate,
    } = body;

    // Fetch company data (simplified - in production, use yfinance or OpenAI fallback)
    const finnhubService = new FinnhubService();
    const openAIService = new OpenAIService();
    
    let finnhubProfile;
    let finnhubQuote;
    try {
      finnhubProfile = await finnhubService.getCompanyProfile(ticker);
      finnhubQuote = await finnhubService.getCompanyQuote(ticker);
    } catch (error) {
      // Continue without Finnhub data
    }

    // Get currency and normalize
    const sourceCurrency = CurrencyConverter.normalizeCurrency(
      finnhubProfile?.currency || finnhubQuote?.currency || 'USD'
    );
    
    // Get price and shares in source currency
    const sourcePrice = finnhubQuote?.c || finnhubQuote?.pc || 0;
    const rawShares = finnhubProfile?.shareOutstanding || 0; // Finnhub returns millions
    const sharesOutstanding = rawShares > 0 ? rawShares * 1_000_000 : 0;
    
    // Normalize market cap (handle millions vs actual)
    const normalizeCap = (cap: number) => {
      if (!cap || !isFinite(cap)) return 0;
      if (cap > 0 && cap < 1_000_000) return cap * 1_000_000;
      return cap;
    };
    
    let sourceMarketCap = normalizeCap(finnhubProfile?.marketCap || 0);

    // Calculate/impute market cap from price * shares if provided cap is missing or clearly off
    const impliedMarketCap = sourcePrice > 0 && sharesOutstanding > 0 
      ? sourcePrice * sharesOutstanding 
      : 0;
    if (impliedMarketCap > 0 && (sourceMarketCap === 0 || Math.abs(impliedMarketCap - sourceMarketCap) / impliedMarketCap > 0.2)) {
      sourceMarketCap = impliedMarketCap;
    }

    // Convert to USD - all calculations below use USD values
    const price = CurrencyConverter.toUSD(sourcePrice, sourceCurrency);
    const marketCap = CurrencyConverter.toUSD(sourceMarketCap, sourceCurrency);

    // Normalize shares - use market cap to infer if shares seem wrong
    let shares = sharesOutstanding;
    if (price > 0 && marketCap > 0 && sharesOutstanding > 0) {
      const impliedShares = marketCap / price;
      if (impliedShares > 0 && Math.abs(shares - impliedShares) / Math.max(shares, impliedShares) > 0.2) {
        shares = impliedShares;
      }
    } else if (price > 0 && marketCap > 0) {
      shares = marketCap / price;
    }

    const companyData = {
      info: finnhubProfile || { ticker, longName: ticker, sector: '', industry: '', country: '' },
      market_cap: marketCap, // Already in USD
      current_price: price, // Already in USD
      shares_outstanding: shares,
      beta: 1.0,
      revenue: revenue_override || 0,
      debt: 0,
      cash: 0,
      cost_of_debt: cost_of_debt || 0.04,
    };

    // Determine revenue - use market cap as fallback if revenue not available
    let revenueStart = revenue_override;

    // If revenue_override provided, check if it's in billions or absolute
    if (revenue_override && revenue_override > 0) {
      if (revenue_override < 10000) {
        // Likely in billions, convert to absolute dollars
        revenueStart = revenue_override * 1e9;
      } else {
        // Already in absolute dollars
        revenueStart = revenue_override;
      }
    } else {
      // No override provided, estimate from market cap
      if (companyData.market_cap > 0) {
        // Estimate revenue as market cap / 5 (rough 5x revenue multiple)
        revenueStart = companyData.market_cap / 5;
      } else if (marketCap > 0) {
        // Use already calculated USD market cap
        revenueStart = marketCap / 5;
      } else if (price > 0 && shares > 0) {
        // Calculate market cap from price * shares, then estimate revenue
        const estimatedMarketCap = price * shares;
        revenueStart = estimatedMarketCap / 5;
      } else {
        return NextResponse.json(
          { error: 'Unable to determine starting revenue. Please provide revenue_override parameter (in billions, e.g., 394.3 for $394.3B).' },
          { status: 400 }
        );
      }
    }

    // If revenue looks like millions (too small), scale to dollars
    if (revenueStart > 0 && revenueStart < 1_000_000) {
      revenueStart = revenueStart * 1_000_000;
    }
    
    // Ensure revenue is positive and reasonable
    if (revenueStart <= 0) {
      return NextResponse.json(
        { error: 'Calculated revenue is invalid. Please provide revenue_override parameter.' },
        { status: 400 }
      );
    }

    // Calculate FCF margin -> EBIT margin
    const fcfMargin = ebit_margin_start || 0.20;
    const effTax = tax_rate_start || config.DEFAULT_TAX_RATE;
    const ebitMarginStart = fcfMargin / Math.max(1e-6, 1.0 - effTax);

    // Derive terminal growth from analysts
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

    // Validate revenue before proceeding
    if (!revenueStart || revenueStart <= 0 || !isFinite(revenueStart)) {
      const fallbackRevenue = (price > 0 && shares > 0) ? (price * shares) / 6 : 1e11; // ~$100B fallback
      revenueStart = fallbackRevenue;
      console.warn('Revenue was invalid; applying fallback', { revenueStart, marketCap: companyData.market_cap, price, shares });
    }

    // Estimate WACC using industry peers from OpenAI (fallback to default calculation)
    let industryWacc: number | undefined;
    let industryPeers: any[] = [];
    const industry = companyData.info.industry || companyData.info.sector || '';
    if (industry) {
      try {
        const { average_wacc, peers } = await openAIService.estimateIndustryWacc(industry);
        if (isFinite(average_wacc)) {
          industryWacc = average_wacc;
          industryPeers = peers;
        }
      } catch (error) {
        console.warn('Industry WACC lookup failed, using default WACC:', (error as Error).message);
      }
    }

    const manualWaccResolved = industryWacc ?? discount_rate;

    // Build DCF inputs
    const inputs: DCFInputs = {
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
      manual_wacc: manualWaccResolved,
      shares_outstanding: companyData.shares_outstanding,
      cash: companyData.cash || 0,
    };

    // Debug log
    console.log('DCF Inputs:', {
      revenue_start: inputs.revenue_start,
      market_cap: companyData.market_cap,
      price: price,
      shares: shares,
      source_currency: sourceCurrency,
    });

    // Validate current price (already in USD)
    const currentPrice = price || 0;
    if (currentPrice <= 0) {
      return NextResponse.json(
        { error: `Unable to fetch current stock price for ${ticker}` },
        { status: 400 }
      );
    }

    // Perform DCF
    const result = DCFEngine.performDCF(inputs, currentPrice);

    // Build response - ensure values are properly formatted
    const projections = result.projections.map((p) => ({
      year: p.year,
      revenue: p.revenue > 0 ? p.revenue / 1e9 : 0,
      revenue_growth_pct: p.rev_growth * 100,
      ebit: p.ebit > 0 ? p.ebit / 1e9 : 0,
      ebit_margin_pct: p.ebit_margin * 100,
      fcf: p.fcf > 0 ? p.fcf / 1e9 : 0,
      pv_fcf: p.pv_fcf > 0 ? p.pv_fcf / 1e9 : 0,
      tax_rate_pct: p.tax_rate * 100,
      nopat: p.nopat > 0 ? p.nopat / 1e9 : 0,
      reinvestment: (p.capex + p.delta_nwc) > 0 ? (p.capex + p.delta_nwc) / 1e9 : 0,
    }));

    return NextResponse.json({
      ticker,
      company_name: companyData.info.longName || ticker,
      sector: companyData.info.sector || '',
      industry: companyData.info.industry || '',
      country: companyData.info.country || '',
      current_price: result.current_price,
      implied_price: result.implied_price,
      upside_downside: result.upside_downside,
      enterprise_value: result.enterprise_value / 1e9,
      equity_value: result.equity_value / 1e9,
      terminal_value: result.terminal_value / 1e9,
      pv_terminal: result.pv_terminal / 1e9,
      wacc: result.wacc * 100,
      cost_of_equity: result.cost_of_equity * 100,
      cost_of_debt: inputs.cost_of_debt * 100,
      risk_free_rate: inputs.risk_free_rate * 100,
      erp: inputs.erp * 100,
      beta: result.levered_beta,
      unlevered_beta: result.unlevered_beta,
      market_cap: companyData.market_cap / 1e9,
      debt: companyData.debt / 1e9,
      cash: companyData.cash / 1e9,
      shares_outstanding: companyData.shares_outstanding,
      projections,
      industry_wacc: industryWacc ?? null,
      industry_wacc_peers: industryPeers,
    });
  } catch (error: any) {
    console.error('DCF calculation error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

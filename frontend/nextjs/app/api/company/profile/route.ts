import { NextRequest, NextResponse } from 'next/server';
import { FinnhubService } from '@/lib/finnhub-service';
import { CurrencyConverter } from '@/lib/currency-converter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticker } = body;

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    const finnhubService = new FinnhubService();

    let profile: any = null;
    let quote: any = null;
    
    try {
      profile = await finnhubService.getCompanyProfile(ticker);
      quote = await finnhubService.getCompanyQuote(ticker);
    } catch (error: any) {
      console.warn('Finnhub profile/quote error, using fallback profile:', error?.message || error);
      // Fallback minimal profile so UI can still show something instead of being empty
      profile = {
        ticker: ticker.toUpperCase(),
        name: ticker.toUpperCase(),
        exchange: '',
        country: '',
        industry: '',
        marketCap: 0,
        currency: 'USD',
        shareOutstanding: 0,
      };
      quote = quote || {};
    }

    // Extract currency and normalize
    const sourceCurrency = CurrencyConverter.normalizeCurrency(profile.currency || quote?.currency || 'USD');
    
    // Get price in source currency
    const sourcePrice = quote?.c || quote?.pc || 0;
    const rawShares = profile.shareOutstanding || 0; // Finnhub returns millions
    const sharesOutstanding = rawShares > 0 ? rawShares * 1_000_000 : 0;

    // Normalize market cap (handle millions vs actual values)
    const normalizeCap = (cap: number) => {
      if (!cap || !isFinite(cap)) return 0;
      // Finnhub sometimes returns marketCap in millions
      if (cap > 0 && cap < 1_000_000) return cap * 1_000_000;
      return cap;
    };

    // Get market cap in source currency
    let sourceMarketCap = normalizeCap(profile.marketCap || 0);
    
    // Calculate implied market cap from price * shares
    const impliedCap = sourcePrice > 0 && sharesOutstanding > 0 
      ? sourcePrice * sharesOutstanding 
      : 0;

    // Use implied cap if market cap is missing or significantly different
    if (impliedCap > 0 && (sourceMarketCap === 0 || 
        Math.abs(impliedCap - sourceMarketCap) / Math.max(impliedCap, sourceMarketCap) > 0.2)) {
      sourceMarketCap = impliedCap;
    }

    // Try quote market cap if still missing
    if ((!sourceMarketCap || sourceMarketCap === 0) && quote?.mcap) {
      sourceMarketCap = normalizeCap(quote.mcap);
    }

    // Convert to USD
    const marketCapUSD = CurrencyConverter.toUSD(sourceMarketCap, sourceCurrency);
    const currentPriceUSD = CurrencyConverter.toUSD(sourcePrice, sourceCurrency);

    // Format exchange name (remove redundant parts, shorten if too long)
    let exchangeDisplay = profile.exchange || '';
    if (exchangeDisplay) {
      // Clean up exchange names
      exchangeDisplay = exchangeDisplay
        .replace(/STOCK EXCHANGE/i, 'SE')
        .replace(/EXCHANGE/i, 'EX')
        .replace(/\s+/g, ' ')
        .trim();
      // Truncate if too long
      if (exchangeDisplay.length > 40) {
        exchangeDisplay = exchangeDisplay.substring(0, 37) + '...';
      }
    }

    // Format country code to full name if it's a code
    let countryDisplay = profile.country || '';
    const countryMap: { [key: string]: string } = {
      'US': 'United States',
      'JP': 'Japan',
      'GB': 'United Kingdom',
      'CA': 'Canada',
      'AU': 'Australia',
      'DE': 'Germany',
      'FR': 'France',
      'CN': 'China',
      'HK': 'Hong Kong',
      'SG': 'Singapore',
    };
    if (countryDisplay.length === 2 && countryMap[countryDisplay]) {
      countryDisplay = countryMap[countryDisplay];
    }

    return NextResponse.json({
      ticker: profile.ticker || ticker.toUpperCase(),
      name: profile.name || ticker.toUpperCase(),
      exchange: exchangeDisplay,
      country: countryDisplay,
      industry: profile.industry || '',
      marketCap: marketCapUSD, // Always in USD
      currency: 'USD', // Always USD
      current_price: currentPriceUSD, // Always in USD
      shares_outstanding: sharesOutstanding,
      // Include original currency info for reference
      source_currency: sourceCurrency,
      source_market_cap: sourceMarketCap,
      source_price: sourcePrice,
    });
  } catch (error: any) {
    console.error('Company profile error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

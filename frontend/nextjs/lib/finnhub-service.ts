// Finnhub API Service - TypeScript implementation

import { config } from './config';

export class FinnhubService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.FINNHUB_API_KEY;
    this.baseUrl = 'https://finnhub.io/api/v1';
  }

  async getCompanyProfile(ticker: string): Promise<any> {
    const url = `${this.baseUrl}/stock/profile2`;
    const params = new URLSearchParams({
      symbol: ticker.toUpperCase(),
      token: this.apiKey,
    });

    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Ticker '${ticker}' not found in Finnhub directory`);
      } else if (response.status === 401) {
        throw new Error('Finnhub API authentication failed. Check API key.');
      } else if (response.status === 429) {
        throw new Error('Finnhub API rate limit exceeded. Please try again later.');
      }
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.ticker) {
      throw new Error(
        `Ticker '${ticker}' not found in Finnhub directory. Please verify the ticker symbol is correct and actively traded.`
      );
    }

    return {
      ticker: data.ticker || ticker.toUpperCase(),
      name: data.name || '',
      exchange: data.exchange || '',
      country: data.country || '',
      currency: data.currency || 'USD',
      ipo: data.ipo || '',
      marketCap: data.marketCapitalization || 0,
      industry: data.finnhubIndustry || '',
      logo: data.logo || '',
      phone: data.phone || '',
      weburl: data.weburl || '',
      shareOutstanding: data.shareOutstanding || 0,
    };
  }

  async getCompanyQuote(ticker: string): Promise<any> {
    const url = `${this.baseUrl}/quote`;
    const params = new URLSearchParams({
      symbol: ticker.toUpperCase(),
      token: this.apiKey,
    });

    const response = await fetch(`${url}?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch quote: ${response.status}`);
    }

    return await response.json();
  }

  async getRecommendationTrend(ticker: string): Promise<any> {
    const url = `${this.baseUrl}/stock/recommendation`;
    const params = new URLSearchParams({
      symbol: ticker.toUpperCase(),
      token: this.apiKey,
    });

    const response = await fetch(`${url}?${params}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    // Return the most recent recommendation
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    return null;
  }

  async getNews(ticker: string, from?: string, to?: string): Promise<any[]> {
    const url = `${this.baseUrl}/company-news`;
    const params = new URLSearchParams({
      symbol: ticker.toUpperCase(),
      token: this.apiKey,
    });

    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const response = await fetch(`${url}?${params}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getHistoricalPrices(ticker: string, from: Date, to: Date, resolution: 'D' = 'D'): Promise<any[]> {
    const url = `${this.baseUrl}/stock/candle`;
    const params = new URLSearchParams({
      symbol: ticker.toUpperCase(),
      resolution: resolution, // 'D' for daily, 'W' for weekly, 'M' for monthly
      from: Math.floor(from.getTime() / 1000).toString(), // Unix timestamp in seconds
      to: Math.floor(to.getTime() / 1000).toString(),
      token: this.apiKey,
    });

    const response = await fetch(`${url}?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch historical prices: ${response.status}`);
    }

    const data = await response.json();

    if (data.s !== 'ok') {
      throw new Error(data.s === 'no_data' ? 'No historical data available' : 'Failed to fetch price data');
    }

    // Finnhub returns: { s: 'ok', t: [timestamps], o: [opens], h: [highs], l: [lows], c: [closes], v: [volumes] }
    const prices: any[] = [];
    if (data.c && data.t) {
      for (let i = 0; i < data.c.length; i++) {
        prices.push({
          timestamp: data.t[i],
          date: new Date(data.t[i] * 1000).toISOString().split('T')[0],
          open: data.o[i],
          high: data.h[i],
          low: data.l[i],
          close: data.c[i],
          volume: data.v[i],
        });
      }
    }

    return prices;
  }
}

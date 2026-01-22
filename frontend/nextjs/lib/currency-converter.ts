// Currency Converter - Standardizes all values to USD

export interface ExchangeRates {
  [currency: string]: number; // Rate to USD (1 USD = rate units of currency)
}

export class CurrencyConverter {
  // Exchange rates to USD (1 USD = X units of currency)
  // These are approximate and should be updated regularly in production
  // In production, fetch from an API like exchangerate-api.com, fixer.io, or Finnhub FX endpoint
  private static readonly EXCHANGE_RATES: ExchangeRates = {
    USD: 1.0,
    EUR: 0.92,      // 1 USD = 0.92 EUR, so 1 EUR = 1/0.92 = 1.087 USD
    GBP: 0.79,      // 1 USD = 0.79 GBP, so 1 GBP = 1/0.79 = 1.266 USD
    JPY: 150.0,     // 1 USD = 150 JPY, so 1 JPY = 1/150 = 0.00667 USD
    CNY: 7.2,       // 1 USD = 7.2 CNY
    HKD: 7.8,       // 1 USD = 7.8 HKD
    AUD: 1.52,      // 1 USD = 1.52 AUD
    CAD: 1.36,      // 1 USD = 1.36 CAD
    CHF: 0.89,      // 1 USD = 0.89 CHF
    SEK: 10.5,      // 1 USD = 10.5 SEK
    NOK: 10.8,      // 1 USD = 10.8 NOK
    DKK: 6.9,       // 1 USD = 6.9 DKK
    SGD: 1.35,      // 1 USD = 1.35 SGD
    KRW: 1330.0,    // 1 USD = 1330 KRW
    INR: 83.0,      // 1 USD = 83 INR
    BRL: 5.0,       // 1 USD = 5 BRL
    MXN: 17.0,      // 1 USD = 17 MXN
    ZAR: 18.5,      // 1 USD = 18.5 ZAR
  };

  /**
   * Convert amount from source currency to USD
   */
  static toUSD(amount: number, fromCurrency: string): number {
    if (!amount || amount <= 0 || !isFinite(amount)) return 0;
    
    const currency = (fromCurrency || 'USD').toUpperCase();
    
    // Already USD
    if (currency === 'USD') return amount;
    
    // Get exchange rate
    const rate = this.EXCHANGE_RATES[currency];
    if (!rate || rate <= 0) {
      console.warn(`Unknown currency: ${currency}, assuming USD`);
      return amount;
    }
    
    // Convert: if 1 USD = X currency, then 1 currency = 1/X USD
    return amount / rate;
  }

  /**
   * Convert amount from USD to target currency
   */
  static fromUSD(amount: number, toCurrency: string): number {
    if (!amount || amount <= 0 || !isFinite(amount)) return 0;
    
    const currency = (toCurrency || 'USD').toUpperCase();
    
    // Already USD
    if (currency === 'USD') return amount;
    
    // Get exchange rate
    const rate = this.EXCHANGE_RATES[currency];
    if (!rate || rate <= 0) {
      console.warn(`Unknown currency: ${currency}, returning as USD`);
      return amount;
    }
    
    // Convert: if 1 USD = X currency, then amount USD = amount * X currency
    return amount * rate;
  }

  /**
   * Normalize currency code (handle variations)
   */
  static normalizeCurrency(currency: string | undefined): string {
    if (!currency) return 'USD';
    
    const upper = currency.toUpperCase();
    
    // Handle common variations
    const variations: { [key: string]: string } = {
      'US$': 'USD',
      'EU$': 'EUR',
      'EURO': 'EUR',
      'POUND': 'GBP',
      'YEN': 'JPY',
      'YUAN': 'CNY',
      'WON': 'KRW',
      'RUPEES': 'INR',
      'REAL': 'BRL',
      'PESO': 'MXN',
    };
    
    if (variations[upper]) return variations[upper];
    
    // Return normalized version
    return upper;
  }

  /**
   * Get all supported currencies
   */
  static getSupportedCurrencies(): string[] {
    return Object.keys(this.EXCHANGE_RATES);
  }
}

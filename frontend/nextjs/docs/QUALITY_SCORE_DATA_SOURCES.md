# Quality Score Data Sources

This document explains where every number used in the quality score calculation comes from.

## Data Sources (Finnhub API)

All quality metrics are calculated from three Finnhub API endpoints:

### 1. Company Profile (`/stock/profile2`)
**Endpoint**: `https://finnhub.io/api/v1/stock/profile2?symbol={TICKER}&token={API_KEY}`

**Raw Fields We Get:**
- `marketCapitalization` → Used for **Market Cap** (may be in millions, we normalize)
- `shareOutstanding` → Used to calculate market cap if missing (in millions, we multiply by 1M)
- `exchange` → Used for **Exchange Quality** score (NYSE, NASDAQ, etc.)
- `ipo` → Used to calculate **Years Since IPO** (format: "YYYY-MM-DD" string)

**Example Response:**
```json
{
  "ticker": "AAPL",
  "marketCapitalization": 3000000000000,  // or 3000 (in millions)
  "shareOutstanding": 15728.7,  // in millions
  "exchange": "NASDAQ NMS - GLOBAL MARKET",
  "ipo": "1980-12-12",
  "name": "Apple Inc",
  ...
}
```

### 2. Real-time Quote (`/quote`)
**Endpoint**: `https://finnhub.io/api/v1/quote?symbol={TICKER}&token={API_KEY}`

**Raw Fields We Get:**
- `c` → **Current Price** (or `pc` if `c` is missing)
- `v` → **Current Day Volume** (used as fallback if historical volume unavailable)
- `pc` → Previous close (used as fallback price)

**Example Response:**
```json
{
  "c": 175.43,     // Current price
  "h": 176.50,     // High
  "l": 174.20,     // Low
  "o": 175.00,     // Open
  "pc": 174.75,    // Previous close
  "v": 45234567    // Volume (shares)
}
```

### 3. Historical Candles (`/stock/candle`)
**Endpoint**: `https://finnhub.io/api/v1/stock/candle?symbol={TICKER}&resolution=D&from={UNIX_TIMESTAMP}&to={UNIX_TIMESTAMP}&token={API_KEY}`

**Raw Fields We Get:**
- `c[]` → Array of **Closing Prices** (last 60 days) → Used to calculate **Volatility** and **Momentum**
- `v[]` → Array of **Volumes** → Used to calculate **Average Volume**

**Example Response:**
```json
{
  "s": "ok",
  "t": [1704067200, 1704153600, ...],  // Unix timestamps
  "c": [175.43, 176.20, ...],          // Closing prices
  "v": [45234567, 38912345, ...],      // Volumes
  "o": [175.00, 175.50, ...],          // Opens
  "h": [176.50, 176.80, ...],          // Highs
  "l": [174.20, 175.10, ...]           // Lows
}
```

---

## Quality Score Calculations

### 1. Market Capitalization
**Source**: `profile.marketCapitalization` OR `price × sharesOutstanding`

**Calculation:**
```typescript
let marketCap = profile?.marketCap || 0;

// Normalize (Finnhub sometimes returns in millions)
if (marketCap > 0 && marketCap < 1_000_000) {
  marketCap = marketCap * 1_000_000;
}

// Calculate from price × shares if missing
if (marketCap === 0) {
  const currentPrice = quote?.c || quote?.pc || 0;
  const sharesOutstanding = (profile?.shareOutstanding || 0) * 1_000_000;
  marketCap = currentPrice * sharesOutstanding;
}
```

**Score Bands** (from `scoring-engine.ts`):
- >$200B: +25 points
- $50-200B: +20 points
- $10-50B: +15 points
- $2-10B: +10 points
- $300M-2B: +5 points
- <$300M: -5 points

---

### 2. Exchange Quality
**Source**: `profile.exchange` (string like "NASDAQ NMS - GLOBAL MARKET", "NYSE", etc.)

**Calculation:**
```typescript
const exchange = profile?.exchange || '';
const exchangeUpper = exchange.toUpperCase();

if (exchangeUpper.includes('NYSE') || exchangeUpper === 'XNYS') {
  score += 15; // NYSE
} else if (exchangeUpper.includes('NASDAQ') || exchangeUpper === 'XNAS') {
  score += 12; // NASDAQ
} else if (exchangeUpper.includes('AMEX') || exchangeUpper === 'XASE') {
  score += 8; // AMEX
} else if (exchangeUpper.includes('OTC') || exchangeUpper.includes('PINK')) {
  score -= 10; // OTC/Pink
}
```

**Note**: We check if the string contains keywords like "NYSE", "NASDAQ" because Finnhub returns various formats like "NASDAQ NMS - GLOBAL MARKET", "NYSE - NEW YORK STOCK EXCHANGE", etc.

---

### 3. Trading Liquidity (Average Volume)
**Source**: Historical candles `v[]` array OR `quote.v`

**Calculation:**
```typescript
// Calculate average from last 60 days of historical prices
let avgVolume = 0;
if (stockPrices && stockPrices.length > 0) {
  const volumes = stockPrices.map((p: any) => p.volume || 0).filter((v: number) => v > 0);
  if (volumes.length > 0) {
    avgVolume = volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length;
  }
}

// Fallback to today's volume if historical unavailable
if (avgVolume === 0 && quote?.v) {
  avgVolume = quote.v;
}

// Convert to dollar volume
const dollarVolume = avgVolume * currentPrice;
const dollarVolumeMillions = dollarVolume / 1_000_000;
```

**Score Bands**:
- >$500M daily: +15 points
- $100-500M: +12 points
- $20-100M: +8 points
- $5-20M: +5 points
- $1-5M: +2 points
- <$1M: -5 points

---

### 4. Price Volatility
**Source**: Calculated from historical closing prices `c[]`

**Calculation:**
```typescript
// Extract closing prices
const prices = stockPrices.map((p: any) => p.close || 0).filter((p: number) => p > 0);

// Calculate daily returns
const returns: number[] = [];
for (let i = 1; i < prices.length; i++) {
  if (prices[i - 1] > 0) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
}

// Calculate standard deviation (annualized)
const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
const priceVolatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized
```

**Formula**: Standard deviation of daily returns × √252 (trading days per year)

**Score Bands**:
- <15% volatility: +12 points
- 15-25%: +8 points
- 25-35%: +4 points
- 35-50%: -5 points
- >50%: -10 points

---

### 5. Price Momentum
**Source**: Same historical returns as volatility, OR from `momentumReturns` array (used elsewhere)

**Calculation:**
```typescript
// Use existing momentum returns if available
if (momentumReturns.length > 0) {
  priceMomentum = momentumReturns.reduce((a, b) => a + b, 0) / momentumReturns.length;
} else {
  // Calculate from last 20 days of prices
  const prices = stockPrices.map((p: any) => p.close || 0).filter((p: number) => p > 0);
  const returns: number[] = [];
  for (let i = 1; i < Math.min(21, prices.length); i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  priceMomentum = returns.reduce((a, b) => a + b, 0) / returns.length;
}
```

**Score Bands**:
- >+0.1% daily average: +10 points
- +0.05-0.1%: +6 points
- 0-0.05%: +3 points
- -0.05-0%: -4 points
- <-0.05%: -8 points

---

### 6. Company Maturity (Years Since IPO)
**Source**: `profile.ipo` (string date)

**Calculation:**
```typescript
let yearsSinceIPO = 0;
if (profile?.ipo) {
  const ipoDate = new Date(profile.ipo); // Parse "1980-12-12"
  const now = new Date();
  if (!isNaN(ipoDate.getTime())) {
    yearsSinceIPO = (now.getTime() - ipoDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  }
}
```

**Score Bands**:
- 20+ years: +8 points
- 10-20 years: +6 points
- 5-10 years: +3 points
- <2 years: -5 points

---

### 7. Data Availability
**Source**: Whether we successfully fetched all three endpoints

**Calculation:**
```typescript
if (profileData.status === 'fulfilled' && 
    quoteData.status === 'fulfilled' && 
    stockPricesData.status === 'fulfilled') {
  qualityMetrics.hasData = true;
} else {
  qualityMetrics.hasData = false;
  score -= 10; // Penalty
}
```

---

## Fallback Defaults

If data is unavailable, we use these defaults (in `scoring-engine.ts`):

```typescript
const finalQuality = {
  marketCap: 10_000_000_000,      // $10B (mid-cap)
  avgVolume: 5_000_000,           // 5M shares
  exchange: 'NASDAQ',
  priceVolatility: 0.25,          // 25% annualized
  priceMomentum: 0.0005,          // 0.05% daily average
  yearsSinceIPO: 10,
  currentPrice: 100,
  hasData: false,                 // Flag that we're using defaults
};
```

---

## Summary Table

| Metric | Source | Calculation | Fallback |
|--------|--------|-------------|----------|
| Market Cap | `profile.marketCapitalization` OR `price × shares` | Direct value (normalize if < 1M) | $10B |
| Exchange | `profile.exchange` | String matching (NYSE/NASDAQ/OTC) | "NASDAQ" |
| Volume | `stockPrices[].volume` OR `quote.v` | Average of last 60 days | 5M shares |
| Volatility | `stockPrices[].close` | Std dev of returns × √252 | 25% |
| Momentum | `stockPrices[].close` | Average daily return (last 20 days) | 0.05% |
| Years Since IPO | `profile.ipo` | `(now - ipoDate) / 365 days` | 10 years |

---

## Code Locations

- **Data Fetching**: `/app/api/scoring/unified/route.ts` (lines 54-83)
- **Quality Metrics Calculation**: `/app/api/scoring/unified/route.ts` (lines 296-402)
- **Quality Score Logic**: `/lib/scoring-engine.ts` (lines 57-183)

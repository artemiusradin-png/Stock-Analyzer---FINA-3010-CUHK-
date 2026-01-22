# Portfolio Management Application

A Next.js-based portfolio management application with DCF valuations, fund tracking, and financial analytics.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, React
- **API**: Next.js API Routes
- **Financial Data**: Finnhub API, Yahoo Finance

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
cd frontend/nextjs
npm install
```

2. Set up environment variables:
Create a `.env.local` file in `frontend/nextjs/`:
```
FINNHUB_API_KEY=your_finnhub_api_key
FRED_API_KEY=your_fred_api_key
EOD_API_KEY=your_eod_api_key
OPENAI_API_KEY=your_openai_api_key (optional)
```

3. Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Features

- **DCF Valuations**: Calculate discounted cash flow valuations with multi-scenario analysis
- **Fund Tracking**: Track balances across multiple financial institutions
- **Financial Analytics**: Portfolio optimization, risk analysis, and sentiment analysis

## API Routes

- `/api/valuations/calculate` - Calculate DCF valuation
- `/api/valuations/scenarios` - Multi-scenario DCF analysis
- `/api/funds/summary-fx` - Get funds summary with FX conversion
- `/api/funds/refresh` - Refresh fund balances
- `/api/health` - Health check endpoint

## Project Structure

```
frontend/nextjs/
├── app/
│   ├── api/          # API routes
│   ├── my-funds/     # My Funds page
│   └── layout.tsx    # Root layout
├── lib/
│   ├── dcf-engine.ts     # DCF calculation engine
│   ├── finnhub-service.ts # Finnhub API client
│   └── config.ts         # Configuration
└── types/            # TypeScript types
```

## License

Private project

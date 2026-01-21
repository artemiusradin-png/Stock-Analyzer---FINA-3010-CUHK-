# My Funds - Next.js Application

A modern Next.js application for viewing unified financial account balances across multiple institutions (TD, Wealthsimple, IBKR, and Revolut).

## Features

- **Unified Dashboard**: View all accounts from multiple financial institutions in one place
- **FX Conversion**: Convert balances to different base currencies (USD, CAD, EUR)
- **Institution Grouping**: Accounts are grouped by institution with visual branding
- **Real-time Updates**: Refresh account balances on demand
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Backend API running (default: http://localhost:8000)

### Installation

1. Install dependencies:
```bash
npm install
# or
yarn install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local and set NEXT_PUBLIC_API_BASE_URL to your API URL
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000/my-funds](http://localhost:3000/my-funds) in your browser.

## Project Structure

```
frontend/nextjs/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── globals.css          # Global styles
│   └── my-funds/
│       ├── page.tsx         # My Funds page component
│       └── MyFunds.module.css # Component styles
├── lib/
│   ├── api.ts              # API client functions
│   └── utils.ts            # Utility functions
├── types/
│   └── funds.ts            # TypeScript type definitions
├── package.json
├── next.config.js
└── tsconfig.json
```

## API Integration

The application expects a backend API with the following endpoints:

- `POST /api/funds/summary-fx` - Get funds summary with FX conversion
- `POST /api/funds/refresh` - Refresh account balances

See `lib/api.ts` for API client implementation.

## Building for Production

```bash
npm run build
npm start
```

## Technologies

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **CSS Modules** - Scoped styling
- **React Hooks** - State management


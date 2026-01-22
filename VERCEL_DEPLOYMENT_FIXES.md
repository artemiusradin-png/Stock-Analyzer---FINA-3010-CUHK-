# Vercel Deployment Fixes

## Summary
Fixed all TypeScript build errors and configured Vercel to properly build the Next.js application from the `frontend/nextjs/` subdirectory.

## Changes Made

### 1. Vercel Configuration (`vercel.json`)
Created a new vercel.json at the project root to:
- Set the correct build command pointing to `frontend/nextjs`
- Configure the output directory
- Set up API rewrites to the backend (arqam-funds-backend.onrender.com)

```json
{
  "buildCommand": "cd frontend/nextjs && npm install && npm run build",
  "outputDirectory": "frontend/nextjs/.next",
  "devCommand": "cd frontend/nextjs && npm run dev",
  "installCommand": "cd frontend/nextjs && npm install",
  "framework": "nextjs",
  "rewrites": [...]
}
```

### 2. Package Updates
- Installed `resend@^3.5.0` for email functionality in the contact form

### 3. TypeScript Error Fixes

#### [app/api/contact/route.ts](frontend/nextjs/app/api/contact/route.ts:37)
- Fixed: `replyTo` → `reply_to` (correct Resend API property name)

#### [app/api/scoring/unified/route.ts](frontend/nextjs/app/api/scoring/unified/route.ts:133-135)
- Fixed: Response type confusion when fetching company profile
- Added proper JSON parsing: `const profile = profileResponse.ok ? await profileResponse.json() : null`

#### [app/api/sentiment/analyze/route.ts](frontend/nextjs/app/api/sentiment/analyze/route.ts:94)
- Fixed: Added missing `_source_type` property to article mapping
- Fixed: Changed `openAIAnalysis` type from `null` to `any` to properly access properties

#### [app/api/trading/parse-trade/route.ts](frontend/nextjs/app/api/trading/parse-trade/route.ts:104)
- Fixed: Changed `parsedTrade` type from `TradeDescription` to `any`
- Fixed: Added optional chaining for `orderType` and `action` before `.includes()` check

#### [app/my-funds/page.tsx](frontend/nextjs/app/my-funds/page.tsx:31)
- Fixed: Changed `fx_rates: null` to `fx_rates: undefined`
- Fixed: Added nullish coalescing for `availableBalance` and `holdingsValue`

#### [app/research/page.tsx](frontend/nextjs/app/research/page.tsx:754)
- Fixed: Removed explicit type annotation from `.map()` callback
- Added type assertion for `count as number` when rendering

#### [app/trading/page.tsx](frontend/nextjs/app/trading/page.tsx:249)
- Fixed: Updated `addTrade` function signature to accept `Omit<Trade, 'id' | 'totalCost'>`
- Made `totalCost` computed automatically if not provided
- Updated `AddTradeForm` to match new signature

#### [app/trading/components/TradeAssistant.tsx](frontend/nextjs/app/trading/components/TradeAssistant.tsx:119-128)
- Created separate `TradeInput` interface for required trade properties
- Added non-null assertions for validated trade fields

#### [lib/portfolio-optimizer.ts](frontend/nextjs/lib/portfolio-optimizer.ts:602-608)
- Fixed: Removed extra parameters from `applyConstraintsWithGradient` call
- Fixed: Removed undefined `minW` and `maxW` parameters from `clampWeights` calls

## Build Result
✅ Build successful - all TypeScript errors resolved
✅ 27 pages generated successfully
✅ No linting errors

## Deployment
Changes have been committed and pushed to the `deploy-safe` branch:
- Commit: `54e8b28`
- Branch: `deploy-safe`
- Remote: `origin`

## Next Steps
1. Connect your GitHub repository to Vercel
2. Set the project root to `/` (vercel.json handles the subdirectory)
3. Add environment variables in Vercel dashboard:
   - `FINNHUB_API_KEY`
   - `FRED_API_KEY`
   - `EOD_API_KEY`
   - `OPENAI_API_KEY`
   - `RESEND_API_KEY` (optional, for contact form)
   - `RESEND_FROM_EMAIL` (optional, defaults to contact@arqam.com)
4. Deploy!

## API Backend
The frontend is configured to proxy API requests to:
`https://arqam-funds-backend.onrender.com/api/*`

Make sure this backend is deployed and running.

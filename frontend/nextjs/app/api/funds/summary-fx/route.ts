import { NextRequest, NextResponse } from 'next/server';

// Simplified funds API - returns mock data for now
// In production, integrate with actual database or external APIs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fx_base_currency, fx_rates } = body;

    // Return mock structure - in production, fetch from database
    // This matches the FundsSummary schema
    return NextResponse.json({
      totals_by_currency: {
        USD: 125450.00,
        CAD: 45280.50,
      },
      last_synced_at: new Date().toISOString(),
      accounts: [],
      fx_base_currency: fx_base_currency || 'USD',
      fx_converted_total: 125450.00,
    });
  } catch (error: any) {
    console.error('Funds summary error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

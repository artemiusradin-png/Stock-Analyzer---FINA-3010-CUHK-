import { FundsSummary, FundsSummaryRequest } from '@/types/funds';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export async function getFundsSummary(request: FundsSummaryRequest): Promise<FundsSummary> {
  const response = await fetch(`${API_BASE}/api/funds/summary-fx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Funds summary failed: ${response.status}`);
  }

  return response.json();
}

export async function refreshFunds(): Promise<FundsSummary> {
  const response = await fetch(`${API_BASE}/api/funds/refresh`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Refresh failed: ${response.status}`);
  }

  return response.json();
}


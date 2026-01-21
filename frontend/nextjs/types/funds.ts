export type Institution = 'wealthsimple' | 'revolut' | 'ibkr' | 'td';
export type ConnectionStatus = 'connected' | 'requires_action' | 'error' | 'disconnected';

export interface AccountBalance {
  account_id: number;
  as_of: string;
  current_balance: number;
  available_balance?: number;
  holdings_value?: number;
  currency: string;
}

export interface AccountWithBalance {
  id: number;
  institution: Institution;
  account_name: string;
  account_type?: string;
  currency: string;
  mask?: string;
  status: ConnectionStatus;
  last_synced_at?: string;
  latest_balance?: AccountBalance;
}

export interface FundsSummary {
  totals_by_currency: Record<string, number>;
  last_synced_at?: string;
  accounts: AccountWithBalance[];
  fx_base_currency?: string;
  fx_converted_total?: number;
}

export interface FundsSummaryRequest {
  fx_base_currency: string;
  fx_rates?: Record<string, number>;
}


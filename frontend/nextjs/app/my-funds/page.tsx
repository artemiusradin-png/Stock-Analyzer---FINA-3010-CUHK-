'use client';

import { useState, useEffect, useCallback } from 'react';
import { FundsSummary, AccountWithBalance } from '@/types/funds';
import { getFundsSummary, refreshFunds } from '@/lib/api';
import {
  formatCurrency,
  formatRelativeTime,
  formatInstitutionName,
  getInstitutionInitials,
  getAccountTypeClass,
} from '@/lib/utils';
import styles from './MyFunds.module.css';

export default function MyFundsPage() {
  const [summary, setSummary] = useState<FundsSummary | null>(null);
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  const loadFunds = useCallback(async (triggerRefresh = false) => {
    try {
      if (triggerRefresh) {
        setIsRefreshing(true);
        await refreshFunds();
      }

      const data = await getFundsSummary({
        fx_base_currency: baseCurrency,
        fx_rates: undefined,
      });

      setSummary(data);
      setStatus('connected');
      if (data.fx_base_currency) {
        setBaseCurrency(data.fx_base_currency);
      }
    } catch (err) {
      console.error('Failed to load funds', err);
      setStatus('error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [baseCurrency]);

  useEffect(() => {
    loadFunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    loadFunds(true);
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = e.target.value;
    setBaseCurrency(newCurrency);
    loadFunds(false);
  };

  const quickStats = calculateQuickStats(summary?.accounts || [], baseCurrency);
  const groupedAccounts = groupAccountsByInstitution(summary?.accounts || []);

  return (
    <div className={styles.appContainer}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1>My Funds</h1>
            <p>Unified balances across TD, Wealthsimple, IBKR, and Revolut with FX-adjusted totals.</p>
          </div>
          <div className={styles.logo}>
            <span className={styles.logoText}>ARQAM</span>
          </div>
        </div>
      </header>

      <nav className={styles.navBar}>
        <div className={styles.navContent}>
          <div className={styles.navLinks}>
            <a className={styles.navLink} href="/project-npv">
              <span>Project NPV</span>
            </a>
            <a className={`${styles.navLink} ${styles.active}`} href="/my-funds">
              <span>My Funds</span>
            </a>
          </div>
          <div className={styles.statusIndicator}>
            <div className={`${styles.statusDot} ${status === 'error' ? styles.error : status === 'connecting' ? styles.connecting : ''}`}></div>
            <span>{status === 'connected' ? 'Connected' : status === 'error' ? 'Connection Error' : 'Connecting…'}</span>
          </div>
        </div>
      </nav>

      <main className={styles.mainContent}>
        <div className={styles.fundsPage}>
          {/* Hero Total Card */}
          <section className={styles.totalHeroSection}>
            <div className={styles.totalHeroCard}>
              <div className={styles.totalHeroHeader}>
                <div className={styles.totalHeroLabel}>
                  <span className={styles.totalLabelText}>Total Net Worth</span>
                  <span className={styles.totalLabelSubtitle}>All accounts • FX-adjusted</span>
                </div>
                <div className={styles.totalHeroActions}>
                  <button
                    className={`${styles.iconBtn} ${styles.refreshBtn} ${isRefreshing ? styles.spin : ''}`}
                    onClick={handleRefresh}
                    title="Refresh accounts"
                    disabled={isRefreshing}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                      <path d="M21 3v5h-5"></path>
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                      <path d="M3 21v-5h5"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div className={styles.totalHeroValue}>
                {isLoading ? (
                  <span style={{ opacity: 0.5 }}>Loading...</span>
                ) : summary?.fx_converted_total != null ? (
                  formatCurrency(summary.fx_converted_total, summary.fx_base_currency || baseCurrency)
                ) : (
                  '—'
                )}
              </div>
              <div className={styles.totalHeroMeta}>
                <div className={styles.currencySelectorWrapper}>
                  <label htmlFor="base-currency" className={styles.currencySelectorLabel}>
                    Base Currency
                  </label>
                  <select
                    id="base-currency"
                    className={styles.currencySelector}
                    value={baseCurrency}
                    onChange={handleCurrencyChange}
                  >
                    <option value="USD">USD</option>
                    <option value="CAD">CAD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div className={styles.syncInfo}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ opacity: 0.6 }}
                  >
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 1 1 14.8-8.8M22 12.5a10 10 0 1 1-14.8 8.8" />
                  </svg>
                  <span>
                    {summary?.last_synced_at
                      ? `Last updated ${formatRelativeTime(new Date(summary.last_synced_at))}`
                      : 'Not synced'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Stats */}
          <section className={styles.quickStatsSection}>
            <div className={styles.quickStatsGrid}>
              <div className={styles.quickStatCard}>
                <div className={styles.quickStatLabel}>Total Accounts</div>
                <div className={styles.quickStatValue}>{quickStats.totalAccounts}</div>
                <div className={styles.quickStatMeta}>{quickStats.connectedAccounts} connected</div>
              </div>
              <div className={styles.quickStatCard}>
                <div className={styles.quickStatLabel}>Institutions</div>
                <div className={styles.quickStatValue}>{quickStats.totalInstitutions}</div>
                <div className={styles.quickStatMeta}>Linked providers</div>
              </div>
              <div className={styles.quickStatCard}>
                <div className={styles.quickStatLabel}>Cash Accounts</div>
                <div className={styles.quickStatValue}>{quickStats.cashAccounts.length}</div>
                <div className={styles.quickStatMeta}>
                  {quickStats.cashTotal > 0 ? formatCurrency(quickStats.cashTotal, baseCurrency) : '—'}
                </div>
              </div>
              <div className={styles.quickStatCard}>
                <div className={styles.quickStatLabel}>Brokerage</div>
                <div className={styles.quickStatValue}>{quickStats.brokerageAccounts.length}</div>
                <div className={styles.quickStatMeta}>
                  {quickStats.brokerageTotal > 0 ? formatCurrency(quickStats.brokerageTotal, baseCurrency) : '—'}
                </div>
              </div>
            </div>
          </section>

          {/* Currency Breakdown */}
          <section className={styles.currencyBreakdown}>
            <div className={styles.breakdownHeader}>
              <h3 className={styles.breakdownTitle}>By Currency</h3>
              <p className={styles.breakdownSubtitle}>Breakdown across all accounts</p>
            </div>
            <div className={styles.chipRow}>
              {summary?.totals_by_currency && Object.keys(summary.totals_by_currency).length > 0 ? (
                Object.entries(summary.totals_by_currency).map(([ccy, total]) => (
                  <div key={ccy} className={styles.chip}>
                    <span className={styles.chipLabel}>{ccy}</span>
                    <span className={styles.chipValue}>{formatCurrency(total, ccy)}</span>
                  </div>
                ))
              ) : (
                <div style={{ color: '#868e96', fontSize: '0.875rem' }}>No currency data available</div>
              )}
            </div>
          </section>

          {/* Accounts Section */}
          <section className={styles.accountsContainer}>
            <div className={styles.sectionHeading}>
              <div className={styles.sectionHeadingLeft}>
                <h3 className={styles.sectionTitle}>Your Accounts</h3>
                <p className={styles.sectionSubtitle}>All linked financial institutions</p>
              </div>
              <div className={styles.statusIndicator}>
                <div className={`${styles.statusDot} ${status === 'error' ? styles.error : status === 'connecting' ? styles.connecting : ''}`}></div>
                <span>{status === 'connected' ? 'All Systems Operational' : status === 'error' ? 'Connection Error' : 'Connecting…'}</span>
              </div>
            </div>
            <div className={styles.institutionsContainer}>
              {Object.keys(groupedAccounts).length === 0 ? (
                <div style={{
                  padding: '3rem 2rem',
                  textAlign: 'center',
                  color: '#6c757d',
                  background: '#ffffff',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px'
                }}>
                  <p style={{ margin: 0, fontSize: '0.9375rem' }}>
                    {isLoading ? 'Loading accounts...' : 'No accounts found. Click refresh to sync.'}
                  </p>
                </div>
              ) : (
                Object.entries(groupedAccounts).map(([institution, accounts]) => (
                  <InstitutionGroup
                    key={institution}
                    institution={institution}
                    accounts={accounts}
                    baseCurrency={baseCurrency}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function InstitutionGroup({
  institution,
  accounts,
  baseCurrency,
}: {
  institution: string;
  accounts: AccountWithBalance[];
  baseCurrency: string;
}) {
  const instTotal = accounts.reduce((sum, acc) => {
    return sum + (acc.latest_balance?.current_balance || 0);
  }, 0);

  const instName = formatInstitutionName(institution);
  const instInitials = getInstitutionInitials(institution);

  return (
    <div className={styles.institutionGroup}>
      <div className={styles.institutionHeader}>
        <div className={styles.institutionHeaderLeft}>
          <div className={`${styles.institutionIcon} ${styles[institution]}`}>{instInitials}</div>
          <div className={styles.institutionInfo}>
            <div className={styles.institutionName}>{instName}</div>
            <div className={styles.institutionSummary}>
              {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className={styles.institutionTotal}>
          <div className={styles.institutionTotalLabel}>Total</div>
          <div className={styles.institutionTotalValue}>
            {instTotal > 0 ? formatCurrency(instTotal, accounts[0]?.currency || baseCurrency) : '—'}
          </div>
        </div>
      </div>
      <div className={styles.accountsGrid}>
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} institution={institution} />
        ))}
      </div>
    </div>
  );
}

function AccountCard({ account, institution }: { account: AccountWithBalance; institution: string }) {
  const { account_name, account_type, currency, latest_balance, status, mask } = account;
  const balance = latest_balance?.current_balance ?? null;
  const availableBalance = latest_balance?.available_balance ?? null;
  const holdingsValue = latest_balance?.holdings_value ?? null;
  const updated = latest_balance ? formatRelativeTime(new Date(latest_balance.as_of)) : '—';

  const typeClass = getAccountTypeClass(account_type);
  const typeLabel = account_type || 'Account';

  return (
    <div className={`${styles.accountCard} ${styles[`institution-${institution}`]}`} data-institution={institution}>
      <div className={styles.accountHeader}>
        <div className={styles.accountBrand}>
          <div className={`${styles.brandPill} ${styles[institution]}`}>{institution.toUpperCase()}</div>
          <div className={styles.accountMeta}>
            <div className={styles.accountName}>{account_name || 'Account'}</div>
            <div className={styles.accountType}>{currency}</div>
            <div className={`${styles.accountTypeBadge} ${typeClass ? styles[typeClass] : ''}`}>{typeLabel}</div>
          </div>
        </div>
        <div className={`${styles.statusPill} ${styles[status?.toLowerCase() || 'connected']} ${status === 'error' ? styles.error : status === 'requires_action' ? styles.requires_action : ''}`}>
          {status || 'connected'}
        </div>
      </div>
      <div className={styles.accountBody}>
        <div className={styles.balanceBlock}>
          <div className={styles.balanceLabel}>Balance</div>
          <div className={styles.balanceValue}>
            {balance != null ? formatCurrency(balance, currency) : '—'}
          </div>
          {(availableBalance !== null || holdingsValue !== null) && (
            <div className={styles.balanceDetails}>
              {availableBalance !== null && availableBalance !== balance && (
                <div className={styles.balanceDetailRow}>
                  <span className={styles.balanceDetailLabel}>Available</span>
                  <span className={styles.balanceDetailValue}>{formatCurrency(availableBalance, currency)}</span>
                </div>
              )}
              {holdingsValue !== null && holdingsValue !== balance && (
                <div className={styles.balanceDetailRow}>
                  <span className={styles.balanceDetailLabel}>Holdings</span>
                  <span className={styles.balanceDetailValue}>{formatCurrency(holdingsValue, currency)}</span>
                </div>
              )}
            </div>
          )}
          <div className={styles.balanceUpdated}>Updated {updated}</div>
        </div>
        {mask && (
          <div className={styles.mask}>ID: {mask}</div>
        )}
      </div>
    </div>
  );
}

function calculateQuickStats(accounts: AccountWithBalance[], baseCurrency: string) {
  const totalAccounts = accounts.length;
  const connectedAccounts = accounts.filter((acc) => acc.status === 'connected').length;
  const institutions = new Set(accounts.map((acc) => acc.institution?.toLowerCase() || 'unknown'));
  const totalInstitutions = institutions.size;

  const cashAccounts = accounts.filter((acc) => {
    const type = acc.account_type?.toLowerCase() || '';
    return type.includes('cash') || type.includes('checking') || type.includes('savings');
  });

  const brokerageAccounts = accounts.filter((acc) => {
    const type = acc.account_type?.toLowerCase() || '';
    return type.includes('brokerage') || type.includes('investment') || type.includes('trading');
  });

  const cashTotal = cashAccounts.reduce((sum, acc) => {
    return sum + (acc.latest_balance?.current_balance || 0);
  }, 0);

  const brokerageTotal = brokerageAccounts.reduce((sum, acc) => {
    return sum + (acc.latest_balance?.holdings_value || acc.latest_balance?.current_balance || 0);
  }, 0);

  return {
    totalAccounts,
    connectedAccounts,
    totalInstitutions,
    cashAccounts,
    brokerageAccounts,
    cashTotal,
    brokerageTotal,
  };
}

function groupAccountsByInstitution(accounts: AccountWithBalance[]): Record<string, AccountWithBalance[]> {
  const grouped: Record<string, AccountWithBalance[]> = {};
  accounts.forEach((account) => {
    const inst = (account.institution || 'unknown').toLowerCase();
    if (!grouped[inst]) {
      grouped[inst] = [];
    }
    grouped[inst].push(account);
  });
  return grouped;
}


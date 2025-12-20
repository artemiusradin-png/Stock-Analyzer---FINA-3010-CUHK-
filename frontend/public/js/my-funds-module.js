/**
 * My Funds - Aggregated view with FX conversion
 */

const API_BASE = window.API_BASE_URL || 'http://localhost:8000';
let currentBaseCurrency = 'USD';
let summaryState = null;

async function initMyFunds() {
  wireActions();
  await refreshFunds();
}

function wireActions() {
  const refreshBtn = document.getElementById('refresh-accounts');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.classList.add('spin');
      await refreshFunds(true);
      setTimeout(() => refreshBtn.classList.remove('spin'), 500);
    });
  }

  const baseSelect = document.getElementById('base-currency');
  if (baseSelect) {
    baseSelect.addEventListener('change', async (e) => {
      currentBaseCurrency = e.target.value;
      await refreshFunds(false);
    });
  }
}

async function refreshFunds(triggerRefresh = false) {
  try {
    if (triggerRefresh) {
      await fetch(`${API_BASE}/api/funds/refresh`, { method: 'POST' });
    }

    const payload = {
      fx_base_currency: currentBaseCurrency,
      fx_rates: null // supply custom rates from frontend if desired
    };
    const res = await fetch(`${API_BASE}/api/funds/summary-fx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Funds summary failed: ${res.status}`);
    }

    summaryState = await res.json();
    renderSummary();
    renderAccounts();
  } catch (err) {
    console.error('Failed to refresh funds', err);
    showStatus('error');
  }
}

function renderSummary() {
  if (!summaryState) return;

  const { totals_by_currency, fx_converted_total, fx_base_currency, last_synced_at, accounts } = summaryState;
  const fxTotalEl = document.getElementById('fx-total');
  const syncEl = document.getElementById('last-sync');
  const chipContainer = document.getElementById('currency-chips');
  const baseSelect = document.getElementById('base-currency');

  if (fxTotalEl) {
    fxTotalEl.textContent = fx_converted_total != null ? formatCurrency(fx_converted_total, fx_base_currency) : '—';
  }
  if (baseSelect && fx_base_currency) {
    baseSelect.value = fx_base_currency;
    currentBaseCurrency = fx_base_currency;
  }
  if (syncEl) {
    if (last_synced_at) {
      const syncDate = new Date(last_synced_at);
      const now = new Date();
      const diffMs = now - syncDate;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      let timeAgo;
      if (diffMins < 1) {
        timeAgo = 'Just now';
      } else if (diffMins < 60) {
        timeAgo = `${diffMins}m ago`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours}h ago`;
      } else if (diffDays < 7) {
        timeAgo = `${diffDays}d ago`;
      } else {
        timeAgo = syncDate.toLocaleDateString();
      }
      syncEl.textContent = `Synced ${timeAgo}`;
    } else {
      syncEl.textContent = 'Not synced';
    }
  }
  if (chipContainer) {
    chipContainer.innerHTML = '';
    Object.entries(totals_by_currency || {}).forEach(([ccy, total]) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `<span class="chip-label">${ccy}</span><span class="chip-value">${formatCurrency(total, ccy)}</span>`;
      chipContainer.appendChild(chip);
    });
  }

  // Render quick stats
  renderQuickStats(accounts, fx_base_currency);

  showStatus('connected');
}

function renderQuickStats(accounts, baseCurrency) {
  const container = document.getElementById('quick-stats-grid');
  if (!container) return;

  // Calculate stats
  const totalAccounts = accounts.length;
  const connectedAccounts = accounts.filter(acc => acc.status === 'connected').length;
  const institutions = new Set(accounts.map(acc => acc.institution?.toLowerCase() || 'unknown'));
  const totalInstitutions = institutions.size;

  // Calculate total by account type
  const cashAccounts = accounts.filter(acc => {
    const type = acc.account_type?.toLowerCase() || '';
    return type.includes('cash') || type.includes('checking') || type.includes('savings');
  });
  const brokerageAccounts = accounts.filter(acc => {
    const type = acc.account_type?.toLowerCase() || '';
    return type.includes('brokerage') || type.includes('investment') || type.includes('trading');
  });

  let cashTotal = 0;
  let brokerageTotal = 0;

  cashAccounts.forEach(acc => {
    if (acc.latest_balance?.current_balance) {
      cashTotal += acc.latest_balance.current_balance;
    }
  });

  brokerageAccounts.forEach(acc => {
    if (acc.latest_balance?.holdings_value) {
      brokerageTotal += acc.latest_balance.holdings_value;
    } else if (acc.latest_balance?.current_balance) {
      brokerageTotal += acc.latest_balance.current_balance;
    }
  });

  container.innerHTML = `
    <div class="quick-stat-card">
      <div class="quick-stat-label">Total Accounts</div>
      <div class="quick-stat-value">${totalAccounts}</div>
      <div class="quick-stat-meta">${connectedAccounts} connected</div>
    </div>
    <div class="quick-stat-card">
      <div class="quick-stat-label">Institutions</div>
      <div class="quick-stat-value">${totalInstitutions}</div>
      <div class="quick-stat-meta">Linked providers</div>
    </div>
    <div class="quick-stat-card">
      <div class="quick-stat-label">Cash Accounts</div>
      <div class="quick-stat-value">${cashAccounts.length}</div>
      <div class="quick-stat-meta">${cashTotal > 0 ? formatCurrency(cashTotal, baseCurrency || 'USD') : '—'}</div>
    </div>
    <div class="quick-stat-card">
      <div class="quick-stat-label">Brokerage</div>
      <div class="quick-stat-value">${brokerageAccounts.length}</div>
      <div class="quick-stat-meta">${brokerageTotal > 0 ? formatCurrency(brokerageTotal, baseCurrency || 'USD') : '—'}</div>
    </div>
  `;
}

function renderAccounts() {
  const container = document.getElementById('institutions-container');
  if (!container || !summaryState) return;

  container.innerHTML = '';
  const accounts = summaryState.accounts || [];

  // Group accounts by institution
  const grouped = {};
  accounts.forEach(account => {
    const inst = (account.institution || 'unknown').toLowerCase();
    if (!grouped[inst]) {
      grouped[inst] = [];
    }
    grouped[inst].push(account);
  });

  // Render each institution group
  Object.entries(grouped).forEach(([institution, instAccounts]) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'institution-group';

    // Calculate institution total
    let instTotal = 0;
    instAccounts.forEach(acc => {
      if (acc.latest_balance?.current_balance) {
        instTotal += acc.latest_balance.current_balance;
      }
    });

    // Format institution name
    const instName = formatInstitutionName(institution);
    const instInitials = getInstitutionInitials(institution);

    // Create header
    const header = document.createElement('div');
    header.className = 'institution-header';
    header.innerHTML = `
      <div class="institution-header-left">
        <div class="institution-icon ${institution}">${instInitials}</div>
        <div class="institution-info">
          <div class="institution-name">${instName}</div>
          <div class="institution-summary">${instAccounts.length} account${instAccounts.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="institution-total">
        <div class="institution-total-label">Total</div>
        <div class="institution-total-value">${instTotal > 0 ? formatCurrency(instTotal, instAccounts[0]?.currency || 'USD') : '—'}</div>
      </div>
    `;

    // Create accounts grid
    const accountsGrid = document.createElement('div');
    accountsGrid.className = 'accounts-grid';

    instAccounts.forEach(account => {
      const card = createAccountCard(account, institution);
      accountsGrid.appendChild(card);
    });

    groupEl.appendChild(header);
    groupEl.appendChild(accountsGrid);
    container.appendChild(groupEl);
  });
}

function createAccountCard(account, institution) {
  const { account_name, account_type, currency, latest_balance, status, mask } = account;
  const balance = latest_balance ? latest_balance.current_balance : null;
  const availableBalance = latest_balance ? latest_balance.available_balance : null;
  const holdingsValue = latest_balance ? latest_balance.holdings_value : null;
  const updated = latest_balance ? formatRelativeTime(new Date(latest_balance.as_of)) : '—';
  
  const card = document.createElement('div');
  card.className = 'account-card';
  card.setAttribute('data-institution', institution.toLowerCase());

  const typeClass = getAccountTypeClass(account_type);
  const typeLabel = account_type || 'Account';

  let balanceDetailsHTML = '';
  if (availableBalance !== null && availableBalance !== balance) {
    balanceDetailsHTML += `
      <div class="balance-detail-row">
        <span class="balance-detail-label">Available</span>
        <span class="balance-detail-value">${formatCurrency(availableBalance, currency)}</span>
      </div>
    `;
  }
  if (holdingsValue !== null && holdingsValue !== balance) {
    balanceDetailsHTML += `
      <div class="balance-detail-row">
        <span class="balance-detail-label">Holdings</span>
        <span class="balance-detail-value">${formatCurrency(holdingsValue, currency)}</span>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="account-header">
      <div class="account-brand">
        <div class="brand-pill ${institution.toLowerCase()}">${institution.toUpperCase()}</div>
        <div class="account-meta">
          <div class="account-name">${account_name || 'Account'}</div>
          <div class="account-type">${currency}</div>
          <div class="account-type-badge ${typeClass}">${typeLabel}</div>
        </div>
      </div>
      <div class="status-pill ${status?.toLowerCase() || 'connected'}">${status || 'connected'}</div>
    </div>
    <div class="account-body">
      <div class="balance-block">
        <div class="balance-label">Balance</div>
        <div class="balance-value">${balance != null ? formatCurrency(balance, currency) : '—'}</div>
        ${balanceDetailsHTML ? `<div class="balance-details">${balanceDetailsHTML}</div>` : ''}
        <div class="balance-updated">Updated ${updated}</div>
      </div>
      ${mask ? `<div class="mask">ID: ${mask}</div>` : ''}
    </div>
  `;

  return card;
}

function formatInstitutionName(institution) {
  const names = {
    'wealthsimple': 'Wealthsimple',
    'revolut': 'Revolut',
    'ibkr': 'Interactive Brokers',
    'td': 'TD Bank',
    'unknown': 'Unknown'
  };
  return names[institution.toLowerCase()] || institution.charAt(0).toUpperCase() + institution.slice(1);
}

function getInstitutionInitials(institution) {
  const initials = {
    'wealthsimple': 'WS',
    'revolut': 'RV',
    'ibkr': 'IB',
    'td': 'TD'
  };
  return initials[institution.toLowerCase()] || institution.substring(0, 2).toUpperCase();
}

function getAccountTypeClass(accountType) {
  if (!accountType) return '';
  const type = accountType.toLowerCase();
  if (type.includes('cash') || type.includes('checking') || type.includes('savings')) {
    return 'cash';
  }
  if (type.includes('brokerage') || type.includes('investment') || type.includes('trading')) {
    return 'brokerage';
  }
  return '';
}

function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function formatCurrency(value, currency = '') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function showStatus(state) {
  const statusText = document.getElementById('status-text');
  const statusTextAccounts = document.getElementById('status-text-accounts');
  
  const statusMessage = state === 'connected' ? 'Connected' : state === 'error' ? 'Error' : 'Connecting…';
  
  if (statusText) {
    statusText.textContent = statusMessage;
  }
  if (statusTextAccounts) {
    statusTextAccounts.textContent = statusMessage;
  }
}

document.addEventListener('DOMContentLoaded', initMyFunds);

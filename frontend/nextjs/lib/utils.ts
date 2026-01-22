export function formatCurrency(value: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
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

export function formatInstitutionName(institution: string): string {
  const names: Record<string, string> = {
    wealthsimple: 'Wealthsimple',
    revolut: 'Revolut',
    ibkr: 'Interactive Brokers',
    td: 'TD Bank',
    unknown: 'Unknown',
  };
  return names[institution.toLowerCase()] || institution.charAt(0).toUpperCase() + institution.slice(1);
}

export function getInstitutionInitials(institution: string): string {
  const initials: Record<string, string> = {
    wealthsimple: 'WS',
    revolut: 'RV',
    ibkr: 'IB',
    td: 'TD',
  };
  return initials[institution.toLowerCase()] || institution.substring(0, 2).toUpperCase();
}

export function getAccountTypeClass(accountType?: string): string {
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


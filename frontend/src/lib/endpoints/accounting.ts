export const ACCOUNTING_ENDPOINTS = {
  accounts: '/accounting/accounts',
  journalEntries: (branchId?: number | string) => {
    if (branchId && branchId !== 'ALL') return `/accounting/journal-entries?branchId=${branchId}`;
    return '/accounting/journal-entries';
  },
  profitLoss: (branchId?: number | string) => {
    if (branchId && branchId !== 'ALL') return `/accounting/profit-loss?branchId=${branchId}`;
    return '/accounting/profit-loss';
  },
  vatReport: (branchId?: number | string) => {
    if (branchId && branchId !== 'ALL') return `/accounting/vat-report?branchId=${branchId}`;
    return '/accounting/vat-report';
  },
  trialBalance: (branchId?: number | string, asOf?: string) => {
    const params = new URLSearchParams();
    if (branchId && branchId !== 'ALL') params.set('branchId', String(branchId));
    if (asOf) params.set('asOf', asOf);
    const query = params.toString();
    return query ? `/accounting/trial-balance?${query}` : '/accounting/trial-balance';
  },
  seed: '/accounting/seed',
} as const;

export const NOTIFICATION_ENDPOINTS = {
  list: '/notifications',
  markRead: (id: number) => `/notifications/${id}/read`,
  markAllRead: '/notifications/read-all',
} as const;

export const AUDIT_ENDPOINTS = {
  logs: (limit: number, offset: number) => `/audit?limit=${limit}&offset=${offset}`,
} as const;

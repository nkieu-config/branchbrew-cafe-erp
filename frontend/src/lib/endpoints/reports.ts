export const REPORT_ENDPOINTS = {
  executiveSummary: (branchId?: number | string) => {
    if (branchId && branchId !== 'ALL') return `/reports/executive-summary?branchId=${branchId}`;
    return '/reports/executive-summary';
  },
  topProducts: (branchId?: number | string) => {
    if (branchId && branchId !== 'ALL') return `/reports/top-products?branchId=${branchId}`;
    return '/reports/top-products';
  },
  salesTrends: (branchId?: number, days?: number) => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));
    if (days) params.set('days', String(days));
    const query = params.toString();
    return `/reports/sales-trends${query ? `?${query}` : ''}`;
  },
  profitLoss: (branchId?: number) =>
    `/reports/profit-loss${branchId ? `?branchId=${branchId}` : ''}`,
  foodCostActual: (branchId?: number) =>
    `/reports/food-cost-actual${branchId ? `?branchId=${branchId}` : ''}`,
} as const;

export const ORDER_ENDPOINTS = {
  list: (params: { branchId?: number; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.branchId) query.set('branchId', String(params.branchId));
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.offset != null) query.set('offset', String(params.offset));
    const qs = query.toString();
    return qs ? `/orders?${qs}` : '/orders';
  },
  create: '/orders',
  kds: (branchId: number) => `/orders/kds?branchId=${branchId}`,
  updateStatus: (id: number) => `/orders/${id}/status`,
  detail: (id: number) => `/orders/${id}`,
  void: (id: number) => `/orders/${id}/void`,
  refund: (id: number) => `/orders/${id}/refund`,
} as const;

export type OrderListParams = {
  branchId?: number;
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
  since?: string;
};

export const ORDER_ENDPOINTS = {
  list: (params: OrderListParams = {}) => {
    const query = new URLSearchParams();
    if (params.branchId) query.set('branchId', String(params.branchId));
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.offset != null) query.set('offset', String(params.offset));
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.since) query.set('since', params.since);
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

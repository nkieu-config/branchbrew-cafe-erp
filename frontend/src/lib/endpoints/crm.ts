export const CUSTOMER_ENDPOINTS = {
  list: (
    window: { limit?: number; offset?: number; search?: string } = {},
  ) => {
    const params = new URLSearchParams();
    if (window.search) params.set('search', window.search);
    if (window.limit != null) params.set('limit', String(window.limit));
    if (window.offset != null) params.set('offset', String(window.offset));
    const query = params.toString();
    return query ? `/customers?${query}` : '/customers';
  },
  create: '/customers',
  byPhone: (phone: string) => `/customers/phone/${phone}`,
  detail360: (id: number) => `/customers/${id}/360`,
  detail: (id: number) => `/customers/${id}`,
} as const;

export const PROMOTION_ENDPOINTS = {
  list: '/promotions',
  create: '/promotions',
  validate: '/promotions/validate',
  update: (id: number) => `/promotions/${id}`,
  delete: (id: number) => `/promotions/${id}`,
  toggle: (id: number) => `/promotions/${id}/toggle`,
} as const;

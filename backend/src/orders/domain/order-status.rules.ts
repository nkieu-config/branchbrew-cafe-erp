export const ORDER_LIFECYCLE_STATUSES = [
  'PENDING',
  'PREPARING',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
] as const;

export type OrderLifecycleStatus = (typeof ORDER_LIFECYCLE_STATUSES)[number];

export const ORDER_PAYMENT_METHODS = [
  'CASH',
  'CREDIT_CARD',
  'QR_PROMPTPAY',
] as const;

export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];

const KITCHEN_CATEGORIES = /coffee|beverage|drink|tea/i;

export function productRequiresKitchen(category: string): boolean {
  return KITCHEN_CATEGORIES.test(category);
}

export function resolveInitialOrderStatus(
  products: { category: string }[],
): 'PENDING' | 'COMPLETED' {
  return products.some((p) => productRequiresKitchen(p.category))
    ? 'PENDING'
    : 'COMPLETED';
}

const FORWARD_TRANSITIONS: Partial<
  Record<OrderLifecycleStatus, readonly OrderLifecycleStatus[]>
> = {
  PENDING: ['PREPARING', 'COMPLETED'],
  PREPARING: ['COMPLETED'],
};

export function canTransitionOrderStatus(
  from: OrderLifecycleStatus,
  to: OrderLifecycleStatus,
): boolean {
  return FORWARD_TRANSITIONS[from]?.includes(to) ?? false;
}

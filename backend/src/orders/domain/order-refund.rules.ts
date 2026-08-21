import { OrderLifecycleStatus } from './order-status.rules';
import { isSameCalendarDay, isTerminalOrderStatus } from './order-void.rules';

export type OrderRefundErrorKind =
  | 'ORDER_ALREADY_REVERSED'
  | 'REFUND_NOT_COMPLETED'
  | 'REFUND_SAME_DAY';

export type OrderRefundError = {
  kind: OrderRefundErrorKind;
};

export class OrderRefundValidationError extends Error {
  constructor(public readonly detail: OrderRefundError) {
    super(detail.kind);
    this.name = 'OrderRefundValidationError';
  }
}

function throwOrderRefundError(kind: OrderRefundErrorKind): never {
  throw new OrderRefundValidationError({ kind });
}

export function isOrderRefundValidationError(
  error: unknown,
): error is OrderRefundValidationError {
  return error instanceof OrderRefundValidationError;
}

export function assertVoidable(
  createdAt: Date,
  status: OrderLifecycleStatus,
): void {
  if (isTerminalOrderStatus(status)) {
    throwOrderRefundError('ORDER_ALREADY_REVERSED');
  }
  if (!isSameCalendarDay(createdAt, new Date())) {
    throw new Error('VOID_NOT_SAME_DAY');
  }
}

export function assertRefundable(
  createdAt: Date,
  status: OrderLifecycleStatus,
): void {
  if (isTerminalOrderStatus(status)) {
    throwOrderRefundError('ORDER_ALREADY_REVERSED');
  }
  if (status !== 'COMPLETED') {
    throwOrderRefundError('REFUND_NOT_COMPLETED');
  }
  if (isSameCalendarDay(createdAt, new Date())) {
    throwOrderRefundError('REFUND_SAME_DAY');
  }
}

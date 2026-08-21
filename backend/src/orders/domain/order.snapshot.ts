import { toNum } from '../../common/decimal.util';
import {
  ORDER_LIFECYCLE_STATUSES,
  ORDER_PAYMENT_METHODS,
  OrderLifecycleStatus,
  OrderPaymentMethod,
} from './order-status.rules';

export {
  ORDER_LIFECYCLE_STATUSES,
  ORDER_PAYMENT_METHODS,
  type OrderLifecycleStatus,
  type OrderPaymentMethod,
};

export type OrderSnapshot = {
  id: number;
  branchId: number;
  status: OrderLifecycleStatus;
  paymentMethod: OrderPaymentMethod;
  netAmount: number;
  taxAmount: number;
  totalCogs: number;
  createdAt: Date;
};

type OrderSnapshotSource = {
  id: number;
  branchId: number;
  status: OrderLifecycleStatus;
  paymentMethod: OrderPaymentMethod;
  netAmount: number | string | { toNumber(): number } | null;
  taxAmount: number | string | { toNumber(): number } | null;
  totalCogs: number | string | { toNumber(): number } | null;
  createdAt: Date;
};

export function toOrderSnapshot(order: OrderSnapshotSource): OrderSnapshot {
  return {
    id: order.id,
    branchId: order.branchId,
    status: order.status,
    paymentMethod: order.paymentMethod,
    netAmount: toNum(order.netAmount),
    taxAmount: toNum(order.taxAmount),
    totalCogs: toNum(order.totalCogs),
    createdAt: order.createdAt,
  };
}

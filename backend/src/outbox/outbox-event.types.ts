import { Prisma } from '@prisma/client';
import {
  ORDER_LIFECYCLE_STATUSES,
  OrderLifecycleStatus,
  OrderSnapshot,
} from '../orders/domain/order.snapshot';
import { PurchaseOrderReceivedSnapshot } from '../procurement/domain/purchase-order-received.snapshot';
import { PurchaseOrderPaidSnapshot } from '../procurement/domain/purchase-order-paid.snapshot';
import { ProductionCompletedSnapshot } from '../production/domain/production-completed.snapshot';
import { StockAdjustedSnapshot } from '../inventory/domain/stock-adjusted.snapshot';
import { PayrollApprovedSnapshot } from '../hr/domain/payroll-approved.snapshot';
import { ExpenseCreatedSnapshot } from '../finance/domain/expense-created.snapshot';

export const OUTBOX_EVENT_TYPES = {
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_UPDATED: 'order.status.updated',
  ORDER_VOIDED: 'order.voided',
  ORDER_REFUNDED: 'order.refunded',
  PURCHASE_ORDER_RECEIVED: 'purchase-order.received',
  PURCHASE_ORDER_PAID: 'purchase-order.paid',
  PRODUCTION_COMPLETED: 'production.completed',
  STOCK_ADJUSTED: 'inventory.stock-adjusted',
  PAYROLL_APPROVED: 'payroll.approved',
  EXPENSE_CREATED: 'expense.created',
} as const;

export type OutboxEventType =
  (typeof OUTBOX_EVENT_TYPES)[keyof typeof OUTBOX_EVENT_TYPES];

export type OutboxEventPayloadMap = {
  [OUTBOX_EVENT_TYPES.ORDER_CREATED]: {
    order: OrderSnapshot;
    ingredientRequirements: [number, number][];
    branchId: number;
    customerId: number | null;
  };
  [OUTBOX_EVENT_TYPES.ORDER_STATUS_UPDATED]: {
    orderId: number;
    status: OrderLifecycleStatus;
    branchId: number;
  };
  [OUTBOX_EVENT_TYPES.ORDER_VOIDED]: {
    order: OrderSnapshot;
  };
  [OUTBOX_EVENT_TYPES.ORDER_REFUNDED]: {
    order: OrderSnapshot;
    reason?: string;
  };
  [OUTBOX_EVENT_TYPES.PURCHASE_ORDER_RECEIVED]: {
    purchaseOrder: PurchaseOrderReceivedSnapshot;
  };
  [OUTBOX_EVENT_TYPES.PURCHASE_ORDER_PAID]: {
    payment: PurchaseOrderPaidSnapshot;
  };
  [OUTBOX_EVENT_TYPES.PRODUCTION_COMPLETED]: {
    production: ProductionCompletedSnapshot;
  };
  [OUTBOX_EVENT_TYPES.STOCK_ADJUSTED]: {
    adjustment: StockAdjustedSnapshot;
  };
  [OUTBOX_EVENT_TYPES.PAYROLL_APPROVED]: {
    payroll: PayrollApprovedSnapshot;
  };
  [OUTBOX_EVENT_TYPES.EXPENSE_CREATED]: {
    expense: ExpenseCreatedSnapshot;
  };
};

export type OutboxEventPayload<T extends OutboxEventType> =
  OutboxEventPayloadMap[T];

export type OutboxEnqueuePayload = {
  [K in OutboxEventType]: {
    eventType: K;
    payload: OutboxEventPayloadMap[K];
  };
}[OutboxEventType];

export function isOutboxEventType(value: string): value is OutboxEventType {
  return Object.values(OUTBOX_EVENT_TYPES).includes(value as OutboxEventType);
}

type OutboxEventValidatorMap = {
  [K in OutboxEventType]: (payload: unknown) => OutboxEventPayload<K>;
};

const outboxPayloadValidators: OutboxEventValidatorMap = {
  [OUTBOX_EVENT_TYPES.ORDER_CREATED]: (payload) => {
    const eventType = OUTBOX_EVENT_TYPES.ORDER_CREATED;
    const data = asObject(payload, eventType);
    assertNumber(data.branchId, `${eventType}.branchId`);
    if (data.customerId != null) {
      assertNumber(data.customerId, `${eventType}.customerId`);
    }
    if (!Array.isArray(data.ingredientRequirements)) {
      throw new Error(`${eventType}.ingredientRequirements must be an array.`);
    }
    if (data.order == null || typeof data.order !== 'object') {
      throw new Error(`${eventType}.order is required.`);
    }
    return data as OutboxEventPayload<typeof eventType>;
  },
  [OUTBOX_EVENT_TYPES.ORDER_STATUS_UPDATED]: (payload) => {
    const eventType = OUTBOX_EVENT_TYPES.ORDER_STATUS_UPDATED;
    const data = asObject(payload, eventType);
    assertNumber(data.orderId, `${eventType}.orderId`);
    assertNumber(data.branchId, `${eventType}.branchId`);
    assertOrderStatus(data.status, `${eventType}.status`);
    return data as OutboxEventPayload<typeof eventType>;
  },
  [OUTBOX_EVENT_TYPES.ORDER_VOIDED]: (payload) => {
    const eventType = OUTBOX_EVENT_TYPES.ORDER_VOIDED;
    const data = asObject(payload, eventType);
    if (data.order == null || typeof data.order !== 'object') {
      throw new Error(`${eventType}.order is required.`);
    }
    return data as OutboxEventPayload<typeof eventType>;
  },
  [OUTBOX_EVENT_TYPES.ORDER_REFUNDED]: (payload) => {
    const eventType = OUTBOX_EVENT_TYPES.ORDER_REFUNDED;
    const data = asObject(payload, eventType);
    if (data.order == null || typeof data.order !== 'object') {
      throw new Error(`${eventType}.order is required.`);
    }
    if (data.reason != null) {
      assertString(data.reason, `${eventType}.reason`);
    }
    return data as OutboxEventPayload<typeof eventType>;
  },
  [OUTBOX_EVENT_TYPES.PURCHASE_ORDER_RECEIVED]: (payload) => {
    const eventType = OUTBOX_EVENT_TYPES.PURCHASE_ORDER_RECEIVED;
    const data = asObject(payload, eventType);
    const purchaseOrder = readObject(
      data.purchaseOrder,
      `${eventType}.purchaseOrder`,
    );
    assertNumber(purchaseOrder.poId, `${eventType}.purchaseOrder.poId`);
    assertNumber(purchaseOrder.branchId, `${eventType}.purchaseOrder.branchId`);
    assertNumber(
      purchaseOrder.totalAmount,
      `${eventType}.purchaseOrder.totalAmount`,
    );
    assertString(purchaseOrder.poNumber, `${eventType}.purchaseOrder.poNumber`);
    if (purchaseOrder.standardAmount != null) {
      assertNumber(
        purchaseOrder.standardAmount,
        `${eventType}.purchaseOrder.standardAmount`,
      );
    }
    return data as OutboxEventPayload<typeof eventType>;
  },
  [OUTBOX_EVENT_TYPES.PURCHASE_ORDER_PAID]: (payload) => {
    const eventType = OUTBOX_EVENT_TYPES.PURCHASE_ORDER_PAID;
    const data = asObject(payload, eventType);
    const payment = readObject(data.payment, `${eventType}.payment`);
    assertNumber(payment.poId, `${eventType}.payment.poId`);
    assertNumber(payment.branchId, `${eventType}.payment.branchId`);
    assertNumber(payment.amount, `${eventType}.payment.amount`);
    assertString(payment.poNumber, `${eventType}.payment.poNumber`);
    assertString(payment.method, `${eventType}.payment.method`);
    return data as OutboxEventPayload<typeof eventType>;
  },
  [OUTBOX_EVENT_TYPES.PRODUCTION_COMPLETED]: (payload) => {
    const eventType = OUTBOX_EVENT_TYPES.PRODUCTION_COMPLETED;
    const data = asObject(payload, eventType);
    const production = readObject(data.production, `${eventType}.production`);
    assertNumber(production.branchId, `${eventType}.production.branchId`);
    assertNumber(
      production.totalRawCost,
      `${eventType}.production.totalRawCost`,
    );
    assertString(production.orderNumber, `${eventType}.production.orderNumber`);
    assertString(
      production.targetIngredientName,
      `${eventType}.production.targetIngredientName`,
    );
    return data as OutboxEventPayload<typeof eventType>;
  },
  [OUTBOX_EVENT_TYPES.STOCK_ADJUSTED]: (payload) => {
    const eventType = OUTBOX_EVENT_TYPES.STOCK_ADJUSTED;
    const data = asObject(payload, eventType);
    const adjustment = readObject(data.adjustment, `${eventType}.adjustment`);
    assertString(adjustment.reference, `${eventType}.adjustment.reference`);
    assertNumber(adjustment.branchId, `${eventType}.adjustment.branchId`);
    assertNumber(
      adjustment.netVarianceValue,
      `${eventType}.adjustment.netVarianceValue`,
    );
    assertString(adjustment.description, `${eventType}.adjustment.description`);
    return data as OutboxEventPayload<typeof eventType>;
  },
  [OUTBOX_EVENT_TYPES.PAYROLL_APPROVED]: (payload) => {
    const eventType = OUTBOX_EVENT_TYPES.PAYROLL_APPROVED;
    const data = asObject(payload, eventType);
    const payroll = readObject(data.payroll, `${eventType}.payroll`);
    assertNumber(payroll.payrollRunId, `${eventType}.payroll.payrollRunId`);
    if (payroll.branchId != null) {
      assertNumber(payroll.branchId, `${eventType}.payroll.branchId`);
    }
    assertNumber(payroll.totalGross, `${eventType}.payroll.totalGross`);
    assertNumber(payroll.totalNet, `${eventType}.payroll.totalNet`);
    assertNumber(
      payroll.totalDeductions,
      `${eventType}.payroll.totalDeductions`,
    );
    return data as OutboxEventPayload<typeof eventType>;
  },
  [OUTBOX_EVENT_TYPES.EXPENSE_CREATED]: (payload) => {
    const eventType = OUTBOX_EVENT_TYPES.EXPENSE_CREATED;
    const data = asObject(payload, eventType);
    const expense = readObject(data.expense, `${eventType}.expense`);
    assertNumber(expense.expenseId, `${eventType}.expense.expenseId`);
    assertNumber(expense.branchId, `${eventType}.expense.branchId`);
    assertNumber(expense.amount, `${eventType}.expense.amount`);
    assertString(expense.category, `${eventType}.expense.category`);
    return data as OutboxEventPayload<typeof eventType>;
  },
};

export function assertOutboxPayload<T extends OutboxEventType>(
  eventType: T,
  payload: unknown,
): OutboxEventPayload<T> {
  return outboxPayloadValidators[eventType](payload);
}

function asObject(
  payload: unknown,
  eventType: OutboxEventType,
): Record<string, unknown> {
  if (payload == null || typeof payload !== 'object') {
    throw new Error(`Outbox payload for ${eventType} must be an object.`);
  }
  return payload as Record<string, unknown>;
}

function readObject(value: unknown, field: string): Record<string, unknown> {
  if (value == null || typeof value !== 'object') {
    throw new Error(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${field} must be a number.`);
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }
}

function assertOrderStatus(
  value: unknown,
  field: string,
): asserts value is OrderLifecycleStatus {
  const statuses = ORDER_LIFECYCLE_STATUSES;
  if (
    typeof value !== 'string' ||
    !statuses.some((status) => status === value)
  ) {
    throw new Error(`${field} must be one of: ${statuses.join(', ')}.`);
  }
}

export function toOutboxJsonValue<T extends OutboxEventType>(
  payload: OutboxEventPayload<T>,
): Prisma.InputJsonValue {
  return payload;
}

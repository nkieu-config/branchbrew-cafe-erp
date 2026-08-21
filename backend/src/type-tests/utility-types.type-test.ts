/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  AUDIT_ACTIONS,
  AuditAction,
  AuditDetailsByAction,
  AuditTargetByAction,
  AUDIT_TARGETS,
} from '../audit/audit.service';
import {
  OUTBOX_EVENT_TYPES,
  OutboxEventPayload,
  OutboxEventType,
} from '../outbox/outbox-event.types';
import {
  ORDER_LIFECYCLE_STATUSES,
  OrderLifecycleStatus,
  OrderSnapshot,
} from '../orders/domain/order.snapshot';
import type {
  AccountType as PrismaAccountType,
  OrderStatus as PrismaOrderStatus,
  PaymentMethod as PrismaPaymentMethod,
} from '@prisma/client';
import { OrderPaymentMethod } from '../orders/domain/order-status.rules';
import { LedgerAccountType } from '../accounting/domain/normal-balance';
import { PaymentAccountMethod } from '../accounting/domain/payment-accounts';
import { ProductionCompletedSnapshot } from '../production/domain/production-completed.snapshot';
import { PurchaseOrderReceivedSnapshot } from '../procurement/domain/purchase-order-received.snapshot';
import {
  DbSettingsMap,
  SETTINGS_KEY_MAP,
  SettingsCamelKey,
  SettingsDbKey,
} from '../settings/settings-keys.util';

type Assert<T extends true> = T;
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

type _OutboxEventTypeIsDerived = Assert<
  IsEqual<
    OutboxEventType,
    (typeof OUTBOX_EVENT_TYPES)[keyof typeof OUTBOX_EVENT_TYPES]
  >
>;

type _OrderCreatedPayloadShape = Assert<
  IsEqual<
    OutboxEventPayload<typeof OUTBOX_EVENT_TYPES.ORDER_CREATED>['order'],
    OrderSnapshot
  >
>;

type _OrderStatusPayloadStatus = Assert<
  IsEqual<
    OutboxEventPayload<
      typeof OUTBOX_EVENT_TYPES.ORDER_STATUS_UPDATED
    >['status'],
    OrderLifecycleStatus
  >
>;

type _OrderStatusUnionMatchesConstant = Assert<
  IsEqual<OrderLifecycleStatus, (typeof ORDER_LIFECYCLE_STATUSES)[number]>
>;

type _PoReceivedPayloadShape = Assert<
  IsEqual<
    OutboxEventPayload<
      typeof OUTBOX_EVENT_TYPES.PURCHASE_ORDER_RECEIVED
    >['purchaseOrder'],
    PurchaseOrderReceivedSnapshot
  >
>;

type _ProductionCompletedPayloadShape = Assert<
  IsEqual<
    OutboxEventPayload<
      typeof OUTBOX_EVENT_TYPES.PRODUCTION_COMPLETED
    >['production'],
    ProductionCompletedSnapshot
  >
>;

type _SettingsKeyRoundTrip = Assert<
  IsEqual<SettingsDbKey, (typeof SETTINGS_KEY_MAP)[SettingsCamelKey]>
>;

type _SettingsMapType = Assert<IsEqual<DbSettingsMap, Record<string, string>>>;

type _AuditActionUnion = Assert<
  IsEqual<AuditAction, (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]>
>;

type _AuditTargetConstraint = Assert<
  IsEqual<
    AuditTargetByAction[typeof AUDIT_ACTIONS.UPDATE_SETTINGS],
    'SystemSetting'
  >
>;

type _AuditDetailsConstraint = Assert<
  IsEqual<
    AuditDetailsByAction[typeof AUDIT_ACTIONS.GENERATE_PAYROLL],
    {
      branchId: number;
      month: number;
      year: number;
      payslipCount: number;
    }
  >
>;

type _AuditTargetLiteral = Assert<IsEqual<typeof AUDIT_TARGETS.ORDER, 'Order'>>;

/**
 * Anti-corruption boundary between the domain layer and the database schema.
 *
 * Files under `src/**‍/domain/` may not import `@prisma/client` (enforced by the
 * `dependency-rule/domain-is-framework-free` block in eslint.config.mjs), so each
 * one declares the vocabulary it needs as a local union. These assertions are what
 * keeps those unions honest: widen or rename a Prisma enum without updating the
 * matching domain union and the type-check fails here rather than at runtime.
 */
type _OrderLifecycleStatusMatchesSchema = Assert<
  IsEqual<OrderLifecycleStatus, PrismaOrderStatus>
>;

type _OrderPaymentMethodMatchesSchema = Assert<
  IsEqual<OrderPaymentMethod, PrismaPaymentMethod>
>;

type _LedgerAccountTypeMatchesSchema = Assert<
  IsEqual<LedgerAccountType, PrismaAccountType>
>;

type _PaymentAccountMethodCoversSchema = Assert<
  IsEqual<PaymentAccountMethod, PrismaPaymentMethod>
>;

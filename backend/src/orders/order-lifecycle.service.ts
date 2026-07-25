import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox-event.types';
import { toNum } from '../common/decimal.util';
import {
  assertBranchAccess,
  BranchScopedUser,
} from '../auth/branch-scope.util';
import {
  isSameCalendarDay,
  isTerminalOrderStatus,
} from './helpers/order-void.util';
import { canTransitionOrderStatus } from './helpers/order-status.util';
import { kdsOrderInclude } from './kds-order.include';
import {
  applyOrderReversalEffects,
  ORDER_REVERSAL_INCLUDE,
} from './helpers/order-reversal.helper';
import {
  assertRefundable,
  isOrderRefundValidationError,
  OrderRefundErrorKind,
} from './helpers/order-refund.util';
import { AuditService } from '../audit/audit.service';
import { orderListInclude } from './orders.types';
import { ApiErrorCode } from '../common/errors/api-error-code.enum';
import {
  appBadRequest,
  appNotFound,
  AppException,
} from '../common/errors/app.exception';
import { AUDIT_ACTIONS, AUDIT_TARGETS } from '../audit/audit.service';
import { toOrderSnapshot } from './domain/order.snapshot';

const OPERATIONAL_ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'PREPARING',
  'COMPLETED',
];

@Injectable()
export class OrderLifecycleService {
  constructor(
    private prisma: PrismaService,
    private outboxService: OutboxService,
    private auditService: AuditService,
  ) {}

  async findPage(options: {
    branchId?: number;
    since: Date;
    take: number;
    skip: number;
  }) {
    const where = {
      ...(options.branchId ? { branchId: options.branchId } : {}),
      createdAt: { gte: options.since },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderListInclude,
        orderBy: { createdAt: 'desc' },
        take: options.take,
        skip: options.skip,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: number, user?: BranchScopedUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderListInclude,
    });
    if (!order) {
      throw appNotFound(ApiErrorCode.ORDER_NOT_FOUND, 'Order not found');
    }
    if (user) assertBranchAccess(user, order.branchId);
    return order;
  }

  getKdsOrders(branchId: number) {
    return this.prisma.order.findMany({
      where: {
        branchId,
        status: { in: ['PENDING', 'PREPARING'] },
      },
      include: kdsOrderInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateOrderStatus(
    orderId: number,
    status: OrderStatus,
    user?: BranchScopedUser,
  ) {
    if (!OPERATIONAL_ORDER_STATUSES.includes(status)) {
      throw appBadRequest(
        ApiErrorCode.ORDER_STATUS_INVALID,
        'Use void or refund endpoints for terminal order statuses.',
      );
    }

    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!existing) {
      throw appNotFound(ApiErrorCode.ORDER_NOT_FOUND, 'Order not found');
    }
    if (user) assertBranchAccess(user, existing.branchId);

    if (isTerminalOrderStatus(existing.status)) {
      throw appBadRequest(
        ApiErrorCode.ORDER_ALREADY_REVERSED,
        'Voided or refunded orders cannot change status.',
      );
    }
    if (existing.status === status) {
      return existing;
    }
    if (!canTransitionOrderStatus(existing.status, status)) {
      throw appBadRequest(
        ApiErrorCode.ORDER_STATUS_INVALID,
        `Cannot move order from ${existing.status} to ${status}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: existing.status },
        data: { status },
      });
      if (claimed.count === 0) {
        throw appBadRequest(
          ApiErrorCode.ORDER_STATUS_INVALID,
          'Order changed while updating its status. Please retry.',
        );
      }

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
      });

      await this.outboxService.enqueue(
        tx,
        OUTBOX_EVENT_TYPES.ORDER_STATUS_UPDATED,
        {
          orderId: order.id,
          status: order.status,
          branchId: existing.branchId,
        },
      );

      return order;
    });
  }

  async voidOrder(orderId: number, user?: BranchScopedUser) {
    const existing = await this.loadOrderForReversal(orderId, user);

    if (isTerminalOrderStatus(existing.status)) {
      throw appBadRequest(
        ApiErrorCode.ORDER_ALREADY_REVERSED,
        'Order is already voided or refunded.',
      );
    }

    if (!isSameCalendarDay(existing.createdAt, new Date())) {
      throw appBadRequest(
        ApiErrorCode.ORDER_VOID_SAME_DAY_ONLY,
        'Only same-day orders can be voided. Use refund flow for older orders.',
      );
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: { in: [...OPERATIONAL_ORDER_STATUSES] } },
        data: { status: 'CANCELLED' },
      });
      if (claimed.count === 0) {
        throw appBadRequest(
          ApiErrorCode.ORDER_ALREADY_REVERSED,
          'Order is already voided or refunded.',
        );
      }

      await applyOrderReversalEffects(tx, existing);

      const updated = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
          customer: true,
          promotion: true,
        },
      });

      await this.outboxService.enqueue(tx, OUTBOX_EVENT_TYPES.ORDER_VOIDED, {
        order: toOrderSnapshot(updated),
      });
      await this.outboxService.enqueue(
        tx,
        OUTBOX_EVENT_TYPES.ORDER_STATUS_UPDATED,
        {
          orderId: updated.id,
          status: updated.status,
          branchId: existing.branchId,
        },
      );

      return updated;
    });

    if (user) {
      await this.auditService.logAction(
        user.userId,
        AUDIT_ACTIONS.VOID_ORDER,
        AUDIT_TARGETS.ORDER,
        orderId,
        {
          branchId: existing.branchId,
          netAmount: toNum(order.netAmount),
          totalCogs: toNum(order.totalCogs),
        },
      );
    }

    return order;
  }

  async refundOrder(orderId: number, reason?: string, user?: BranchScopedUser) {
    const existing = await this.loadOrderForReversal(orderId, user);

    try {
      assertRefundable(existing.createdAt, existing.status);
    } catch (err) {
      throw this.mapRefundError(err);
    }

    const trimmedReason = reason?.trim();

    const order = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: 'COMPLETED' },
        data: {
          status: 'REFUNDED',
          refundReason: trimmedReason || null,
          refundedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw appBadRequest(
          ApiErrorCode.ORDER_ALREADY_REVERSED,
          'Order is already voided or refunded.',
        );
      }

      await applyOrderReversalEffects(tx, existing);

      const updated = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
          customer: true,
          promotion: true,
        },
      });

      await this.outboxService.enqueue(tx, OUTBOX_EVENT_TYPES.ORDER_REFUNDED, {
        order: toOrderSnapshot(updated),
        reason: trimmedReason,
      });
      await this.outboxService.enqueue(
        tx,
        OUTBOX_EVENT_TYPES.ORDER_STATUS_UPDATED,
        {
          orderId: updated.id,
          status: updated.status,
          branchId: existing.branchId,
        },
      );

      return updated;
    });

    if (user) {
      await this.auditService.logAction(
        user.userId,
        AUDIT_ACTIONS.REFUND_ORDER,
        AUDIT_TARGETS.ORDER,
        orderId,
        {
          branchId: existing.branchId,
          netAmount: toNum(order.netAmount),
          totalCogs: toNum(order.totalCogs),
          reason: trimmedReason,
        },
      );
    }

    return order;
  }

  private async loadOrderForReversal(orderId: number, user?: BranchScopedUser) {
    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_REVERSAL_INCLUDE,
    });

    if (!existing) {
      throw appNotFound(ApiErrorCode.ORDER_NOT_FOUND, 'Order not found');
    }
    if (user) assertBranchAccess(user, existing.branchId);
    return existing;
  }

  private mapRefundError(err: unknown): AppException {
    if (!isOrderRefundValidationError(err)) {
      return appBadRequest(
        ApiErrorCode.ORDER_REFUND_NOT_ALLOWED,
        'Order cannot be refunded.',
      );
    }

    const code: OrderRefundErrorKind = err.detail.kind;
    switch (code) {
      case 'ORDER_ALREADY_REVERSED':
        return appBadRequest(
          ApiErrorCode.ORDER_ALREADY_REVERSED,
          'Order is already voided or refunded.',
        );
      case 'REFUND_NOT_COMPLETED':
        return appBadRequest(
          ApiErrorCode.ORDER_REFUND_NOT_COMPLETED,
          'Only completed orders can be refunded.',
        );
      case 'REFUND_SAME_DAY':
        return appBadRequest(
          ApiErrorCode.ORDER_REFUND_SAME_DAY,
          'Same-day orders should be voided, not refunded.',
        );
      default:
        return this.assertNeverRefundError(code);
    }
  }

  private assertNeverRefundError(code: never): AppException {
    return appBadRequest(
      ApiErrorCode.ORDER_REFUND_NOT_ALLOWED,
      `Order cannot be refunded (${String(code)}).`,
    );
  }
}

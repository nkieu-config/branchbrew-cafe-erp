import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  POStatus,
  Prisma,
  PurchaseOrder,
  PurchaseOrderItem,
  SupplierPaymentMethod,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuditService,
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
} from '../audit/audit.service';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderCreatedEvent } from '../orders/events/order-created.event';
import {
  assertBranchAccess,
  BranchScopedUser,
} from '../auth/branch-scope.util';
import { OutboxService } from '../outbox/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox-event.types';
import { dec, roundMoney } from '../common/decimal.util';
import {
  allocatePoNumber,
  isPoNumberConflict,
  MAX_PO_NUMBER_RETRIES,
} from './helpers/po-number.helper';
import { toPurchaseOrderReceivedSnapshot } from './domain/purchase-order-received.snapshot';
import { toPurchaseOrderPaidSnapshot } from './domain/purchase-order-paid.snapshot';
import { NotificationsService } from '../notifications/notifications.service';

const AP_AGING_BUCKETS = [
  { range: '0-30', minDays: 0, maxDays: 30 },
  { range: '31-60', minDays: 31, maxDays: 60 },
  { range: '61+', minDays: 61, maxDays: Infinity },
] as const;

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private outboxService: OutboxService,
    private notifications: NotificationsService,
  ) {}

  @OnEvent('order.created', { async: true })
  async handleOrderCreated(event: OrderCreatedEvent) {
    this.logger.log(`Handling order.created event for Order ${event.order.id}`);
    for (const ingredientId of event.ingredientRequirements.keys()) {
      await this.checkAndAutoReorder(event.branchId, ingredientId);
    }
  }

  findAllSuppliers() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }

  createSupplier(data: {
    name: string;
    contactEmail?: string;
    phone?: string;
  }) {
    return this.prisma.supplier.create({ data });
  }

  updateSupplier(
    id: number,
    data: { name?: string; contactEmail?: string; phone?: string },
  ) {
    return this.prisma.supplier.update({ where: { id }, data });
  }

  async deleteSupplier(id: number) {
    const linked = await this.prisma.purchaseOrder.count({
      where: { supplierId: id },
    });
    if (linked > 0) {
      throw new BadRequestException(
        'Cannot delete supplier with existing purchase orders',
      );
    }
    return this.prisma.supplier.delete({ where: { id } });
  }

  findAllPOs(branchId?: number) {
    return this.prisma.purchaseOrder.findMany({
      where: branchId ? { branchId } : undefined,
      include: {
        supplier: true,
        branch: true,
        items: { include: { ingredient: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPO(
    data: {
      branchId: number;
      supplierId: number;
      items: { ingredientId: number; quantity: number; price: number }[];
    },
    userId?: number,
  ): Promise<PurchaseOrder & { items: PurchaseOrderItem[] }> {
    return await this.createPOWithRetry(data, userId);
  }

  private async createPOWithRetry(
    data: {
      branchId: number;
      supplierId: number;
      items: { ingredientId: number; quantity: number; price: number }[];
    },
    userId?: number,
    attempt = 0,
  ): Promise<PurchaseOrder & { items: PurchaseOrderItem[] }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const poNumber = await allocatePoNumber(tx, 'PO');
        const po = await tx.purchaseOrder.create({
          data: {
            poNumber,
            branchId: data.branchId,
            supplierId: data.supplierId,
            status: 'DRAFT',
            items: {
              create: data.items.map((item) => ({
                ingredientId: item.ingredientId,
                quantityRequested: item.quantity,
                unitPrice: item.price,
              })),
            },
          },
          include: { items: true },
        });

        if (userId) {
          await this.auditService.logAction(
            userId,
            AUDIT_ACTIONS.CREATE_PO,
            AUDIT_TARGETS.PURCHASE_ORDER,
            po.id,
            { poNumber: po.poNumber },
          );
        }

        return po;
      });
    } catch (err) {
      if (isPoNumberConflict(err) && attempt < MAX_PO_NUMBER_RETRIES) {
        return this.createPOWithRetry(data, userId, attempt + 1);
      }
      throw err;
    }
  }

  private async validatePOStatus(
    poId: number,
    allowedStatuses: POStatus[],
    actionName: string,
    txClient: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const po = await txClient.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });
    if (!po) throw new BadRequestException('PO not found');
    if (!allowedStatuses.includes(po.status)) {
      throw new BadRequestException(
        `Cannot ${actionName} PO with status ${po.status}`,
      );
    }
    return po;
  }

  async submitPO(poId: number, userId: number, user: BranchScopedUser) {
    const po = await this.validatePOStatus(poId, ['DRAFT'], 'submit');
    assertBranchAccess(user, po.branchId);

    if (po.items.length === 0) {
      throw new BadRequestException(
        'Cannot submit a purchase order with no items',
      );
    }

    const updatedPo = await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'PENDING' },
    });

    await this.auditService.logAction(
      userId,
      AUDIT_ACTIONS.SUBMIT_PO,
      AUDIT_TARGETS.PURCHASE_ORDER,
      poId,
      { poNumber: po.poNumber, isAutoGenerated: po.isAutoGenerated },
    );

    await this.notifications.notifyBranch({
      branchId: po.branchId,
      type: 'PO_PENDING_APPROVAL',
      title: `PO ${po.poNumber} awaiting approval`,
      link: '/procurement/orders?status=PENDING',
      dedupeKey: `po-${poId}`,
    });

    return updatedPo;
  }

  async approvePO(poId: number, userId: number, user: BranchScopedUser) {
    const po = await this.validatePOStatus(poId, ['PENDING'], 'approve');
    assertBranchAccess(user, po.branchId);

    const updatedPo = await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
    });

    await this.auditService.logAction(
      userId,
      AUDIT_ACTIONS.APPROVE_PO,
      AUDIT_TARGETS.PURCHASE_ORDER,
      poId,
      { poNumber: po.poNumber },
    );
    return updatedPo;
  }

  async rejectPO(poId: number, userId: number, user: BranchScopedUser) {
    const po = await this.validatePOStatus(poId, ['PENDING'], 'reject');
    assertBranchAccess(user, po.branchId);

    const updatedPo = await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'DRAFT' }, // Send back to draft or Cancelled. Using DRAFT so it can be edited.
    });

    await this.auditService.logAction(
      userId,
      AUDIT_ACTIONS.REJECT_PO,
      AUDIT_TARGETS.PURCHASE_ORDER,
      poId,
      { poNumber: po.poNumber },
    );
    return updatedPo;
  }

  async receivePO(
    poId: number,
    userId?: number,
    expiryDates?: { ingredientId: number; date: string }[],
    user?: BranchScopedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const po = await this.validatePOStatus(poId, ['APPROVED'], 'receive', tx);
      if (user) assertBranchAccess(user, po.branchId);

      const claimed = await tx.purchaseOrder.updateMany({
        where: { id: poId, status: 'APPROVED' },
        data: { status: 'RECEIVED' },
      });
      if (claimed.count === 0) {
        throw new BadRequestException(
          'Purchase order changed while receiving. Please retry.',
        );
      }

      // 1. Update BranchInventory (Cached Total)
      // 2. Create InventoryBatch (FIFO Log)
      for (const item of po.items) {
        // Create Batch
        const expiryDateStr = expiryDates?.find(
          (e) => e.ingredientId === item.ingredientId,
        )?.date;
        const expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;

        await tx.inventoryBatch.create({
          data: {
            branchId: po.branchId,
            ingredientId: item.ingredientId,
            quantity: item.quantityRequested,
            expiryDate: expiryDate,
            poId: po.id,
            status: 'ACTIVE',
          },
        });

        // Update Cached BranchInventory
        await tx.branchInventory.upsert({
          where: {
            branchId_ingredientId: {
              branchId: po.branchId,
              ingredientId: item.ingredientId,
            },
          },
          update: { stock: { increment: item.quantityRequested } },
          create: {
            branchId: po.branchId,
            ingredientId: item.ingredientId,
            stock: item.quantityRequested,
            minStock: 0,
          },
        });
      }

      const updatedPo = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id: poId },
      });

      if (userId) {
        await this.auditService.logAction(
          userId,
          AUDIT_ACTIONS.RECEIVE_PO,
          AUDIT_TARGETS.PURCHASE_ORDER,
          poId,
          { poNumber: po.poNumber },
          tx,
        );
      }

      const totalAmount = roundMoney(
        po.items.reduce(
          (sum, item) =>
            sum.plus(dec(item.unitPrice).times(item.quantityRequested)),
          dec(0),
        ),
      );

      const standardCosts = await tx.ingredient.findMany({
        where: { id: { in: po.items.map((item) => item.ingredientId) } },
        select: { id: true, costPerUnit: true },
      });
      const standardCostByIngredient = new Map(
        standardCosts.map((ingredient) => [
          ingredient.id,
          dec(ingredient.costPerUnit),
        ]),
      );

      const standardAmount = roundMoney(
        po.items.reduce((sum, item) => {
          const standardCost =
            standardCostByIngredient.get(item.ingredientId) ?? dec(0);
          const unitCost = standardCost.isZero()
            ? dec(item.unitPrice)
            : standardCost;
          return sum.plus(unitCost.times(item.quantityRequested));
        }, dec(0)),
      );

      if (totalAmount > 0) {
        await this.outboxService.enqueue(
          tx,
          OUTBOX_EVENT_TYPES.PURCHASE_ORDER_RECEIVED,
          {
            purchaseOrder: toPurchaseOrderReceivedSnapshot({
              poId: po.id,
              poNumber: po.poNumber,
              branchId: po.branchId,
              totalAmount,
              standardAmount,
            }),
          },
        );
      }

      return updatedPo;
    });
  }

  async payPO(
    poId: number,
    userId: number,
    user: BranchScopedUser,
    data: { method: SupplierPaymentMethod; notes?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const po = await this.validatePOStatus(poId, ['RECEIVED'], 'pay', tx);
      assertBranchAccess(user, po.branchId);

      if (po.paymentStatus === 'PAID') {
        throw new BadRequestException(
          'This purchase order has already been paid.',
        );
      }

      const amount = roundMoney(
        po.items.reduce(
          (sum, item) =>
            sum.plus(dec(item.unitPrice).times(item.quantityRequested)),
          dec(0),
        ),
      );
      if (amount <= 0) {
        throw new BadRequestException(
          'Purchase order total must be above zero to record a payment.',
        );
      }

      const claimed = await tx.purchaseOrder.updateMany({
        where: { id: poId, paymentStatus: 'UNPAID' },
        data: { paymentStatus: 'PAID', paidAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new BadRequestException(
          'Purchase order changed while paying. Please retry.',
        );
      }

      await tx.supplierPayment.create({
        data: {
          poId,
          supplierId: po.supplierId,
          branchId: po.branchId,
          amount,
          method: data.method,
          notes: data.notes,
          paidByUserId: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: AUDIT_ACTIONS.PAY_PO,
          targetType: AUDIT_TARGETS.PURCHASE_ORDER,
          targetId: poId,
          details: JSON.stringify({
            poNumber: po.poNumber,
            amount,
            method: data.method,
          }),
        },
      });

      await this.outboxService.enqueue(
        tx,
        OUTBOX_EVENT_TYPES.PURCHASE_ORDER_PAID,
        {
          payment: toPurchaseOrderPaidSnapshot({
            poId,
            poNumber: po.poNumber,
            branchId: po.branchId,
            amount,
            method: data.method,
          }),
        },
      );

      return tx.purchaseOrder.findUnique({
        where: { id: poId },
        include: {
          supplier: true,
          items: { include: { ingredient: true } },
          payment: true,
        },
      });
    });
  }

  async getApAging(branchId?: number) {
    const unpaidPOs = await this.prisma.purchaseOrder.findMany({
      where: {
        status: 'RECEIVED',
        paymentStatus: 'UNPAID',
        ...(branchId ? { branchId } : {}),
      },
      include: { items: true },
    });

    const now = Date.now();
    const buckets = AP_AGING_BUCKETS.map((b) => ({
      range: b.range,
      amount: dec(0),
      count: 0,
    }));
    let total = dec(0);

    for (const po of unpaidPOs) {
      const poTotal = po.items.reduce(
        (sum, item) =>
          sum.plus(dec(item.unitPrice).times(item.quantityRequested)),
        dec(0),
      );
      const ageDays = Math.floor(
        (now - po.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const bucketIndex = AP_AGING_BUCKETS.findIndex(
        (b) => ageDays >= b.minDays && ageDays <= b.maxDays,
      );
      const bucket = buckets[bucketIndex] ?? buckets[buckets.length - 1];
      bucket.amount = bucket.amount.plus(poTotal);
      bucket.count += 1;
      total = total.plus(poTotal);
    }

    return {
      totalOutstanding: roundMoney(total),
      poCount: unpaidPOs.length,
      buckets: buckets.map((b) => ({
        range: b.range,
        amount: roundMoney(b.amount),
        count: b.count,
      })),
    };
  }

  async checkAndAutoReorder(branchId: number, ingredientId: number) {
    const inventory = await this.prisma.branchInventory.findUnique({
      where: { branchId_ingredientId: { branchId, ingredientId } },
      include: { ingredient: true },
    });

    if (!inventory || inventory.stock > inventory.minStock) return;

    const supplierId = inventory.ingredient.primarySupplierId;
    if (!supplierId) {
      console.warn(
        `[Auto-Reorder] No primary supplier for ingredient ${inventory.ingredient.name}. Skipping.`,
      );
      return;
    }

    await this.prisma.$transaction(
      async (tx) => {
        // Check if there is already an active PO (DRAFT or PENDING) containing this ingredient
        const existingPO = await tx.purchaseOrder.findFirst({
          where: {
            branchId,
            supplierId,
            status: { in: ['DRAFT', 'PENDING'] },
            items: { some: { ingredientId } },
          },
        });

        if (existingPO) {
          console.log(
            `[Auto-Reorder] Active PO already exists for ${inventory.ingredient.name}. Skipping.`,
          );
          return;
        }

        // Create or find a DRAFT PO to attach to
        const draftPo = await tx.purchaseOrder.findFirst({
          where: {
            branchId,
            supplierId,
            status: 'DRAFT',
            isAutoGenerated: true,
          },
        });

        const orderQuantity = Math.max(inventory.minStock * 2, 10); // Simple logic

        if (draftPo) {
          await tx.purchaseOrderItem.create({
            data: {
              poId: draftPo.id,
              ingredientId,
              quantityRequested: orderQuantity,
              unitPrice: inventory.ingredient.costPerUnit || 0,
            },
          });
          console.log(
            `[Auto-Reorder] Appended ${inventory.ingredient.name} to existing Draft PO ${draftPo.poNumber}`,
          );
        } else {
          const poNumber = await allocatePoNumber(tx, 'PO-AUTO');
          await tx.purchaseOrder.create({
            data: {
              poNumber,
              branchId,
              supplierId,
              status: 'DRAFT',
              isAutoGenerated: true,
              items: {
                create: [
                  {
                    ingredientId,
                    quantityRequested: orderQuantity,
                    unitPrice: inventory.ingredient.costPerUnit || 0,
                  },
                ],
              },
            },
          });
          console.log(
            `[Auto-Reorder] Created new Draft PO for ${inventory.ingredient.name}`,
          );
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}

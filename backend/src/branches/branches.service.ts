import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertBranchAccess,
  BranchScopedUser,
} from '../auth/branch-scope.util';
import { SAFE_USER_SELECT } from '../common/user-select';
import { provisionBranchInventoryForBranch } from '../common/helpers/branch-inventory-provision.helper';
import { WasteDisposalHelper } from '../inventory/helpers/waste-disposal.helper';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: number) {
    return this.prisma.branch.findMany({
      where: branchId ? { id: branchId } : undefined,
      include: {
        inventories: {
          include: { ingredient: true },
        },
      },
    });
  }

  async createBranch(data: {
    name: string;
    location?: string;
    isCentralKitchen?: boolean;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({ data });
      await provisionBranchInventoryForBranch(tx, branch.id);
      return branch;
    });
  }

  /** Backfill BranchInventory rows for an existing branch (idempotent). */
  async syncBranchInventory(branchId: number) {
    const rowsCreated = await provisionBranchInventoryForBranch(
      this.prisma,
      branchId,
    );
    return { branchId, rowsCreated };
  }

  async updateBranch(
    id: number,
    data: { name?: string; location?: string; isCentralKitchen?: boolean },
  ) {
    return this.prisma.branch.update({
      where: { id },
      data,
    });
  }

  async findOne(id: number) {
    return this.prisma.branch.findUnique({
      where: { id },
      include: {
        inventories: {
          include: { ingredient: true },
        },
        inventoryBatches: {
          where: { status: 'ACTIVE' },
          include: { ingredient: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async createTransfer(data: {
    fromBranchId: number;
    toBranchId: number;
    ingredientId: number;
    quantity: number;
    requestedById: number;
  }) {
    // Basic validation
    const fromInv = await this.prisma.branchInventory.findUnique({
      where: {
        branchId_ingredientId: {
          branchId: data.fromBranchId,
          ingredientId: data.ingredientId,
        },
      },
    });

    if (!fromInv || fromInv.stock < data.quantity) {
      throw new BadRequestException('Not enough stock in the source branch.');
    }

    return this.prisma.stockTransfer.create({
      data: {
        fromBranchId: data.fromBranchId,
        toBranchId: data.toBranchId,
        ingredientId: data.ingredientId,
        quantity: data.quantity,
        requestedById: data.requestedById,
        status: 'PENDING',
      },
    });
  }

  async getAllTransfers() {
    return this.prisma.stockTransfer.findMany({
      include: {
        fromBranch: true,
        toBranch: true,
        ingredient: true,
        requestedBy: { select: SAFE_USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTransfers(branchId: number) {
    return this.prisma.stockTransfer.findMany({
      where: {
        OR: [{ fromBranchId: branchId }, { toBranchId: branchId }],
      },
      include: {
        fromBranch: true,
        toBranch: true,
        ingredient: true,
        requestedBy: { select: SAFE_USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptTransfer(
    transferId: number,
    approvedById: number,
    user?: BranchScopedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
      });
      if (!transfer) throw new BadRequestException('Transfer not found');
      if (user) assertBranchAccess(user, transfer.toBranchId);

      const claimed = await tx.stockTransfer.updateMany({
        where: { id: transferId, status: 'PENDING' },
        data: { status: 'COMPLETED', approvedById },
      });
      if (claimed.count === 0)
        throw new BadRequestException('Transfer already processed');

      // Deduct from Source InventoryBatch
      let remainingToDeduct = transfer.quantity;
      const consumedExpiries: Date[] = [];
      const activeBatches = await tx.inventoryBatch.findMany({
        where: {
          branchId: transfer.fromBranchId,
          ingredientId: transfer.ingredientId,
          status: 'ACTIVE',
        },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      });

      for (const batch of activeBatches) {
        if (remainingToDeduct <= 0) break;
        if (batch.expiryDate) consumedExpiries.push(batch.expiryDate);
        if (batch.quantity <= remainingToDeduct) {
          remainingToDeduct -= batch.quantity;
          const updatedBatch = await tx.inventoryBatch.updateMany({
            where: { id: batch.id, quantity: batch.quantity },
            data: { quantity: 0, status: 'DEPLETED' },
          });
          if (updatedBatch.count === 0) {
            throw new BadRequestException(
              'Source batch changed while accepting transfer. Please retry.',
            );
          }
        } else {
          const updatedBatch = await tx.inventoryBatch.updateMany({
            where: { id: batch.id, quantity: { gte: remainingToDeduct } },
            data: { quantity: { decrement: remainingToDeduct } },
          });
          if (updatedBatch.count === 0) {
            throw new BadRequestException(
              'Source batch changed while accepting transfer. Please retry.',
            );
          }
          remainingToDeduct = 0;
        }
      }

      if (remainingToDeduct > 0) {
        throw new BadRequestException(
          'Source branch does not have enough batches to transfer',
        );
      }

      // Deduct from Source BranchInventory
      const updatedSourceInventory = await tx.branchInventory.updateMany({
        where: {
          branchId: transfer.fromBranchId,
          ingredientId: transfer.ingredientId,
          stock: { gte: transfer.quantity },
        },
        data: { stock: { decrement: transfer.quantity } },
      });
      if (updatedSourceInventory.count === 0) {
        throw new BadRequestException(
          'Source branch does not have enough stock to transfer',
        );
      }

      // Add to Target InventoryBatch
      await tx.inventoryBatch.create({
        data: {
          branchId: transfer.toBranchId,
          ingredientId: transfer.ingredientId,
          quantity: transfer.quantity,
          status: 'ACTIVE',
          expiryDate: consumedExpiries.length
            ? consumedExpiries.reduce((a, b) => (a < b ? a : b))
            : null,
        },
      });

      // Add to Target BranchInventory
      await tx.branchInventory.upsert({
        where: {
          branchId_ingredientId: {
            branchId: transfer.toBranchId,
            ingredientId: transfer.ingredientId,
          },
        },
        update: { stock: { increment: transfer.quantity } },
        create: {
          branchId: transfer.toBranchId,
          ingredientId: transfer.ingredientId,
          stock: transfer.quantity,
          minStock: 0,
        },
      });

      // Record AuditLog
      await tx.auditLog.create({
        data: {
          userId: approvedById,
          action: 'ACCEPT_TRANSFER',
          targetType: 'StockTransfer',
          targetId: transferId,
          details: `Transferred ${transfer.quantity} of Ingredient ${transfer.ingredientId} from Branch ${transfer.fromBranchId} to ${transfer.toBranchId}`,
        },
      });

      return tx.stockTransfer.findUniqueOrThrow({ where: { id: transferId } });
    });
  }

  async addInventoryBatch(
    branchId: number,
    data: { ingredientId: number; quantity: number; expiryDate?: string },
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.inventoryBatch.create({
        data: {
          branchId,
          ingredientId: data.ingredientId,
          quantity: data.quantity,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          status: 'ACTIVE',
        },
      });

      const inv = await tx.branchInventory.findUnique({
        where: {
          branchId_ingredientId: { branchId, ingredientId: data.ingredientId },
        },
      });

      if (inv) {
        await tx.branchInventory.update({
          where: { id: inv.id },
          data: { stock: { increment: data.quantity } },
        });
      } else {
        await tx.branchInventory.create({
          data: {
            branchId,
            ingredientId: data.ingredientId,
            stock: data.quantity,
            minStock: 0,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: 'ADD_BATCH',
          targetType: 'InventoryBatch',
          targetId: batch.id,
          details: `Added ${data.quantity} units of ingredient ${data.ingredientId}`,
        },
      });

      return batch;
    });
  }

  async reportWaste(
    branchId: number,
    data: {
      batchId?: number;
      ingredientId: number;
      quantity: number;
      reason: string;
    },
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) =>
      WasteDisposalHelper.recordWaste(tx, branchId, data, userId),
    );
  }
}

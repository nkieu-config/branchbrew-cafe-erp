import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_ORDER_STATUSES = ['COMPLETED', 'PENDING', 'PREPARING'] as const;

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRetailBranchIds() {
    return this.prisma.branch.findMany({
      where: { isCentralKitchen: false },
      select: { id: true },
    });
  }

  groupTopBranchSalesToday(retailBranchIds: number[], today: Date) {
    return this.prisma.order.groupBy({
      by: ['branchId'],
      _sum: { netAmount: true },
      where: {
        branchId: { in: retailBranchIds },
        createdAt: { gte: today },
        status: { in: [...ACTIVE_ORDER_STATUSES] },
      },
      orderBy: { _sum: { netAmount: 'desc' } },
      take: 1,
    });
  }

  querySalesTrends(sevenDaysAgo: Date, branchId?: number) {
    const branchFilter = branchId
      ? Prisma.sql`AND "branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<
      { date: string; total: number; orders: bigint }[]
    >`
      SELECT 
        to_char("createdAt", 'YYYY-MM-DD') as date,
        SUM("netAmount") as total,
        COUNT(*)::bigint as orders
      FROM "Order"
      WHERE "createdAt" >= ${sevenDaysAgo}
      AND "status" IN ('COMPLETED', 'PENDING', 'PREPARING')
      ${branchFilter}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  }

  groupTopProducts(today: Date, branchId?: number) {
    return this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      where: {
        order: {
          createdAt: { gte: today },
          status: 'COMPLETED',
          ...(branchId ? { branchId } : {}),
        },
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });
  }

  findOrderItemsForProducts(
    today: Date,
    productIds: number[],
    branchId?: number,
  ) {
    return this.prisma.orderItem.findMany({
      where: {
        productId: { in: productIds },
        order: {
          createdAt: { gte: today },
          status: 'COMPLETED',
          ...(branchId ? { branchId } : {}),
        },
      },
      select: { productId: true, quantity: true, price: true },
    });
  }

  aggregateMonthlyProfitInputs(startOfMonth: Date, branchId?: number) {
    const whereBranch = branchId ? { branchId } : {};

    return Promise.all([
      this.prisma.order.aggregate({
        where: {
          ...whereBranch,
          createdAt: { gte: startOfMonth },
          status: { in: [...ACTIVE_ORDER_STATUSES] },
        },
        _sum: { netAmount: true, taxAmount: true, totalCogs: true },
      }),
      this.prisma.expense.aggregate({
        where: { ...whereBranch, createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.payslip.aggregate({
        where: {
          payrollRun: {
            ...(branchId && { branchId }),
            createdAt: { gte: startOfMonth },
          },
        },
        _sum: { grossPay: true },
      }),
    ]);
  }

  aggregateSalesWindow(window: { gte: Date; lt?: Date }, branchId?: number) {
    const whereBranch = branchId ? { branchId } : {};
    return this.prisma.order.aggregate({
      where: {
        ...whereBranch,
        createdAt: window,
        status: { in: [...ACTIVE_ORDER_STATUSES] },
      },
      _sum: { netAmount: true },
      _count: { _all: true },
    });
  }

  findLowStockInventories(branchId?: number) {
    const whereBranch = branchId ? { branchId } : {};
    return this.prisma.branchInventory.findMany({
      where: whereBranch,
      include: { ingredient: true, branch: true },
    });
  }

  aggregateFoodCostActual(branchId?: number) {
    return this.prisma.order.aggregate({
      where: branchId ? { branchId } : {},
      _sum: { netAmount: true, totalCogs: true },
      _count: true,
    });
  }

  findExpiringBatches(warningDate: Date, branchId?: number, take = 5) {
    const whereBranch = branchId ? { branchId } : {};
    return this.prisma.inventoryBatch.findMany({
      where: {
        ...whereBranch,
        expiryDate: { not: null, lte: warningDate },
        status: { in: ['ACTIVE', 'EXPIRED'] },
        quantity: { gt: 0 },
      },
      include: { ingredient: true, branch: true },
      orderBy: { expiryDate: 'asc' },
      take,
    });
  }
}

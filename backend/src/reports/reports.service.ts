import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dec, roundMoney, toNum } from '../common/decimal.util';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsRepository } from './reports.repository';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private reportsRepository: ReportsRepository,
  ) {}

  private startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private async resolveTopBranchToday(today: Date) {
    const retailBranches = await this.reportsRepository.findRetailBranchIds();
    const retailBranchIds = retailBranches.map((branch) => branch.id);
    if (retailBranchIds.length === 0) return null;

    const branchSales = await this.reportsRepository.groupTopBranchSalesToday(
      retailBranchIds,
      today,
    );

    if (branchSales.length === 0) return null;

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchSales[0].branchId },
    });
    if (!branch) return null;

    return {
      id: branch.id,
      name: branch.name,
      totalSales: toNum(branchSales[0]._sum.netAmount),
    };
  }

  async getSalesTrends(branchId?: number, days = 7) {
    const windowDays = days === 30 ? 30 : 7;
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const results = await this.reportsRepository.querySalesTrends(
      since,
      branchId,
    );

    const dailyMap = new Map<string, { total: number; orders: number }>();
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyMap.set(dateStr, { total: 0, orders: 0 });
    }

    for (const row of results) {
      if (dailyMap.has(row.date)) {
        dailyMap.set(row.date, {
          total: Number(row.total),
          orders: Number(row.orders),
        });
      }
    }

    return Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      total: stats.total,
      orders: stats.orders,
    }));
  }

  async getTopProducts(branchId?: number) {
    const today = this.startOfToday();
    const items = await this.reportsRepository.groupTopProducts(
      today,
      branchId,
    );

    if (items.length === 0) return [];

    const productIds = items.map((item) => item.productId);
    const [products, orderItems] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      }),
      this.reportsRepository.findOrderItemsForProducts(
        today,
        productIds,
        branchId,
      ),
    ]);
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    const revenueByProduct = new Map<number, Prisma.Decimal>();
    for (const orderItem of orderItems) {
      const lineRevenue = dec(orderItem.price).times(orderItem.quantity);
      const running = revenueByProduct.get(orderItem.productId) ?? dec(0);
      revenueByProduct.set(orderItem.productId, running.plus(lineRevenue));
    }

    return items.flatMap((item) => {
      const product = productById.get(item.productId);
      if (!product) return [];
      return [
        {
          productId: item.productId,
          name: product.name,
          totalQuantity: item._sum.quantity || 0,
          totalRevenue: roundMoney(revenueByProduct.get(item.productId) ?? 0),
        },
      ];
    });
  }

  async getProfitLoss(branchId?: number) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [orders, expenses, payrolls] =
      await this.reportsRepository.aggregateMonthlyProfitInputs(
        startOfMonth,
        branchId,
      );

    const revenue = toNum(orders._sum.netAmount) - toNum(orders._sum.taxAmount);
    const cogs = toNum(orders._sum.totalCogs);
    const expenseTotal = toNum(expenses._sum.amount);
    const payrollTotal = toNum(payrolls._sum.grossPay);

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenseTotal - payrollTotal;

    return {
      revenue,
      cogs,
      grossProfit,
      expenses: expenseTotal,
      payroll: payrollTotal,
      netProfit,
    };
  }

  async getFoodCostActual(branchId?: number) {
    const orders =
      await this.reportsRepository.aggregateFoodCostActual(branchId);

    const totalRevenue = dec(orders._sum.netAmount ?? 0);
    const totalCogs = dec(orders._sum.totalCogs ?? 0);
    const hasRevenue = totalRevenue.greaterThan(0);

    return {
      orderCount: orders._count,
      totalRevenue: roundMoney(totalRevenue),
      totalCogs: roundMoney(totalCogs),
      grossProfit: roundMoney(totalRevenue.minus(totalCogs)),
      actualFoodCostPercent: hasRevenue
        ? roundMoney(totalCogs.dividedBy(totalRevenue).times(100))
        : 0,
      grossMarginPercent: hasRevenue
        ? roundMoney(
            totalRevenue.minus(totalCogs).dividedBy(totalRevenue).times(100),
          )
        : 0,
    };
  }

  async getExecutiveSummary(branchId?: number) {
    const today = this.startOfToday();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + 7);

    const [
      salesTodayAgg,
      salesYesterdayAgg,
      topBranch,
      inventories,
      expiringBatches,
    ] = await Promise.all([
      this.reportsRepository.aggregateSalesWindow({ gte: today }, branchId),
      this.reportsRepository.aggregateSalesWindow(
        { gte: yesterday, lt: today },
        branchId,
      ),
      branchId ? Promise.resolve(null) : this.resolveTopBranchToday(today),
      this.reportsRepository.findLowStockInventories(branchId),
      this.reportsRepository.findExpiringBatches(warningDate, branchId),
    ]);

    const salesToday = toNum(salesTodayAgg._sum.netAmount);
    const salesYesterday = toNum(salesYesterdayAgg._sum.netAmount);
    let salesGrowth = 0;
    if (salesYesterday > 0) {
      salesGrowth = ((salesToday - salesYesterday) / salesYesterday) * 100;
    }

    const ordersToday = salesTodayAgg._count._all;
    const ordersYesterday = salesYesterdayAgg._count._all;
    let ordersGrowth = 0;
    if (ordersYesterday > 0) {
      ordersGrowth = ((ordersToday - ordersYesterday) / ordersYesterday) * 100;
    }

    const avgTicketToday = ordersToday > 0 ? salesToday / ordersToday : 0;
    const avgTicketYesterday =
      ordersYesterday > 0 ? salesYesterday / ordersYesterday : 0;

    const lowStockInventories = inventories.filter(
      (inv) => inv.stock <= inv.minStock,
    );
    const lowStockCount = lowStockInventories.length;
    const alerts = lowStockInventories
      .sort((a, b) => a.stock - a.minStock - (b.stock - b.minStock))
      .slice(0, 5)
      .map((inv) => ({
        id: inv.id,
        ingredientName: inv.ingredient.name,
        branchName: inv.branch.name,
        stock: inv.stock,
        minStock: inv.minStock,
      }));

    const expiryCount = expiringBatches.length;
    const now = new Date();
    const expiryAlerts = expiringBatches.slice(0, 5).map((batch) => ({
      id: batch.id,
      ingredientName: batch.ingredient.name,
      branchName: batch.branch.name,
      quantity: batch.quantity,
      expiryDate: batch.expiryDate!.toISOString(),
      status:
        batch.status === 'EXPIRED' || batch.expiryDate! < now
          ? 'EXPIRED'
          : batch.status,
    }));

    return {
      salesToday,
      salesYesterday,
      salesGrowth,
      ordersToday,
      ordersYesterday,
      ordersGrowth,
      avgTicketToday,
      avgTicketYesterday,
      topBranch,
      lowStockAlerts: alerts,
      lowStockCount,
      expiryAlerts,
      expiryCount,
    };
  }
}

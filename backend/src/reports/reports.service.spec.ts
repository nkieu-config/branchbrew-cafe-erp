import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { ReportsRepository } from './reports.repository';
import { PrismaService } from '../prisma/prisma.service';
import {
  MockPrismaService,
  PrismaServiceMockProvider,
} from '../prisma/prisma.service.mock';

describe('ReportsService', () => {
  let service: ReportsService;
  let repository: ReportsRepository;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-07T10:00:00Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, ReportsRepository, PrismaServiceMockProvider],
    }).compile();

    service = module.get(ReportsService);
    repository = module.get(ReportsRepository);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getSalesTrends', () => {
    it('zero-fills a 7-day window by default and merges query rows', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { date: '2026-07-07', total: '450.50', orders: BigInt(3) },
        { date: '2026-06-01', total: '999', orders: BigInt(9) },
      ] as never);

      const result = await service.getSalesTrends();

      expect(result).toHaveLength(7);
      expect(result[0]).toEqual({ date: '2026-07-01', total: 0, orders: 0 });
      expect(result[6]).toEqual({
        date: '2026-07-07',
        total: 450.5,
        orders: 3,
      });
      expect(result.some((row) => row.date === '2026-06-01')).toBe(false);
    });

    it('returns a 30-day window when days is 30', async () => {
      prisma.$queryRaw.mockResolvedValue([] as never);

      const result = await service.getSalesTrends(undefined, 30);

      expect(result).toHaveLength(30);
      expect(result[0].date).toBe('2026-06-08');
      expect(result[29].date).toBe('2026-07-07');
    });

    it('falls back to 7 days for unsupported windows', async () => {
      prisma.$queryRaw.mockResolvedValue([] as never);

      const result = await service.getSalesTrends(undefined, 14);

      expect(result).toHaveLength(7);
    });

    it('passes the branch filter through to the repository', async () => {
      const spy = jest
        .spyOn(repository, 'querySalesTrends')
        .mockResolvedValue([]);

      await service.getSalesTrends(4, 7);

      expect(spy).toHaveBeenCalledWith(expect.any(Date), 4);
    });
  });

  describe('getTopProducts', () => {
    it('returns empty without loading products when nothing sold today', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([] as never);

      const result = await service.getTopProducts();

      expect(result).toEqual([]);
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('joins product names and accumulates per-product revenue', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([
        { productId: 1, _sum: { quantity: 10 } },
        { productId: 2, _sum: { quantity: null } },
        { productId: 3, _sum: { quantity: 2 } },
      ] as never);
      prisma.product.findMany.mockResolvedValue([
        { id: 1, name: 'Latte' },
        { id: 2, name: 'Mocha' },
      ] as never);
      prisma.orderItem.findMany.mockResolvedValue([
        { productId: 1, quantity: 2, price: '50' },
        { productId: 1, quantity: 1, price: '50' },
        { productId: 2, quantity: 4, price: '25.5' },
      ] as never);

      const result = await service.getTopProducts(4);

      expect(result).toEqual([
        { productId: 1, name: 'Latte', totalQuantity: 10, totalRevenue: 150 },
        { productId: 2, name: 'Mocha', totalQuantity: 0, totalRevenue: 102 },
      ]);
    });
  });

  describe('getProfitLoss', () => {
    it('computes ex-VAT revenue, gross profit, and net profit', async () => {
      prisma.order.aggregate.mockResolvedValue({
        _sum: { netAmount: '1070', taxAmount: '70', totalCogs: '300' },
      } as never);
      prisma.expense.aggregate.mockResolvedValue({
        _sum: { amount: '100' },
      } as never);
      prisma.payslip.aggregate.mockResolvedValue({
        _sum: { grossPay: '200' },
      } as never);

      const result = await service.getProfitLoss(2);

      expect(result).toEqual({
        revenue: 1000,
        cogs: 300,
        grossProfit: 700,
        expenses: 100,
        payroll: 200,
        netProfit: 400,
      });
    });
  });

  describe('getExecutiveSummary', () => {
    it('reports growth, average tickets, and alert lists for a branch', async () => {
      prisma.order.aggregate
        .mockResolvedValueOnce({
          _sum: { netAmount: '500' },
          _count: { _all: 5 },
        } as never)
        .mockResolvedValueOnce({
          _sum: { netAmount: '400' },
          _count: { _all: 4 },
        } as never);
      prisma.branchInventory.findMany.mockResolvedValue([
        {
          id: 1,
          stock: 2,
          minStock: 5,
          ingredient: { name: 'Beans' },
          branch: { name: 'Main' },
        },
        {
          id: 2,
          stock: 9,
          minStock: 5,
          ingredient: { name: 'Milk' },
          branch: { name: 'Main' },
        },
      ] as never);
      prisma.inventoryBatch.findMany.mockResolvedValue([
        {
          id: 11,
          quantity: 3,
          expiryDate: new Date('2026-07-10T00:00:00Z'),
          status: 'ACTIVE',
          ingredient: { name: 'Beans' },
          branch: { name: 'Main' },
        },
        {
          id: 12,
          quantity: 1,
          expiryDate: new Date('2026-07-01T00:00:00Z'),
          status: 'ACTIVE',
          ingredient: { name: 'Milk' },
          branch: { name: 'Main' },
        },
      ] as never);

      const result = await service.getExecutiveSummary(4);

      expect(result.salesToday).toBe(500);
      expect(result.salesYesterday).toBe(400);
      expect(result.salesGrowth).toBeCloseTo(25);
      expect(result.ordersGrowth).toBeCloseTo(25);
      expect(result.avgTicketToday).toBe(100);
      expect(result.avgTicketYesterday).toBe(100);
      expect(result.topBranch).toBeNull();
      expect(prisma.branch.findMany).not.toHaveBeenCalled();
      expect(result.lowStockCount).toBe(1);
      expect(result.lowStockAlerts).toEqual([
        {
          id: 1,
          ingredientName: 'Beans',
          branchName: 'Main',
          stock: 2,
          minStock: 5,
        },
      ]);
      expect(result.expiryCount).toBe(2);
      expect(result.expiryAlerts[0].status).toBe('ACTIVE');
      expect(result.expiryAlerts[1].status).toBe('EXPIRED');
    });

    it('resolves the top branch across retail branches when unscoped', async () => {
      prisma.order.aggregate.mockResolvedValue({
        _sum: { netAmount: null },
        _count: { _all: 0 },
      } as never);
      prisma.branch.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }] as never);
      prisma.order.groupBy.mockResolvedValue([
        { branchId: 2, _sum: { netAmount: '800' } },
      ] as never);
      prisma.branch.findUnique.mockResolvedValue({
        id: 2,
        name: 'Riverside',
      } as never);
      prisma.branchInventory.findMany.mockResolvedValue([] as never);
      prisma.inventoryBatch.findMany.mockResolvedValue([] as never);

      const result = await service.getExecutiveSummary();

      expect(result.topBranch).toEqual({
        id: 2,
        name: 'Riverside',
        totalSales: 800,
      });
      expect(result.salesGrowth).toBe(0);
      expect(result.ordersGrowth).toBe(0);
      expect(result.avgTicketToday).toBe(0);
      expect(result.avgTicketYesterday).toBe(0);
      expect(result.lowStockAlerts).toEqual([]);
      expect(result.expiryAlerts).toEqual([]);
    });

    it('returns null top branch when no retail branch has sales today', async () => {
      prisma.order.aggregate.mockResolvedValue({
        _sum: { netAmount: null },
        _count: { _all: 0 },
      } as never);
      prisma.branch.findMany.mockResolvedValue([{ id: 1 }] as never);
      prisma.order.groupBy.mockResolvedValue([] as never);
      prisma.branchInventory.findMany.mockResolvedValue([] as never);
      prisma.inventoryBatch.findMany.mockResolvedValue([] as never);

      const result = await service.getExecutiveSummary();

      expect(result.topBranch).toBeNull();
      expect(prisma.branch.findUnique).not.toHaveBeenCalled();
    });
  });
  describe('getFoodCostActual', () => {
    it('derives food cost and margin from one aggregate query', async () => {
      jest.spyOn(repository, 'aggregateFoodCostActual').mockResolvedValue({
        _sum: { netAmount: '1000', totalCogs: '310' },
        _count: 4,
      } as never);

      const result = await service.getFoodCostActual(2);

      expect(repository.aggregateFoodCostActual).toHaveBeenCalledWith(2);
      expect(result).toEqual({
        orderCount: 4,
        totalRevenue: 1000,
        totalCogs: 310,
        grossProfit: 690,
        actualFoodCostPercent: 31,
        grossMarginPercent: 69,
      });
    });

    it('returns zero percentages instead of dividing by zero revenue', async () => {
      jest.spyOn(repository, 'aggregateFoodCostActual').mockResolvedValue({
        _sum: { netAmount: null, totalCogs: null },
        _count: 0,
      });

      const result = await service.getFoodCostActual();

      expect(result.actualFoodCostPercent).toBe(0);
      expect(result.grossMarginPercent).toBe(0);
      expect(result.totalRevenue).toBe(0);
    });

    it('keeps the percentage in decimal space', async () => {
      jest.spyOn(repository, 'aggregateFoodCostActual').mockResolvedValue({
        _sum: { netAmount: '0.30', totalCogs: '0.10' },
        _count: 1,
      } as never);

      const result = await service.getFoodCostActual();

      expect(result.actualFoodCostPercent).toBe(33.33);
    });
  });
});

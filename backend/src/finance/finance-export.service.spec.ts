import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { FinanceRepository } from './finance.repository';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaServiceMockProvider } from '../prisma/prisma.service.mock';
import { OutboxService } from '../outbox/outbox.service';

describe('FinanceService.exportSales', () => {
  let service: FinanceService;
  let repository: { findOrdersForExport: jest.Mock };

  const orderRow = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    createdAt: new Date('2026-07-01T10:00:00Z'),
    branch: { name: 'Sukhumvit' },
    user: { name: 'Cashier One' },
    customer: { name: 'Walk-in Jane' },
    status: 'COMPLETED',
    totalAmount: 150,
    discountAmount: 0,
    netAmount: 150,
    pointsEarned: 1,
    pointsRedeemed: 0,
    ...overrides,
  });

  beforeEach(async () => {
    repository = { findOrdersForExport: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        PrismaServiceMockProvider,
        { provide: FinanceRepository, useValue: repository },
        { provide: OutboxService, useValue: { enqueue: jest.fn() } },
      ],
    }).compile();

    service = module.get(FinanceService);
    module.get(PrismaService);
  });

  it('returns an empty string when there is nothing to export', async () => {
    repository.findOrdersForExport.mockResolvedValue([]);

    await expect(service.exportSales()).resolves.toBe('');
  });

  it('emits a header row and the order values', async () => {
    repository.findOrdersForExport.mockResolvedValue([orderRow()]);

    const csv = await service.exportSales();
    const [header, row] = csv.split('\n');

    expect(header).toContain('"OrderID"');
    expect(header).toContain('"Customer"');
    expect(row).toContain('"Sukhumvit"');
    expect(row).toContain('"Walk-in Jane"');
    expect(row).toContain('150');
  });

  it('neutralises a formula planted in a customer name', async () => {
    repository.findOrdersForExport.mockResolvedValue([
      orderRow({ customer: { name: `=cmd|'/c calc'!A1` } }),
    ]);

    const csv = await service.exportSales();

    expect(csv).toContain(`"'=cmd|'/c calc'!A1"`);
    expect(csv).not.toContain(`"=cmd`);
  });

  it('neutralises a formula planted in a branch or cashier name', async () => {
    repository.findOrdersForExport.mockResolvedValue([
      orderRow({
        branch: { name: '@SUM(1+1)*cmd' },
        user: { name: '+1+1' },
      }),
    ]);

    const csv = await service.exportSales();

    expect(csv).toContain(`"'@SUM(1+1)*cmd"`);
    expect(csv).toContain(`"'+1+1"`);
  });
});

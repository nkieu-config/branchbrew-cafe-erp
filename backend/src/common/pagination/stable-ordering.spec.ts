import { CustomersService } from '../../customers/customers.service';
import { OrderLifecycleService } from '../../orders/order-lifecycle.service';
import { AccountingService } from '../../accounting/accounting.service';
import { HrService } from '../../hr/hr.service';

/**
 * Offset paging over a non-unique sort is not stable: rows that tie on the sort
 * column come back in whatever order the planner picks, so the same row can
 * appear on two pages while another is skipped entirely. Every paginated query
 * must therefore break ties on a unique column.
 */
describe('paginated queries order by something unique', () => {
  function captureOrderBy(run: (prisma: Record<string, unknown>) => unknown) {
    const calls: unknown[] = [];
    const model = {
      findMany: (args: { orderBy?: unknown }) => {
        calls.push(args.orderBy);
        return [];
      },
      count: () => 0,
    };
    const prisma = {
      customer: model,
      order: model,
      journalEntry: model,
      attendanceRecord: model,
      $transaction: (ops: unknown[]) => Promise.resolve(ops),
    };
    run(prisma);
    return calls;
  }

  const endsWithUniqueTiebreaker = (orderBy: unknown) =>
    Array.isArray(orderBy) &&
    orderBy.length > 1 &&
    Object.keys(orderBy[orderBy.length - 1] as object)[0] === 'id';

  const cases: [string, (prisma: Record<string, unknown>) => unknown][] = [
    [
      'customers',
      (prisma) => {
        const service = Object.create(
          CustomersService.prototype,
        ) as CustomersService;
        (service as unknown as { prisma: unknown }).prisma = prisma;
        return service.findPage({ take: 10, skip: 0 });
      },
    ],
    [
      'orders',
      (prisma) => {
        const service = Object.create(
          OrderLifecycleService.prototype,
        ) as OrderLifecycleService;
        (service as unknown as { prisma: unknown }).prisma = prisma;
        return service.findPage({ since: new Date(0), take: 10, skip: 0 });
      },
    ],
    [
      'journal entries',
      (prisma) => {
        const service = Object.create(
          AccountingService.prototype,
        ) as AccountingService;
        (service as unknown as { prisma: unknown }).prisma = prisma;
        return service.getJournalEntryPage({ take: 10, skip: 0 });
      },
    ],
    [
      'attendance',
      (prisma) => {
        const service = Object.create(HrService.prototype) as HrService;
        (service as unknown as { prisma: unknown }).prisma = prisma;
        return service.getMyAttendancePage({ userId: 1, take: 10, skip: 0 });
      },
    ],
  ];

  it.each(cases)('%s breaks ties on id', (_name, run) => {
    const [orderBy] = captureOrderBy(run);
    expect(endsWithUniqueTiebreaker(orderBy)).toBe(true);
  });
});

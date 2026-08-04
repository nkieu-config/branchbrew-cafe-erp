import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { OutboxProcessor } from './outbox.processor';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_OUTBOX_ATTEMPTS, retryBackoffMs } from './outbox.constants';
import { NotificationsService } from '../notifications/notifications.service';

describe('OutboxProcessor', () => {
  let processor: OutboxProcessor;
  let loggerErrorSpy: jest.SpyInstance;
  let prisma: {
    outboxEvent: {
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
    };
    user: { findMany: jest.Mock };
  };
  let eventEmitter: { emitAsync: jest.Mock };
  let notifications: { notifyUser: jest.Mock };

  beforeEach(async () => {
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    prisma = {
      outboxEvent: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    eventEmitter = { emitAsync: jest.fn().mockResolvedValue([]) };
    notifications = { notifyUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    processor = module.get(OutboxProcessor);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('marks event completed after successful dispatch', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 1,
        eventType: 'order.created',
        status: 'PENDING',
        attempts: 0,
        payload: {
          order: { id: 1 },
          ingredientRequirements: [],
          branchId: 1,
          customerId: null,
        },
      },
    ]);
    prisma.outboxEvent.findUnique.mockResolvedValue({ attempts: 1 });

    await processor.handleCron();

    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'order.created',
      expect.any(Object),
    );
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it('schedules retry when dispatch fails under max attempts', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 2,
        eventType: 'order.status.updated',
        status: 'PENDING',
        attempts: 1,
        payload: { orderId: 9, status: 'COMPLETED', branchId: 1 },
      },
    ]);
    prisma.outboxEvent.findUnique.mockResolvedValue({ attempts: 2 });
    eventEmitter.emitAsync.mockRejectedValue(new Error('handler down'));

    await processor.handleCron();

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2 },
        data: expect.objectContaining({
          status: 'PENDING',
          lastError: 'handler down',
        }),
      }),
    );
  });

  it('skips events already claimed by another processor', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 4,
        eventType: 'order.status.updated',
        status: 'PENDING',
        attempts: 0,
        payload: { orderId: 9, status: 'COMPLETED', branchId: 1 },
      },
    ]);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 0 });

    await processor.handleCron();

    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it('selects events stranded in PROCESSING by a dead worker', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([]);

    await processor.handleCron();

    const where = prisma.outboxEvent.findMany.mock.calls[0][0].where;
    const staleClause = where.OR.find(
      (clause: { status: string }) => clause.status === 'PROCESSING',
    );
    expect(staleClause).toBeDefined();
    expect(staleClause.claimedAt.lt).toBeInstanceOf(Date);
    expect(staleClause.claimedAt.lt.getTime()).toBeLessThan(Date.now());
  });

  it('spaces retry eligibility exponentially by attempt count', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([]);
    const before = Date.now();

    await processor.handleCron();

    const after = Date.now();
    const where = prisma.outboxEvent.findMany.mock.calls[0][0].where;
    const retryClauses = where.OR.filter(
      (clause: { status: string; attempts?: unknown }) =>
        clause.status === 'PENDING' &&
        typeof clause.attempts === 'number' &&
        clause.attempts > 0,
    );

    expect(
      retryClauses.map((clause: { attempts: number }) => clause.attempts),
    ).toEqual([1, 2, 3, 4]);

    const thresholds = retryClauses.map((clause: { claimedAt: { lt: Date } }) =>
      clause.claimedAt.lt.getTime(),
    );
    expect(thresholds[0] - thresholds[1]).toBe(30_000);
    expect(thresholds[1] - thresholds[2]).toBe(60_000);
    expect(thresholds[2] - thresholds[3]).toBe(120_000);
    expect(before - thresholds[0]).toBeLessThanOrEqual(30_000);
    expect(after - thresholds[0]).toBeGreaterThanOrEqual(30_000);

    const failedClauses = where.OR.filter(
      (clause: { status: string }) => clause.status === 'FAILED',
    );
    expect(failedClauses).toHaveLength(MAX_OUTBOX_ATTEMPTS - 1);
    failedClauses.forEach(
      (
        clause: {
          attempts: number;
          OR: [{ claimedAt: null }, { claimedAt: { lt: Date } }];
        },
        index: number,
      ) => {
        expect(clause.attempts).toBe(index + 1);
        expect(clause.OR[0]).toEqual({ claimedAt: null });
        expect(clause.OR[1].claimedAt.lt.getTime()).toBe(thresholds[index]);
      },
    );
  });

  it('reclaims and dispatches a stale PROCESSING event', async () => {
    const claimedAt = new Date(Date.now() - 10 * 60 * 1000);
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 7,
        eventType: 'order.status.updated',
        status: 'PROCESSING',
        attempts: 1,
        claimedAt,
        payload: { orderId: 9, status: 'COMPLETED', branchId: 1 },
      },
    ]);
    prisma.outboxEvent.findUnique.mockResolvedValue({ attempts: 2 });

    await processor.handleCron();

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 7,
          status: 'PROCESSING',
          attempts: 1,
          claimedAt: { lt: expect.any(Date) },
        }),
        data: expect.objectContaining({
          status: 'PROCESSING',
          attempts: { increment: 1 },
          claimedAt: expect.any(Date),
        }),
      }),
    );
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'order.status.updated',
      expect.any(Object),
    );
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it('abandons a stale PROCESSING event that already exhausted its attempts', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 8,
        eventType: 'order.created',
        status: 'PROCESSING',
        attempts: MAX_OUTBOX_ATTEMPTS,
        claimedAt: new Date(Date.now() - 10 * 60 * 1000),
        payload: {
          order: { id: 1 },
          ingredientRequirements: [],
          branchId: 1,
          customerId: null,
        },
      },
    ]);

    await processor.handleCron();

    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 8, status: 'PROCESSING' }),
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  it('marks permanently failed after max attempts', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 3,
        eventType: 'order.created',
        status: 'FAILED',
        attempts: MAX_OUTBOX_ATTEMPTS - 1,
        payload: {
          order: { id: 1 },
          ingredientRequirements: [],
          branchId: 1,
          customerId: null,
        },
      },
    ]);
    prisma.outboxEvent.findUnique.mockResolvedValue({
      attempts: MAX_OUTBOX_ATTEMPTS,
    });
    eventEmitter.emitAsync.mockRejectedValue(new Error('still failing'));

    await processor.handleCron();

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3 },
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  describe('permanent-failure announcements', () => {
    beforeEach(() => {
      prisma.user.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    });

    it('tells every super admin when retries run out', async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([
        {
          id: 3,
          eventType: 'order.created',
          status: 'FAILED',
          attempts: MAX_OUTBOX_ATTEMPTS - 1,
          payload: {
            order: { id: 1 },
            ingredientRequirements: [],
            branchId: 1,
            customerId: null,
          },
        },
      ]);
      prisma.outboxEvent.findUnique.mockResolvedValue({
        attempts: MAX_OUTBOX_ATTEMPTS,
      });
      eventEmitter.emitAsync.mockRejectedValue(new Error('still failing'));

      await processor.handleCron();

      expect(notifications.notifyUser).toHaveBeenCalledTimes(2);
      expect(notifications.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, type: 'OUTBOX_FAILED' }),
      );
    });

    it('also tells them when a claim is abandoned after a worker died', async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([
        {
          id: 8,
          eventType: 'order.created',
          status: 'PROCESSING',
          attempts: MAX_OUTBOX_ATTEMPTS,
          claimedAt: new Date(Date.now() - 10 * 60 * 1000),
          payload: {
            order: { id: 1 },
            ingredientRequirements: [],
            branchId: 1,
            customerId: null,
          },
        },
      ]);

      await processor.handleCron();

      expect(notifications.notifyUser).toHaveBeenCalledTimes(2);
      expect(notifications.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          type: 'OUTBOX_FAILED',
          title: expect.stringContaining('8'),
        }),
      );
    });

    it('does not announce an event that still has retries left', async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([
        {
          id: 4,
          eventType: 'order.created',
          status: 'PENDING',
          attempts: 0,
          payload: {
            order: { id: 1 },
            ingredientRequirements: [],
            branchId: 1,
            customerId: null,
          },
        },
      ]);
      prisma.outboxEvent.findUnique.mockResolvedValue({ attempts: 1 });
      eventEmitter.emitAsync.mockRejectedValue(new Error('transient'));

      await processor.handleCron();

      expect(notifications.notifyUser).not.toHaveBeenCalled();
    });
  });
});

describe('retryBackoffMs', () => {
  it('starts at the base delay and doubles each attempt', () => {
    expect(retryBackoffMs(1)).toBe(30_000);
    expect(retryBackoffMs(2)).toBe(60_000);
    expect(retryBackoffMs(3)).toBe(120_000);
    expect(retryBackoffMs(4)).toBe(240_000);
  });

  it('clamps attempts outside the retryable range', () => {
    expect(retryBackoffMs(0)).toBe(retryBackoffMs(1));
    expect(retryBackoffMs(-3)).toBe(retryBackoffMs(1));
    expect(retryBackoffMs(99)).toBe(retryBackoffMs(MAX_OUTBOX_ATTEMPTS));
  });
});

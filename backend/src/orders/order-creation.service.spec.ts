import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { OrderCreationService } from './order-creation.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MockPrismaService,
  PrismaServiceMockProvider,
} from '../prisma/prisma.service.mock';
import { OutboxService } from '../outbox/outbox.service';
import { SettingsService } from '../settings/settings.service';
import { CreateOrderInput } from './orders.types';

describe('OrderCreationService idempotency', () => {
  let service: OrderCreationService;
  let prisma: MockPrismaService;

  const REQUEST_ID = '3f7d1a9e-4a1b-4c3e-9a1f-000000000001';

  const p2002 = (target: string[]) =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target },
    });

  const input = (overrides: Partial<CreateOrderInput> = {}) => ({
    userId: 1,
    branchId: 1,
    items: [],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderCreationService,
        PrismaServiceMockProvider,
        { provide: OutboxService, useValue: { enqueue: jest.fn() } },
        { provide: SettingsService, useValue: {} },
      ],
    }).compile();

    service = module.get(OrderCreationService);
    prisma = module.get(PrismaService);
  });

  it('returns the order already created for the same request id', async () => {
    prisma.$transaction.mockRejectedValue(p2002(['clientRequestId']));
    prisma.order.findUnique.mockResolvedValue({ id: 42 } as never);

    const result = await service.createOrder(
      input({ clientRequestId: REQUEST_ID }),
    );

    expect(result).toEqual({ id: 42 });
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { clientRequestId: REQUEST_ID },
      include: expect.anything(),
    });
  });

  it('does not retry a request-id conflict as if it were a queue collision', async () => {
    prisma.$transaction.mockRejectedValue(p2002(['clientRequestId']));
    prisma.order.findUnique.mockResolvedValue({ id: 42 } as never);

    await service.createOrder(input({ clientRequestId: REQUEST_ID }));

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rethrows a request-id conflict when the caller sent no request id', async () => {
    prisma.$transaction.mockRejectedValue(p2002(['clientRequestId']));

    await expect(service.createOrder(input())).rejects.toThrow(
      'Unique constraint failed',
    );
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('rethrows when the conflicting order can no longer be found', async () => {
    prisma.$transaction.mockRejectedValue(p2002(['clientRequestId']));
    prisma.order.findUnique.mockResolvedValue(null);

    await expect(
      service.createOrder(input({ clientRequestId: REQUEST_ID })),
    ).rejects.toThrow('Unique constraint failed');
  });

  it('still retries a queue-number collision', async () => {
    prisma.$transaction
      .mockRejectedValueOnce(p2002(['queueNumber']))
      .mockResolvedValueOnce({ id: 7 });

    const result = await service.createOrder(
      input({ clientRequestId: REQUEST_ID }),
    );

    expect(result).toEqual({ id: 7 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });
});

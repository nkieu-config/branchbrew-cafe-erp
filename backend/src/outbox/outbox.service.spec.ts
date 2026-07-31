import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MockPrismaService,
  PrismaServiceMockProvider,
} from '../prisma/prisma.service.mock';
import { MAX_PAGE_SIZE } from '../common/pagination/pagination-query.dto';

describe('OutboxService dead-letter surface', () => {
  let service: OutboxService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutboxService, PrismaServiceMockProvider],
    }).compile();

    service = module.get(OutboxService);
    prisma = module.get(PrismaService);
  });

  describe('listFailed', () => {
    it('returns only permanently failed events, newest first', async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([]);

      await service.listFailed({});

      expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'FAILED' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('caps an oversized page request at the shared maximum', async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([]);

      await service.listFailed({ limit: MAX_PAGE_SIZE + 1000 });

      const args = prisma.outboxEvent.findMany.mock.calls[0][0];
      expect(args?.take).toBe(MAX_PAGE_SIZE);
    });
  });

  describe('replayFailed', () => {
    it('requeues a failed event and clears its retry state', async () => {
      prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
      prisma.outboxEvent.findUniqueOrThrow.mockResolvedValue({
        id: 7,
        status: 'PENDING',
        attempts: 0,
      } as never);

      const result = await service.replayFailed(7);

      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
        where: { id: 7, status: 'FAILED' },
        data: {
          status: 'PENDING',
          attempts: 0,
          lastError: null,
          claimedAt: null,
        },
      });
      expect(result.status).toBe('PENDING');
    });

    it('refuses to replay an event that is not FAILED', async () => {
      prisma.outboxEvent.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.replayFailed(7)).rejects.toThrow(NotFoundException);
      expect(prisma.outboxEvent.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });
});

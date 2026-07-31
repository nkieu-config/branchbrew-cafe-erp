import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaginationQueryDto,
  resolvePageWindow,
} from '../common/pagination/pagination-query.dto';
import {
  OutboxEventPayload,
  OutboxEventType,
  toOutboxJsonValue,
} from './outbox-event.types';

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async listFailed(query: PaginationQueryDto) {
    const { take, skip } = resolvePageWindow(query);

    return this.prisma.outboxEvent.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
  }

  async replayFailed(id: number) {
    const requeued = await this.prisma.outboxEvent.updateMany({
      where: { id, status: 'FAILED' },
      data: {
        status: 'PENDING',
        attempts: 0,
        lastError: null,
        claimedAt: null,
      },
    });

    if (requeued.count === 0) {
      throw new NotFoundException(`No FAILED outbox event with id ${id}.`);
    }

    return this.prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
  }

  enqueue<T extends OutboxEventType>(
    tx: Prisma.TransactionClient,
    eventType: T,
    payload: OutboxEventPayload<T>,
  ) {
    return tx.outboxEvent.create({
      data: {
        eventType,
        payload: toOutboxJsonValue(payload),
      },
    });
  }
}

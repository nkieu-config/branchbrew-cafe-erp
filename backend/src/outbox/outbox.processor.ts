import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAX_DRAIN_ITERATIONS,
  MAX_OUTBOX_ATTEMPTS,
  OUTBOX_BATCH_SIZE,
  retryBackoffMs,
  STALE_PROCESSING_MS,
} from './outbox.constants';
import { dispatchOutboxEvent } from './outbox-event.registry';
import { NotificationsService } from '../notifications/notifications.service';

function retryEligibilityBranches(now: number): Prisma.OutboxEventWhereInput[] {
  return Array.from(
    { length: MAX_OUTBOX_ATTEMPTS - 1 },
    (_, index): Prisma.OutboxEventWhereInput[] => {
      const attempts = index + 1;
      const eligibleBefore = new Date(now - retryBackoffMs(attempts));
      return [
        { status: 'PENDING', attempts, claimedAt: { lt: eligibleBefore } },
        {
          status: 'FAILED',
          attempts,
          OR: [{ claimedAt: null }, { claimedAt: { lt: eligibleBefore } }],
        },
      ];
    },
  ).flat();
}

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);
  private isDraining = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async handleCron() {
    if (this.isDraining) return;

    this.isDraining = true;
    try {
      for (let iteration = 0; iteration < MAX_DRAIN_ITERATIONS; iteration++) {
        const batch = await this.processBatch();
        if (batch.size < OUTBOX_BATCH_SIZE || !batch.wasAllPending) return;
      }
    } finally {
      this.isDraining = false;
    }
  }

  private async processBatch(): Promise<{
    size: number;
    wasAllPending: boolean;
  }> {
    const now = Date.now();
    const staleBefore = new Date(now - STALE_PROCESSING_MS);

    const events = await this.prisma.outboxEvent.findMany({
      where: {
        OR: [
          { status: 'PENDING', attempts: 0 },
          ...retryEligibilityBranches(now),
          {
            status: 'PROCESSING',
            claimedAt: { lt: staleBefore },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: OUTBOX_BATCH_SIZE,
    });

    const wasAllPending = events.every((event) => event.status === 'PENDING');

    for (const event of events) {
      const isStaleClaim = event.status === 'PROCESSING';

      if (isStaleClaim && event.attempts >= MAX_OUTBOX_ATTEMPTS) {
        await this.abandonStaleClaim(
          event.id,
          event.eventType,
          event.attempts,
          staleBefore,
        );
        continue;
      }

      const claimWhere: Prisma.OutboxEventWhereInput = {
        id: event.id,
        status: event.status,
        attempts: event.attempts,
        ...(isStaleClaim ? { claimedAt: { lt: staleBefore } } : {}),
      };

      const claimed = await this.prisma.outboxEvent.updateMany({
        where: claimWhere,
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
          claimedAt: new Date(),
        },
      });

      if (claimed.count === 0) continue;

      if (isStaleClaim) {
        this.logger.warn(
          `Outbox event ${event.id} (${event.eventType}) was reclaimed after a stale PROCESSING claim`,
        );
      }

      try {
        await dispatchOutboxEvent(
          event.eventType,
          event.payload,
          this.eventEmitter,
        );
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
            lastError: null,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const updated = await this.prisma.outboxEvent.findUnique({
          where: { id: event.id },
        });
        const attempts = updated?.attempts ?? MAX_OUTBOX_ATTEMPTS;
        const willRetry = attempts < MAX_OUTBOX_ATTEMPTS;

        this.logger.error(
          `Outbox event ${event.id} (${event.eventType}) failed (attempt ${attempts}/${MAX_OUTBOX_ATTEMPTS}): ${message}`,
        );

        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: willRetry ? 'PENDING' : 'FAILED',
            lastError: message,
          },
        });

        if (!willRetry) {
          await this.announcePermanentFailure(
            event.id,
            event.eventType,
            message,
          );
        }
      }
    }

    return { size: events.length, wasAllPending };
  }

  private async abandonStaleClaim(
    id: number,
    eventType: string,
    attempts: number,
    staleBefore: Date,
  ) {
    const reason = `Abandoned after a stale PROCESSING claim at attempt ${attempts}/${MAX_OUTBOX_ATTEMPTS}`;

    const abandoned = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        status: 'PROCESSING',
        attempts,
        claimedAt: { lt: staleBefore },
      },
      data: {
        status: 'FAILED',
        lastError: reason,
      },
    });

    if (abandoned.count > 0) {
      this.logger.error(
        `Outbox event ${id} abandoned: stale PROCESSING claim exhausted its ${MAX_OUTBOX_ATTEMPTS} attempts`,
      );
      await this.announcePermanentFailure(id, eventType, reason);
    }
  }

  private async announcePermanentFailure(
    eventId: number,
    eventType: string,
    reason: string,
  ) {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: 'SUPER_ADMIN' },
        select: { id: true },
      });

      for (const admin of admins) {
        await this.notifications.notifyUser({
          userId: admin.id,
          type: 'OUTBOX_FAILED',
          title: `Outbox event ${eventId} (${eventType}) failed permanently`,
          body: reason.slice(0, 500),
          link: '/settings/audit',
        });
      }
    } catch (err) {
      this.logger.error(
        `Could not announce outbox failure for event ${eventId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

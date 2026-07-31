import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';
import { STALE_PROCESSING_MS } from '../outbox/outbox.constants';

const DURATION_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  private readonly requestDuration: Histogram<'method' | 'route' | 'status'>;
  private readonly requestTotal: Counter<'method' | 'route' | 'status'>;

  constructor(private readonly prisma: PrismaService) {
    collectDefaultMetrics({ register: this.registry });

    this.requestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: DURATION_BUCKETS,
      registers: [this.registry],
    });

    this.requestTotal = new Counter({
      name: 'http_requests_total',
      help: 'HTTP requests handled, by route and response status',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.registerOutboxGauges();
  }

  recordRequest(
    method: string,
    route: string,
    status: number,
    durationSeconds: number,
  ): void {
    const labels = { method, route, status: String(status) };
    this.requestDuration.observe(labels, durationSeconds);
    this.requestTotal.inc(labels);
  }

  scrape(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  private registerOutboxGauges(): void {
    const prisma = this.prisma;

    new Gauge({
      name: 'outbox_events',
      help: 'Outbox events currently in each status',
      labelNames: ['status'],
      registers: [this.registry],
      async collect() {
        const grouped = await prisma.outboxEvent.groupBy({
          by: ['status'],
          _count: { _all: true },
        });

        this.reset();
        for (const row of grouped) {
          this.set({ status: row.status }, row._count._all);
        }
      },
    });

    new Gauge({
      name: 'outbox_stale_claims',
      help: 'Outbox events stuck in PROCESSING past the stale-claim window',
      registers: [this.registry],
      async collect() {
        const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
        this.set(
          await prisma.outboxEvent.count({
            where: { status: 'PROCESSING', claimedAt: { lt: staleBefore } },
          }),
        );
      },
    });
  }
}

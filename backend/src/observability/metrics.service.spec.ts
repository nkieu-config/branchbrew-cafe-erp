import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MockPrismaService,
  PrismaServiceMockProvider,
} from '../prisma/prisma.service.mock';

describe('MetricsService', () => {
  let service: MetricsService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService, PrismaServiceMockProvider],
    }).compile();

    service = module.get(MetricsService);
    prisma = module.get(PrismaService);

    prisma.outboxEvent.groupBy.mockResolvedValue([]);
    prisma.outboxEvent.count.mockResolvedValue(0);
  });

  it('exposes request latency and count for a handled request', async () => {
    service.recordRequest('POST', '/orders', 201, 0.042);

    const scraped = await service.scrape();

    expect(scraped).toContain('http_request_duration_seconds_bucket');
    expect(scraped).toContain(
      'http_requests_total{method="POST",route="/orders",status="201"} 1',
    );
  });

  it('reads outbox depth from the database only when scraped', async () => {
    expect(prisma.outboxEvent.groupBy).not.toHaveBeenCalled();

    prisma.outboxEvent.groupBy.mockResolvedValue([
      { status: 'FAILED', _count: { _all: 3 } },
    ] as never);
    prisma.outboxEvent.count.mockResolvedValue(2);

    const scraped = await service.scrape();

    expect(prisma.outboxEvent.groupBy).toHaveBeenCalledTimes(1);
    expect(scraped).toContain('outbox_events{status="FAILED"} 3');
    expect(scraped).toContain('outbox_stale_claims 2');
  });

  it('serves the Prometheus text exposition content type', () => {
    expect(service.contentType).toContain('text/plain');
  });
});

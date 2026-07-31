import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { OutboxProcessor } from '../src/outbox/outbox.processor';
import { InventoryBatchExpiryProcessor } from '../src/inventory/inventory-batch-expiry.processor';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { requestContextMiddleware } from '../src/common/middleware/request-context.middleware';

class TestOutboxProcessor extends OutboxProcessor {
  async handleCron() {
    await super.handleCron();
  }
}

export async function createE2eApp(): Promise<INestApplication<App>> {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? 'test-jwt-secret-for-e2e-only-32chars';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(OutboxProcessor)
    .useClass(TestOutboxProcessor)
    .overrideProvider(InventoryBatchExpiryProcessor)
    .useValue({ markExpiredBatches: jest.fn() })
    .compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '100kb' });
  app.use(requestContextMiddleware);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();
  return app;
}

export async function processOutboxOnce(
  app: INestApplication<App>,
): Promise<void> {
  const processor = app.get(OutboxProcessor);
  await processor.handleCron();
}

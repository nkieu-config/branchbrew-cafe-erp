import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createE2eApp } from './e2e-app.util';
import {
  cleanupPosFixture,
  E2E_PASSWORD,
  seedPosFixture,
} from './e2e-fixtures.util';
import { MAX_PAGE_SIZE } from '../src/common/pagination/pagination-query.dto';
import { ORDER_LIST_DEFAULT_LIMIT } from '../src/orders/dto/order-list-query.dto';

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

const SEEDED_ORDERS = 3;

type OrderPage = {
  items: { id: number; createdAt: string }[];
  total: number;
  limit: number;
  offset: number;
};

describeIfDatabase('Orders pagination (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fixture: Awaited<ReturnType<typeof seedPosFixture>>;
  let staffAgent: request.Agent;

  beforeAll(async () => {
    jest.setTimeout(60000);
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    fixture = await seedPosFixture(prisma);

    staffAgent = request.agent(app.getHttpServer());
    await staffAgent
      .post('/auth/login')
      .send({ email: fixture.email, password: E2E_PASSWORD })
      .expect(200);

    for (let i = 0; i < SEEDED_ORDERS; i++) {
      await staffAgent
        .post('/orders')
        .send({
          branchId: fixture.branch.id,
          items: [{ productId: fixture.product.id, quantity: 1 }],
          paymentMethod: 'CASH',
        })
        .expect(201);
    }
  }, 60000);

  afterAll(async () => {
    await cleanupPosFixture(prisma, fixture.email);
    await app?.close();
  });

  async function fetchPage(query = ''): Promise<OrderPage> {
    const res = await staffAgent.get(`/orders${query}`).expect(200);
    return res.body as OrderPage;
  }

  it('answers with a bounded envelope instead of every row', async () => {
    const page = await fetchPage();

    expect(Array.isArray(page.items)).toBe(true);
    expect(page.limit).toBe(ORDER_LIST_DEFAULT_LIMIT);
    expect(page.offset).toBe(0);
    expect(page.total).toBeGreaterThanOrEqual(SEEDED_ORDERS);
  }, 30000);

  it('reports the full match count while returning one page', async () => {
    const page = await fetchPage('?limit=2');

    expect(page.items).toHaveLength(2);
    expect(page.limit).toBe(2);
    expect(page.total).toBeGreaterThanOrEqual(SEEDED_ORDERS);
  }, 30000);

  it('walks the window with offset', async () => {
    const first = await fetchPage('?limit=2');
    const second = await fetchPage('?limit=2&offset=2');

    const firstIds = first.items.map((order) => order.id);
    const secondIds = second.items.map((order) => order.id);

    expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
    expect(second.offset).toBe(2);
  }, 30000);

  it('rejects a limit above the cap rather than silently truncating', async () => {
    await staffAgent.get(`/orders?limit=${MAX_PAGE_SIZE + 1}`).expect(400);
    await staffAgent.get('/orders?limit=0').expect(400);
    await staffAgent.get('/orders?offset=-1').expect(400);
  }, 30000);

  it('rejects a malformed since date', async () => {
    await staffAgent.get('/orders?since=not-a-date').expect(400);
    await staffAgent.get('/orders?since=2026-02-31').expect(400);
  }, 30000);

  it('excludes orders older than the since date', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const page = await fetchPage(
      `?since=${tomorrow.toISOString().slice(0, 10)}`,
    );

    expect(page.items).toHaveLength(0);
    expect(page.total).toBe(0);
  }, 30000);

  it('still refuses a branch the caller does not belong to', async () => {
    await staffAgent
      .get(`/orders?branchId=${fixture.branch.id + 9999}`)
      .expect(403);
  }, 30000);
});

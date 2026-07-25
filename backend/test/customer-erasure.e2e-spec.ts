import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createE2eApp, processOutboxOnce } from './e2e-app.util';
import {
  cleanupPosFixture,
  E2E_PASSWORD,
  seedPosFixture,
} from './e2e-fixtures.util';
import { toNum } from '../src/common/decimal.util';

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

const MEMBER_PHONE = '0899999001';
const ADMIN_EMAIL = 'pdpa-admin@e2e.test';

async function flushOutbox(app: INestApplication<App>, cycles = 5) {
  for (let i = 0; i < cycles; i++) {
    await processOutboxOnce(app);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

describeIfDatabase('Customer erasure and PII scope (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fixture: Awaited<ReturnType<typeof seedPosFixture>>;
  let staffAgent: request.Agent;
  let managerAgent: request.Agent;
  let adminAgent: request.Agent;
  let customerId: number;
  let orderId: number;
  let orderNetAmount: number;

  beforeAll(async () => {
    jest.setTimeout(60000);
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    fixture = await seedPosFixture(prisma);

    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: 'PDPA Admin',
        password: await bcrypt.hash(E2E_PASSWORD, 10),
        role: 'SUPER_ADMIN',
      },
    });

    staffAgent = await login(fixture.email);
    managerAgent = await login(fixture.managerEmail);
    adminAgent = await login(ADMIN_EMAIL);

    const created = await managerAgent
      .post('/customers')
      .send({ name: 'Erasure Member', phone: MEMBER_PHONE })
      .expect(201);
    customerId = created.body.id as number;

    const order = await staffAgent
      .post('/orders')
      .send({
        branchId: fixture.branch.id,
        items: [{ productId: fixture.product.id, quantity: 1 }],
        paymentMethod: 'CASH',
        customerPhone: MEMBER_PHONE,
      })
      .expect(201);
    orderId = order.body.id as number;
    orderNetAmount = Number(order.body.netAmount);

    await flushOutbox(app);
  }, 60000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { targetType: 'Customer' } });
    await prisma.order.updateMany({
      where: { customerId },
      data: { customerId: null },
    });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
    await cleanupPosFixture(prisma, fixture.email);
    await app?.close();
  });

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email, password: E2E_PASSWORD })
      .expect(200);
    return agent;
  }

  describe('who can reach personal data', () => {
    it('denies staff the member directory and the 360 view', async () => {
      await staffAgent.get('/customers').expect(403);
      await staffAgent.get(`/customers/${customerId}`).expect(403);
      await staffAgent.get(`/customers/${customerId}/360`).expect(403);
    }, 30000);

    it('still lets staff look up one member by exact phone at the till', async () => {
      const res = await staffAgent
        .get(`/customers/phone/${MEMBER_PHONE}`)
        .expect(200);

      expect(res.body.id).toBe(customerId);
    }, 30000);

    it('never puts a phone number on an order payload', async () => {
      const res = await staffAgent.get('/orders').expect(200);
      const withMember = res.body.items.find(
        (order: { id: number }) => order.id === orderId,
      );

      expect(withMember.customer).toBeTruthy();
      expect(withMember.customer).not.toHaveProperty('phone');
    }, 30000);

    it('never puts a phone number on a kitchen ticket', async () => {
      const res = await staffAgent
        .get(`/orders/kds?branchId=${fixture.branch.id}`)
        .expect(200);

      for (const ticket of res.body as { customer?: object }[]) {
        if (ticket.customer)
          expect(ticket.customer).not.toHaveProperty('phone');
      }
    }, 30000);
  });

  describe('erasure', () => {
    it('is refused to a manager', async () => {
      await managerAgent.delete(`/customers/${customerId}`).expect(403);
    }, 30000);

    it('clears the identity but keeps the sale', async () => {
      const journalBefore = await prisma.journalEntry.findFirst({
        where: { reference: `ORD-${orderId}` },
        include: { lines: true },
      });
      expect(journalBefore).not.toBeNull();

      await adminAgent.delete(`/customers/${customerId}`).expect(200);

      const erased = await prisma.customer.findUnique({
        where: { id: customerId },
      });
      expect(erased?.phone).toBe(`deleted-${customerId}`);
      expect(erased?.name).toBe('Deleted customer');
      expect(erased?.points).toBe(0);
      expect(erased?.anonymizedAt).not.toBeNull();

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      expect(order).not.toBeNull();
      expect(toNum(order!.netAmount)).toBe(orderNetAmount);
      expect(order!.customerId).toBe(customerId);

      const journalAfter = await prisma.journalEntry.findFirst({
        where: { reference: `ORD-${orderId}` },
        include: { lines: true },
      });
      expect(journalAfter!.lines).toHaveLength(journalBefore!.lines.length);
    }, 30000);

    it('makes the old phone unfindable', async () => {
      await staffAgent.get(`/customers/phone/${MEMBER_PHONE}`).expect(400);
    }, 30000);

    it('records who erased the record', async () => {
      const entry = await prisma.auditLog.findFirst({
        where: { action: 'ANONYMIZE_CUSTOMER', targetId: customerId },
      });

      expect(entry).not.toBeNull();
      expect(entry!.details).toContain('orderCount');
    }, 30000);

    it('refuses a second erasure of the same record', async () => {
      await adminAgent.delete(`/customers/${customerId}`).expect(400);
    }, 30000);
  });
});

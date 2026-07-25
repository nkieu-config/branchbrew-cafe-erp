import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createE2eApp, processOutboxOnce } from './e2e-app.util';
import {
  cleanupPosFixture,
  E2E_PASSWORD,
  seedPosFixture,
} from './e2e-fixtures.util';
import { roundMoney, toNum } from '../src/common/decimal.util';

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

const RECEIVED_QTY = 1000;
const STANDARD_COST = 1;
const ACTUAL_UNIT_PRICE = 0.9;
const EXPECTED_ACTUAL = RECEIVED_QTY * ACTUAL_UNIT_PRICE;
const EXPECTED_STANDARD = RECEIVED_QTY * STANDARD_COST;
const EXPECTED_VARIANCE = EXPECTED_STANDARD - EXPECTED_ACTUAL;

async function flushOutbox(app: INestApplication<App>, cycles = 5) {
  for (let i = 0; i < cycles; i++) {
    await processOutboxOnce(app);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function waitForJournal(
  prisma: PrismaService,
  reference: string,
  attempts = 10,
) {
  for (let i = 0; i < attempts; i++) {
    const entry = await prisma.journalEntry.findFirst({
      where: { reference },
      include: { lines: { include: { account: true } } },
    });
    if (entry) return entry;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

describeIfDatabase('Purchase price variance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fixture: Awaited<ReturnType<typeof seedPosFixture>>;
  let managerAgent: request.Agent;
  let poNumber: string;

  beforeAll(async () => {
    jest.setTimeout(60000);
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    fixture = await seedPosFixture(prisma);

    managerAgent = request.agent(app.getHttpServer());
    await managerAgent
      .post('/auth/login')
      .send({ email: fixture.managerEmail, password: E2E_PASSWORD })
      .expect(200);

    const supplier = await prisma.supplier.create({
      data: { name: 'E2E Bean Supplier', phone: '0800000000' },
    });

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-E2E-PPV-${Date.now()}`,
        branchId: fixture.branch.id,
        supplierId: supplier.id,
        status: 'APPROVED',
        items: {
          create: [
            {
              ingredientId: fixture.ingredient.id,
              quantityRequested: RECEIVED_QTY,
              unitPrice: ACTUAL_UNIT_PRICE,
            },
          ],
        },
      },
    });
    poNumber = po.poNumber;

    await managerAgent
      .post(`/purchase-orders/${po.id}/receive`)
      .send({})
      .expect(201);
    await flushOutbox(app);
  }, 60000);

  afterAll(async () => {
    await prisma.journalEntryLine.deleteMany({
      where: { journalEntry: { reference: poNumber } },
    });
    await prisma.journalEntry.deleteMany({ where: { reference: poNumber } });
    await prisma.purchaseOrderItem.deleteMany({
      where: { purchaseOrder: { poNumber } },
    });
    await prisma.purchaseOrder.deleteMany({ where: { poNumber } });
    await prisma.supplier.deleteMany({ where: { name: 'E2E Bean Supplier' } });
    await cleanupPosFixture(prisma, fixture.email);
    await app?.close();
  });

  it('debits inventory at standard cost, not at what the supplier charged', async () => {
    const entry = await waitForJournal(prisma, poNumber);
    expect(entry).not.toBeNull();

    const inventory = entry!.lines.find((line) => line.account.code === '1030');
    expect(toNum(inventory!.debit)).toBe(EXPECTED_STANDARD);
  }, 30000);

  it('posts the price difference to 5035 and accounts payable at actual cost', async () => {
    const entry = await waitForJournal(prisma, poNumber);

    const variance = entry!.lines.find((line) => line.account.code === '5035');
    const payable = entry!.lines.find((line) => line.account.code === '2010');

    expect(toNum(variance!.credit)).toBe(EXPECTED_VARIANCE);
    expect(toNum(payable!.credit)).toBe(EXPECTED_ACTUAL);
  }, 30000);

  it('keeps the entry balanced to the cent', async () => {
    const entry = await waitForJournal(prisma, poNumber);

    const debits = entry!.lines.reduce(
      (sum, line) => sum + toNum(line.debit),
      0,
    );
    const credits = entry!.lines.reduce(
      (sum, line) => sum + toNum(line.credit),
      0,
    );

    expect(roundMoney(debits)).toBe(roundMoney(credits));
  }, 30000);

  it('leaves the trial balance balanced', async () => {
    const res = await managerAgent.get('/accounting/trial-balance').expect(200);

    expect(res.body.totalDebit).toBe(res.body.totalCredit);
    expect(res.body.isBalanced).toBe(true);
  }, 30000);
});

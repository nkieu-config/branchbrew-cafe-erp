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
import { roundMoney, sumMoney } from '../src/common/decimal.util';

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

type TrialBalanceAccount = {
  code: string;
  name: string;
  type: string;
  normalBalance: 'DEBIT' | 'CREDIT';
  debit: number;
  credit: number;
  balance: number;
};

type TrialBalance = {
  scope: 'CHAIN' | 'BRANCH';
  branchId: number | null;
  asOf: string | null;
  accounts: TrialBalanceAccount[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
};

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
    const entry = await prisma.journalEntry.findFirst({ where: { reference } });
    if (entry) return entry;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

function accountByCode(balance: TrialBalance, code: string) {
  const row = balance.accounts.find((account) => account.code === code);
  expect(row).toBeDefined();
  return row!;
}

describeIfDatabase('Trial balance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fixture: Awaited<ReturnType<typeof seedPosFixture>>;
  let netAmount: number;
  let taxAmount: number;
  let totalCogs: number;
  let staffAgent: request.Agent;
  let managerAgent: request.Agent;

  beforeAll(async () => {
    jest.setTimeout(60000);
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    fixture = await seedPosFixture(prisma);

    staffAgent = await loginAgent(fixture.email);
    managerAgent = await loginAgent(fixture.managerEmail);

    const orderRes = await staffAgent
      .post('/orders')
      .send({
        branchId: fixture.branch.id,
        items: [{ productId: fixture.product.id, quantity: 2 }],
        paymentMethod: 'CASH',
      })
      .expect(201);

    netAmount = roundMoney(orderRes.body.netAmount);
    taxAmount = roundMoney(orderRes.body.taxAmount);
    totalCogs = roundMoney(orderRes.body.totalCogs);

    await flushOutbox(app);
    const entry = await waitForJournal(prisma, `ORD-${orderRes.body.id}`);
    expect(entry).not.toBeNull();
  }, 60000);

  afterAll(async () => {
    await cleanupPosFixture(prisma, fixture.email);
    await app?.close();
  });

  async function loginAgent(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email, password: E2E_PASSWORD })
      .expect(200);
    return agent;
  }

  async function fetchTrialBalance(query = ''): Promise<TrialBalance> {
    const res = await managerAgent
      .get(`/accounting/trial-balance${query}`)
      .expect(200);
    return res.body as TrialBalance;
  }

  it('balances to the cent after a real sale posts through the outbox', async () => {
    const balance = await fetchTrialBalance();

    expect(balance.scope).toBe('BRANCH');
    expect(balance.branchId).toBe(fixture.branch.id);
    expect(balance.totalDebit).toBe(balance.totalCredit);
    expect(balance.isBalanced).toBe(true);
  }, 30000);

  it('reports every posted account on its normal side', async () => {
    const balance = await fetchTrialBalance();

    expect(accountByCode(balance, '1010')).toEqual(
      expect.objectContaining({ normalBalance: 'DEBIT', balance: netAmount }),
    );
    expect(accountByCode(balance, '4010')).toEqual(
      expect.objectContaining({
        normalBalance: 'CREDIT',
        balance: roundMoney(netAmount - taxAmount),
      }),
    );
    expect(accountByCode(balance, '2020')).toEqual(
      expect.objectContaining({ normalBalance: 'CREDIT', balance: taxAmount }),
    );
    expect(accountByCode(balance, '5010')).toEqual(
      expect.objectContaining({ normalBalance: 'DEBIT', balance: totalCogs }),
    );
    expect(accountByCode(balance, '1030')).toEqual(
      expect.objectContaining({
        normalBalance: 'DEBIT',
        balance: roundMoney(-totalCogs),
      }),
    );
  }, 30000);

  it('totals are the sum of the account rows, not a separate query', async () => {
    const balance = await fetchTrialBalance();

    const debitSum = roundMoney(
      sumMoney(balance.accounts.map((account) => account.debit)),
    );
    const creditSum = roundMoney(
      sumMoney(balance.accounts.map((account) => account.credit)),
    );

    expect(balance.totalDebit).toBe(debitSum);
    expect(balance.totalCredit).toBe(creditSum);
  }, 30000);

  it('excludes entries posted after the as-of date', async () => {
    const balance = await fetchTrialBalance('?asOf=2020-01-01');

    expect(balance.asOf).toBe('2020-01-01');
    expect(balance.accounts).toEqual([]);
    expect(balance.totalDebit).toBe(0);
    expect(balance.totalCredit).toBe(0);
    expect(balance.isBalanced).toBe(true);
  }, 30000);

  it('rejects a malformed as-of date with a 400 instead of failing later', async () => {
    await managerAgent
      .get('/accounting/trial-balance?asOf=not-a-date')
      .expect(400);
    await managerAgent
      .get('/accounting/trial-balance?asOf=2026-02-31')
      .expect(400);
  }, 30000);

  it('denies a staff account the read entirely', async () => {
    await staffAgent.get('/accounting/trial-balance').expect(403);
  }, 30000);
});

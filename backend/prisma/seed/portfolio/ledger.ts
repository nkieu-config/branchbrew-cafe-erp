import { dec, roundMoney } from '../../../src/common/decimal.util';
import {
  paymentAccountLabel,
  resolvePaymentAccountCode,
} from '../../../src/accounting/payment-accounts.util';
import { dateDaysAgo } from '../helpers';
import type { SeedContext } from '../types';
import type { Order, Prisma } from '@prisma/client';

const TARGET_CLOSING_CASH = 250_000;

const OPENING_BALANCE_REFERENCE = 'OPENING-BALANCE';
const OPENING_BALANCE_DAYS_AGO = 90;

type JournalLineInput = {
  accountCode: string;
  debit: number;
  credit: number;
  description: string;
};

export async function seedLedgerFromOperations(ctx: SeedContext): Promise<void> {
  const { prisma } = ctx;

  console.log('Rebuilding the ledger from seeded operations...');

  const accountIds = Object.fromEntries(
    (await prisma.account.findMany()).map((account) => [
      account.code,
      account.id,
    ]),
  );

  const postEntry = async (input: {
    branchId: number;
    date: Date;
    reference: string;
    description: string;
    lines: JournalLineInput[];
  }) => {
    const existing = await prisma.journalEntry.findUnique({
      where: { reference: input.reference },
    });
    if (existing) return;

    await prisma.journalEntry.create({
      data: {
        branchId: input.branchId,
        date: input.date,
        reference: input.reference,
        description: input.description,
        status: 'POSTED',
        lines: {
          create: input.lines.map((line) => ({
            accountId: accountIds[line.accountCode],
            debit: line.debit,
            credit: line.credit,
            description: line.description,
          })),
        },
      },
    });
  };

  const saleLines = (order: Order, reversed: boolean): JournalLineInput[] => {
    const netAmount = roundMoney(order.netAmount);
    const taxAmount = roundMoney(order.taxAmount ?? 0);
    const salesExVat = roundMoney(netAmount - taxAmount);
    const totalCogs = roundMoney(order.totalCogs);
    const paymentAccountCode = resolvePaymentAccountCode(order.paymentMethod);
    const side = (debit: number, credit: number) =>
      reversed ? { debit: credit, credit: debit } : { debit, credit };

    return [
      {
        accountCode: paymentAccountCode,
        ...side(netAmount, 0),
        description: reversed
          ? 'Payment reversed'
          : paymentAccountLabel(order.paymentMethod),
      },
      {
        accountCode: '4010',
        ...side(0, salesExVat),
        description: reversed
          ? 'Sales Revenue reversed'
          : 'Sales Revenue (ex VAT)',
      },
      ...(taxAmount > 0
        ? [
            {
              accountCode: '2020',
              ...side(0, taxAmount),
              description: reversed
                ? 'Output VAT reversed'
                : 'Output VAT payable',
            },
          ]
        : []),
      ...(totalCogs > 0
        ? [
            {
              accountCode: '5010',
              ...side(totalCogs, 0),
              description: reversed ? 'COGS reversed' : 'Cost of Goods Sold',
            },
            {
              accountCode: '1030',
              ...side(0, totalCogs),
              description: reversed
                ? 'Inventory restored'
                : 'Inventory reduction',
            },
          ]
        : []),
    ];
  };

  const orders = await prisma.order.findMany({ orderBy: { id: 'asc' } });

  for (const order of orders) {
    const netAmount = roundMoney(order.netAmount);
    const totalCogs = roundMoney(order.totalCogs);
    if (netAmount <= 0 && totalCogs <= 0) continue;

    await postEntry({
      branchId: order.branchId,
      date: order.createdAt,
      reference: `ORD-${order.id}`,
      description: `Sales Revenue and COGS for Order ${order.id}`,
      lines: saleLines(order, false),
    });

    const reversalKind =
      order.status === 'CANCELLED'
        ? 'VOID'
        : order.status === 'REFUNDED'
          ? 'REFUND'
          : null;

    if (reversalKind) {
      await postEntry({
        branchId: order.branchId,
        date: order.refundedAt ?? order.createdAt,
        reference: `${reversalKind}-ORD-${order.id}`,
        description: `${reversalKind === 'VOID' ? 'Void' : 'Refund'} reversal for Order ${order.id}`,
        lines: saleLines(order, true),
      });
    }
  }

  await postOpeningBalance(ctx, accountIds);
  await assertLedgerReconciles(ctx, accountIds);
}

async function assertLedgerReconciles(
  ctx: SeedContext,
  accountIds: Record<string, number>,
): Promise<void> {
  const { prisma } = ctx;

  const netDebit = async (code: string) => {
    const lines = await prisma.journalEntryLine.findMany({
      where: { accountId: accountIds[code] },
      select: { debit: true, credit: true },
    });
    return roundMoney(
      lines.reduce(
        (sum, line) => sum.plus(dec(line.debit)).minus(dec(line.credit)),
        dec(0),
      ),
    );
  };

  const allLines = await prisma.journalEntryLine.findMany({
    select: { debit: true, credit: true },
  });
  const totalDebit = roundMoney(
    allLines.reduce((sum, line) => sum.plus(dec(line.debit)), dec(0)),
  );
  const totalCredit = roundMoney(
    allLines.reduce((sum, line) => sum.plus(dec(line.credit)), dec(0)),
  );

  const liveOrders = await prisma.order.findMany({
    where: { status: { in: ['COMPLETED', 'PENDING', 'PREPARING'] } },
    select: { netAmount: true, taxAmount: true },
  });
  const operationalRevenue = roundMoney(
    liveOrders.reduce(
      (sum, order) =>
        sum.plus(dec(order.netAmount)).minus(dec(order.taxAmount ?? 0)),
      dec(0),
    ),
  );

  const batches = await prisma.inventoryBatch.findMany({
    where: { status: 'ACTIVE' },
    select: { quantity: true, ingredient: { select: { costPerUnit: true } } },
  });
  const stockValue = roundMoney(
    batches.reduce(
      (sum: Prisma.Decimal, batch) =>
        sum.plus(dec(batch.ingredient.costPerUnit).times(batch.quantity)),
      dec(0),
    ),
  );

  const checks: [string, number, number][] = [
    ['journal debits vs credits', totalDebit, totalCredit],
    ['ledger revenue vs order revenue', -(await netDebit('4010')), operationalRevenue],
    ['ledger inventory vs stock on hand', await netDebit('1030'), stockValue],
  ];

  for (const [label, left, right] of checks) {
    if (left !== right) {
      throw new Error(
        `Seed ledger does not reconcile — ${label}: ${left} vs ${right}.`,
      );
    }
  }

  console.log(
    `  Ledger reconciles: revenue ${operationalRevenue.toLocaleString()}, inventory ${stockValue.toLocaleString()}, debits = credits = ${totalDebit.toLocaleString()}`,
  );
}

async function postOpeningBalance(
  ctx: SeedContext,
  accountIds: Record<string, number>,
): Promise<void> {
  const { prisma, mainBranch } = ctx;

  const netDebitByAccount = async (code: string) => {
    const lines = await prisma.journalEntryLine.findMany({
      where: { accountId: accountIds[code] },
      select: { debit: true, credit: true },
    });
    return lines.reduce(
      (sum, line) => sum.plus(dec(line.debit)).minus(dec(line.credit)),
      dec(0),
    );
  };

  const batches = await prisma.inventoryBatch.findMany({
    where: { status: 'ACTIVE' },
    select: { quantity: true, ingredient: { select: { costPerUnit: true } } },
  });
  const stockValue = batches.reduce(
    (sum: Prisma.Decimal, batch) =>
      sum.plus(dec(batch.ingredient.costPerUnit).times(batch.quantity)),
    dec(0),
  );

  const openingCash = roundMoney(
    dec(TARGET_CLOSING_CASH).minus(await netDebitByAccount('1010')),
  );
  const openingInventory = roundMoney(
    stockValue.minus(await netDebitByAccount('1030')),
  );
  const openingCapital = roundMoney(openingCash + openingInventory);

  if (openingCapital <= 0) {
    console.warn(
      'Seeded operations already cover the opening position; skipping opening balance.',
    );
    return;
  }

  await prisma.journalEntry.create({
    data: {
      branchId: mainBranch.id,
      date: dateDaysAgo(OPENING_BALANCE_DAYS_AGO),
      reference: OPENING_BALANCE_REFERENCE,
      description: 'Opening balance — owner capital contributed at go-live',
      status: 'POSTED',
      lines: {
        create: [
          {
            accountId: accountIds['1010'],
            debit: openingCash,
            credit: 0,
            description: 'Opening cash',
          },
          {
            accountId: accountIds['1030'],
            debit: openingInventory,
            credit: 0,
            description: 'Opening inventory at standard cost',
          },
          {
            accountId: accountIds['3010'],
            debit: 0,
            credit: openingCapital,
            description: 'Owner capital contributed',
          },
        ],
      },
    },
  });

  console.log(
    `  Opening balance posted: cash ${openingCash.toLocaleString()} + inventory ${openingInventory.toLocaleString()} = capital ${openingCapital.toLocaleString()}`,
  );
}

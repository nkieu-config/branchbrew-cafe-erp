import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountType, JournalStatus, Prisma } from '@prisma/client';
import { buildJournalEntrySearchFilter } from './helpers/journal-entry-search.util';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderCreatedEvent } from '../orders/events/order-created.event';
import { OrderVoidedEvent } from '../orders/events/order-voided.event';
import { OrderRefundedEvent } from '../orders/events/order-refunded.event';
import { PurchaseOrderReceivedEvent } from '../procurement/events/purchase-order-received.event';
import { PurchaseOrderPaidEvent } from '../procurement/events/purchase-order-paid.event';
import { ProductionCompletedEvent } from '../production/events/production-completed.event';
import { StockAdjustedEvent } from '../inventory/events/stock-adjusted.event';
import { PayrollApprovedEvent } from '../hr/events/payroll-approved.event';
import { ExpenseCreatedEvent } from '../finance/events/expense-created.event';
import {
  dec,
  toNum,
  roundMoney,
  isBalancedMoney,
  sumMoney,
} from '../common/decimal.util';
import { DEFAULT_CHART_OF_ACCOUNTS } from './chart-of-accounts';
import {
  paymentAccountLabel,
  resolvePaymentAccountCode,
} from './payment-accounts.util';
import { normalBalanceOf } from './normal-balance.util';
import { OrderSnapshot } from '../orders/domain/order.snapshot';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(private prisma: PrismaService) {}

  @OnEvent('order.created', { async: true })
  async handleOrderCreated(event: OrderCreatedEvent) {
    this.logger.log(
      `Handling order.created event for Accounting (Order ${event.order.id})`,
    );

    const { order } = event;
    const netAmount = roundMoney(toNum(order.netAmount));
    const taxAmount = roundMoney(toNum(order.taxAmount ?? 0));
    const salesExVat = roundMoney(netAmount - taxAmount);
    const totalCogs = roundMoney(toNum(order.totalCogs));

    if (netAmount > 0 || totalCogs > 0) {
      const paymentAccountCode = resolvePaymentAccountCode(order.paymentMethod);

      await this.createJournalEntry({
        branchId: order.branchId,
        reference: `ORD-${order.id}`,
        description: `Sales Revenue and COGS for Order ${order.id}`,
        lines: [
          {
            accountCode: paymentAccountCode,
            debit: netAmount,
            credit: 0,
            description: paymentAccountLabel(order.paymentMethod),
          },
          {
            accountCode: '4010',
            debit: 0,
            credit: salesExVat,
            description: 'Sales Revenue (ex VAT)',
          },
          ...(taxAmount > 0
            ? [
                {
                  accountCode: '2020',
                  debit: 0,
                  credit: taxAmount,
                  description: 'Output VAT payable',
                },
              ]
            : []),
          ...(totalCogs > 0
            ? [
                {
                  accountCode: '5010',
                  debit: totalCogs,
                  credit: 0,
                  description: 'Cost of Goods Sold',
                },
                {
                  accountCode: '1030',
                  debit: 0,
                  credit: totalCogs,
                  description: 'Inventory reduction',
                },
              ]
            : []),
        ],
      });
    }
  }

  @OnEvent('order.voided', { async: true })
  async handleOrderVoided(event: OrderVoidedEvent) {
    this.logger.log(
      `Handling order.voided event for Accounting (Order ${event.order.id})`,
    );
    await this.postOrderSaleReversal(event.order, 'VOID');
  }

  @OnEvent('order.refunded', { async: true })
  async handleOrderRefunded(event: OrderRefundedEvent) {
    this.logger.log(
      `Handling order.refunded event for Accounting (Order ${event.order.id})`,
    );
    const suffix = event.reason ? ` — ${event.reason}` : '';
    await this.postOrderSaleReversal(event.order, 'REFUND', suffix);
  }

  private async postOrderSaleReversal(
    order: OrderSnapshot,
    kind: 'VOID' | 'REFUND',
    descriptionSuffix = '',
  ) {
    const netAmount = roundMoney(toNum(order.netAmount));
    const taxAmount = roundMoney(toNum(order.taxAmount ?? 0));
    const salesExVat = roundMoney(netAmount - taxAmount);
    const totalCogs = roundMoney(toNum(order.totalCogs));

    if (netAmount <= 0 && totalCogs <= 0) return;

    const paymentAccountCode = resolvePaymentAccountCode(order.paymentMethod);
    const label = kind === 'VOID' ? 'Void' : 'Refund';

    await this.createJournalEntry({
      branchId: order.branchId,
      reference: `${kind}-ORD-${order.id}`,
      description: `${label} reversal for Order ${order.id}${descriptionSuffix}`,
      lines: [
        {
          accountCode: paymentAccountCode,
          debit: 0,
          credit: netAmount,
          description: `${paymentAccountLabel(order.paymentMethod)} refunded`,
        },
        {
          accountCode: '4010',
          debit: salesExVat,
          credit: 0,
          description: 'Sales revenue reversed (ex VAT)',
        },
        ...(taxAmount > 0
          ? [
              {
                accountCode: '2020',
                debit: taxAmount,
                credit: 0,
                description: 'Output VAT reversed',
              },
            ]
          : []),
        ...(totalCogs > 0
          ? [
              {
                accountCode: '5010',
                debit: 0,
                credit: totalCogs,
                description: 'COGS reversed',
              },
              {
                accountCode: '1030',
                debit: totalCogs,
                credit: 0,
                description: 'Inventory restored',
              },
            ]
          : []),
      ],
    });
  }

  @OnEvent('purchase-order.received', { async: true })
  async handlePurchaseOrderReceived(event: PurchaseOrderReceivedEvent) {
    const totalAmount = roundMoney(event.totalAmount);
    if (totalAmount <= 0) return;

    const standardAmount = roundMoney(event.standardAmount);
    const variance = roundMoney(totalAmount - standardAmount);

    await this.createJournalEntry({
      branchId: event.branchId,
      reference: event.poNumber,
      description: `Accounts Payable for PO ${event.poNumber}`,
      lines: [
        {
          accountCode: '1030',
          debit: standardAmount,
          credit: 0,
          description: 'Inventory received (standard cost)',
        },
        ...(variance !== 0
          ? [
              variance > 0
                ? {
                    accountCode: '5035',
                    debit: variance,
                    credit: 0,
                    description: 'Purchase price variance (unfavorable)',
                  }
                : {
                    accountCode: '5035',
                    debit: 0,
                    credit: Math.abs(variance),
                    description: 'Purchase price variance (favorable)',
                  },
            ]
          : []),
        {
          accountCode: '2010',
          debit: 0,
          credit: totalAmount,
          description: 'Accounts Payable recognized',
        },
      ],
    });
  }

  @OnEvent('purchase-order.paid', { async: true })
  async handlePurchaseOrderPaid(event: PurchaseOrderPaidEvent) {
    const amount = roundMoney(event.amount);
    if (amount <= 0) return;

    const methodLabel =
      event.method === 'BANK_TRANSFER' ? 'bank transfer' : 'cash';

    await this.createJournalEntry({
      branchId: event.branchId,
      reference: `PAY-${event.poNumber}`,
      description: `Supplier payment for PO ${event.poNumber} (${methodLabel})`,
      lines: [
        {
          accountCode: '2010',
          debit: amount,
          credit: 0,
          description: 'Accounts Payable settled',
        },
        {
          accountCode: '1010',
          debit: 0,
          credit: amount,
          description: `Paid by ${methodLabel}`,
        },
      ],
    });
  }

  @OnEvent('production.completed', { async: true })
  async handleProductionCompleted(event: ProductionCompletedEvent) {
    const rawCost = dec(event.totalRawCost).toDecimalPlaces(2);
    const finishedValue = dec(event.finishedGoodsValue).toDecimalPlaces(2);
    if (rawCost.lte(0) && finishedValue.lte(0)) return;

    const variance = finishedValue.minus(rawCost);
    if (variance.isZero()) {
      this.logger.log(
        `Production ${event.orderNumber} converted at cost — no net GL effect, skipping journal entry.`,
      );
      return;
    }

    await this.createJournalEntry({
      branchId: event.branchId,
      reference: event.orderNumber,
      description: `Production Completion for ${event.targetIngredientName}`,
      lines: [
        {
          accountCode: '1030',
          debit: finishedValue.toNumber(),
          credit: 0,
          description: 'Finished goods into inventory (standard cost)',
        },
        {
          accountCode: '1030',
          debit: 0,
          credit: rawCost.toNumber(),
          description: 'Raw materials consumed (actual cost)',
        },
        variance.isNegative()
          ? {
              accountCode: '5030',
              debit: variance.abs().toNumber(),
              credit: 0,
              description: 'Production cost variance (unfavorable)',
            }
          : {
              accountCode: '5030',
              debit: 0,
              credit: variance.toNumber(),
              description: 'Production cost variance (favorable)',
            },
      ],
    });
  }

  @OnEvent('payroll.approved', { async: true })
  async handlePayrollApproved(event: PayrollApprovedEvent) {
    const totalGross = roundMoney(event.totalGross);
    const totalNet = roundMoney(event.totalNet);
    const totalDeductions = roundMoney(event.totalDeductions);
    if (totalGross <= 0) return;

    await this.createJournalEntry({
      branchId: event.branchId ?? undefined,
      reference: `PAYROLL-${event.payrollRunId}`,
      description: `Payroll for ${event.month}/${event.year}`,
      lines: [
        {
          accountCode: '5020',
          debit: totalGross,
          credit: 0,
          description: 'Payroll expense (gross)',
        },
        ...(totalDeductions > 0
          ? [
              {
                accountCode: '2030',
                debit: 0,
                credit: totalDeductions,
                description: 'Withholdings payable (SSO + tax)',
              },
            ]
          : []),
        {
          accountCode: '1010',
          debit: 0,
          credit: totalNet,
          description: 'Net pay disbursed',
        },
      ],
    });
  }

  @OnEvent('expense.created', { async: true })
  async handleExpenseCreated(event: ExpenseCreatedEvent) {
    const amount = roundMoney(event.amount);
    if (amount <= 0) return;

    await this.createJournalEntry({
      branchId: event.branchId,
      reference: `EXP-${event.expenseId}`,
      description: `Operating expense — ${event.category}`,
      lines: [
        {
          accountCode: '5050',
          debit: amount,
          credit: 0,
          description: 'Operating expense',
        },
        {
          accountCode: '1010',
          debit: 0,
          credit: amount,
          description: 'Paid in cash',
        },
      ],
    });
  }

  @OnEvent('inventory.stock-adjusted', { async: true })
  async handleStockAdjusted(event: StockAdjustedEvent) {
    const netValue = dec(event.netVarianceValue).toDecimalPlaces(2);
    if (netValue.isZero()) return;

    const amount = netValue.abs().toNumber();
    const isShortage = netValue.isNegative();

    await this.createJournalEntry({
      branchId: event.branchId,
      reference: event.reference,
      description: event.description,
      lines: isShortage
        ? [
            {
              accountCode: '5040',
              debit: amount,
              credit: 0,
              description: 'Inventory shrinkage (count shortage)',
            },
            {
              accountCode: '1030',
              debit: 0,
              credit: amount,
              description: 'Inventory written down',
            },
          ]
        : [
            {
              accountCode: '1030',
              debit: amount,
              credit: 0,
              description: 'Inventory written up',
            },
            {
              accountCode: '5040',
              debit: 0,
              credit: amount,
              description: 'Inventory shrinkage recovery (count overage)',
            },
          ],
    });
  }

  async getChartOfAccounts() {
    return this.prisma.account.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async getJournalEntryPage(options: {
    branchId?: number;
    status?: JournalStatus;
    search?: string;
    take: number;
    skip: number;
  }) {
    const where: Prisma.JournalEntryWhereInput = {
      ...(options.branchId ? { branchId: options.branchId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...buildJournalEntrySearchFilter(options.search),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.journalEntry.findMany({
        where,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take: options.take,
        skip: options.skip,
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { items, total };
  }

  async createJournalEntry(data: {
    branchId?: number;
    date?: Date;
    reference?: string;
    description: string;
    lines: {
      accountCode: string;
      debit: number;
      credit: number;
      description?: string;
    }[];
  }) {
    // 1. Verify debits equal credits
    const totalDebits = sumMoney(data.lines.map((line) => line.debit));
    const totalCredits = sumMoney(data.lines.map((line) => line.credit));

    if (!isBalancedMoney(totalDebits, totalCredits)) {
      throw new BadRequestException(
        `Journal entry unbalanced. Debits: ${totalDebits.toString()}, Credits: ${totalCredits.toString()}`,
      );
    }

    // 2. Fetch account IDs based on codes
    const accountCodes = data.lines.map((l) => l.accountCode);
    const accounts = await this.prisma.account.findMany({
      where: { code: { in: accountCodes } },
    });

    if (accounts.length !== new Set(accountCodes).size) {
      throw new BadRequestException('One or more account codes are invalid.');
    }

    const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

    // 3. Create the journal entry
    try {
      return await this.prisma.journalEntry.create({
        data: {
          branchId: data.branchId,
          date: data.date || new Date(),
          reference: data.reference,
          description: data.description,
          status: 'POSTED',
          lines: {
            create: data.lines.map((line) => ({
              accountId: accountMap.get(line.accountCode)!,
              debit: roundMoney(line.debit),
              credit: roundMoney(line.credit),
              description: line.description,
            })),
          },
        },
        include: {
          lines: true,
        },
      });
    } catch (err) {
      if (data.reference && this.isDuplicateReference(err)) {
        this.logger.warn(
          `Journal entry ${data.reference} already posted — skipping duplicate delivery.`,
        );
        const existing = await this.prisma.journalEntry.findUnique({
          where: { reference: data.reference },
          include: { lines: true },
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  private isDuplicateReference(err: unknown): boolean {
    if (
      !(err instanceof Prisma.PrismaClientKnownRequestError) ||
      err.code !== 'P2002'
    ) {
      return false;
    }
    const target = err.meta?.target;
    return Array.isArray(target) && target.includes('reference');
  }

  // Helper method to seed initial accounts if they don't exist
  async seedAccounts() {
    for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
      await this.prisma.account.upsert({
        where: { code: acc.code },
        update: {},
        create: acc,
      });
    }

    this.logger.log('Default accounts seeded.');
  }

  async getVatReport(branchId?: number, months = 6) {
    const branchFilter = branchId
      ? Prisma.sql`AND "branchId" = ${branchId}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      {
        month: string;
        gross_sales: number;
        output_vat: number;
        orders: bigint;
      }[]
    >`
      SELECT
        to_char("createdAt", 'YYYY-MM') AS month,
        SUM("netAmount") AS gross_sales,
        SUM("taxAmount") AS output_vat,
        COUNT(*)::bigint AS orders
      FROM "Order"
      WHERE "status" IN ('COMPLETED', 'PENDING', 'PREPARING')
      ${branchFilter}
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${months}
    `;

    return rows.map((row) => {
      const grossSales = roundMoney(Number(row.gross_sales));
      const outputVat = roundMoney(Number(row.output_vat));
      return {
        month: row.month,
        grossSales,
        outputVat,
        salesExVat: roundMoney(grossSales - outputVat),
        orderCount: Number(row.orders),
      };
    });
  }

  async getProfitLoss(branchId?: number) {
    const branchFilter = branchId
      ? Prisma.sql`AND je."branchId" = ${branchId}`
      : Prisma.empty;

    // Use raw SQL to group by month and account type directly in the database
    // This prevents loading thousands of rows into Node.js memory
    const results = await this.prisma.$queryRaw<
      {
        month: string;
        type: string;
        total_credit: number;
        total_debit: number;
      }[]
    >`
      SELECT 
        to_char(je."date", 'YYYY-MM') as month,
        a."type" as type,
        SUM(jel.credit) as total_credit,
        SUM(jel.debit) as total_debit
      FROM "JournalEntryLine" jel
      INNER JOIN "JournalEntry" je ON jel."journalEntryId" = je.id
      INNER JOIN "Account" a ON jel."accountId" = a.id
      WHERE a."type" IN ('REVENUE', 'EXPENSE')
      ${branchFilter}
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `;

    const monthlyData = new Map<
      string,
      { revenue: Prisma.Decimal; expense: Prisma.Decimal }
    >();

    // Initialize map with last 6 months to ensure we have data points
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = d.toISOString().slice(0, 7);
      monthlyData.set(mStr, { revenue: dec(0), expense: dec(0) });
    }

    for (const row of results) {
      if (!monthlyData.has(row.month)) {
        monthlyData.set(row.month, { revenue: dec(0), expense: dec(0) });
      }

      const stats = monthlyData.get(row.month)!;
      if (row.type === 'REVENUE') {
        stats.revenue = stats.revenue.plus(
          dec(row.total_credit).minus(dec(row.total_debit)),
        );
      } else if (row.type === 'EXPENSE') {
        stats.expense = stats.expense.plus(
          dec(row.total_debit).minus(dec(row.total_credit)),
        );
      }
    }

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        revenue: roundMoney(data.revenue),
        expense: roundMoney(data.expense),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  async getTrialBalance(branchId?: number, asOf?: string) {
    const branchFilter = branchId
      ? Prisma.sql`AND je."branchId" = ${branchId}`
      : Prisma.empty;

    const asOfFilter = asOf
      ? Prisma.sql`AND je."date" <= ${asOf}::date`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      {
        account_id: number;
        code: string;
        name: string;
        type: AccountType;
        total_debit: string | number;
        total_credit: string | number;
      }[]
    >`
      SELECT
        a.id AS account_id,
        a.code AS code,
        a.name AS name,
        a."type" AS type,
        SUM(jel.debit) AS total_debit,
        SUM(jel.credit) AS total_credit
      FROM "JournalEntryLine" jel
      INNER JOIN "JournalEntry" je ON jel."journalEntryId" = je.id
      INNER JOIN "Account" a ON jel."accountId" = a.id
      WHERE je."status" = 'POSTED'
      ${asOfFilter}
      ${branchFilter}
      GROUP BY a.id, a.code, a.name, a."type"
      HAVING SUM(jel.debit) <> 0 OR SUM(jel.credit) <> 0
      ORDER BY a.code ASC
    `;

    const accounts = rows.map((row) => {
      const debit = dec(row.total_debit);
      const credit = dec(row.total_credit);
      const normalBalance = normalBalanceOf(row.type);
      const balance =
        normalBalance === 'DEBIT' ? debit.minus(credit) : credit.minus(debit);

      return {
        accountId: row.account_id,
        code: row.code,
        name: row.name,
        type: row.type,
        normalBalance,
        debit: roundMoney(debit),
        credit: roundMoney(credit),
        balance: roundMoney(balance),
      };
    });

    const totalDebit = sumMoney(accounts.map((account) => account.debit));
    const totalCredit = sumMoney(accounts.map((account) => account.credit));

    return {
      scope: branchId ? ('BRANCH' as const) : ('CHAIN' as const),
      branchId: branchId ?? null,
      asOf: asOf ?? null,
      accounts,
      totalDebit: roundMoney(totalDebit),
      totalCredit: roundMoney(totalCredit),
      isBalanced: isBalancedMoney(totalDebit, totalCredit),
    };
  }

  async getBalanceSheet(branchId?: number, asOf?: string) {
    const trialBalance = await this.getTrialBalance(branchId, asOf);

    const linesOf = (type: AccountType) =>
      trialBalance.accounts
        .filter((account) => account.type === type)
        .map((account) => ({
          accountId: account.accountId,
          code: account.code,
          name: account.name,
          amount: account.balance,
          isComputed: false,
        }));

    const totalOf = (lines: { amount: number }[]) =>
      sumMoney(lines.map((line) => line.amount));

    const assets = linesOf('ASSET');
    const liabilities = linesOf('LIABILITY');

    const retainedEarnings = roundMoney(
      totalOf(linesOf('REVENUE')).minus(totalOf(linesOf('EXPENSE'))),
    );

    const equity = [
      ...linesOf('EQUITY'),
      {
        accountId: null,
        code: null,
        name: 'Retained earnings',
        amount: retainedEarnings,
        isComputed: true,
      },
    ];

    const totalAssets = totalOf(assets);
    const totalLiabilities = totalOf(liabilities);
    const totalEquity = totalOf(equity);
    const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);

    return {
      scope: trialBalance.scope,
      branchId: trialBalance.branchId,
      asOf: trialBalance.asOf,
      assets,
      liabilities,
      equity,
      retainedEarnings,
      totalAssets: roundMoney(totalAssets),
      totalLiabilities: roundMoney(totalLiabilities),
      totalEquity: roundMoney(totalEquity),
      totalLiabilitiesAndEquity: roundMoney(totalLiabilitiesAndEquity),
      isBalanced: isBalancedMoney(totalAssets, totalLiabilitiesAndEquity),
    };
  }
}

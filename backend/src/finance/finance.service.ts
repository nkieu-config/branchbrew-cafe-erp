import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toNum, roundMoney } from '../common/decimal.util';
import { escapeCsvRow } from '../common/csv.util';
import { Parser } from '@json2csv/plainjs';
import { Prisma } from '@prisma/client';
import {
  assertBranchAccess,
  BranchScopedUser,
} from '../auth/branch-scope.util';
import { FinanceRepository } from './finance.repository';
import { ApiErrorCode } from '../common/errors/api-error-code.enum';
import { appBadRequest, appNotFound } from '../common/errors/app.exception';
import { OutboxService } from '../outbox/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox-event.types';
import { toExpenseCreatedSnapshot } from './domain/expense-created.snapshot';

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    private financeRepository: FinanceRepository,
    private outboxService: OutboxService,
  ) {}

  async createExpense(data: {
    branchId: number;
    amount: number;
    category: string;
    description?: string;
    recordedById: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({ data });

      const amount = roundMoney(toNum(expense.amount));
      if (amount > 0) {
        await this.outboxService.enqueue(
          tx,
          OUTBOX_EVENT_TYPES.EXPENSE_CREATED,
          {
            expense: toExpenseCreatedSnapshot({
              expenseId: expense.id,
              branchId: expense.branchId,
              amount,
              category: expense.category,
            }),
          },
        );
      }

      return expense;
    });
  }

  async getExpenses(branchId: number, date?: Date) {
    const where: Prisma.ExpenseWhereInput = { branchId };
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }
    return this.prisma.expense.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { recordedBy: { select: { name: true } } },
    });
  }

  async calculateExpectedCash(branchId: number, date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const [payments, expenses] = await Promise.all([
      this.financeRepository.aggregateDailyPaymentTotals(branchId, start, end),
      this.financeRepository.aggregateDailyExpenses(branchId, start, end),
    ]);

    const expectedCash = roundMoney(
      toNum(payments.cash) - toNum(expenses._sum.amount),
    );
    return {
      expectedCash,
      expectedCreditCard: roundMoney(toNum(payments.creditCard)),
      expectedQR: roundMoney(toNum(payments.qr)),
      sales: roundMoney(toNum(payments.cash)),
      expenses: roundMoney(toNum(expenses._sum.amount)),
    };
  }

  async submitSettlement(data: {
    branchId: number;
    actualCash: number;
    actualCreditCard?: number;
    actualQR?: number;
    submittedById: number;
  }) {
    const today = new Date();
    const existing = await this.prisma.shiftSettlement.findFirst({
      where: {
        branchId: data.branchId,
        date: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
          lte: new Date(today.setHours(23, 59, 59, 999)),
        },
      },
    });

    if (existing && existing.status === 'APPROVED') {
      throw appBadRequest(
        ApiErrorCode.SETTLEMENT_ALREADY_APPROVED,
        'Settlement for today is already approved.',
      );
    }

    const calc = await this.calculateExpectedCash(data.branchId, new Date());
    const actualCreditCard = roundMoney(data.actualCreditCard || 0);
    const actualQR = roundMoney(data.actualQR || 0);

    const totalExpected = roundMoney(
      calc.expectedCash + calc.expectedCreditCard + calc.expectedQR,
    );
    const totalActual = roundMoney(
      data.actualCash + actualCreditCard + actualQR,
    );
    const difference = roundMoney(totalActual - totalExpected);

    if (existing) {
      return this.prisma.shiftSettlement.update({
        where: { id: existing.id },
        data: {
          expectedCash: calc.expectedCash,
          actualCash: roundMoney(data.actualCash),
          expectedCreditCard: calc.expectedCreditCard,
          actualCreditCard,
          expectedQR: calc.expectedQR,
          actualQR,
          difference,
          status: 'PENDING',
          submittedById: data.submittedById,
        },
      });
    }

    return this.prisma.shiftSettlement.create({
      data: {
        branchId: data.branchId,
        date: new Date(),
        expectedCash: calc.expectedCash,
        actualCash: roundMoney(data.actualCash),
        expectedCreditCard: calc.expectedCreditCard,
        actualCreditCard,
        expectedQR: calc.expectedQR,
        actualQR,
        difference,
        submittedById: data.submittedById,
      },
    });
  }

  async getSettlements(branchId?: number) {
    const where = branchId ? { branchId } : {};
    return this.prisma.shiftSettlement.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        submittedBy: { select: { name: true } },
        branch: { select: { name: true } },
      },
    });
  }

  async approveSettlement(id: number, user: BranchScopedUser) {
    const settlement = await this.prisma.shiftSettlement.findUnique({
      where: { id },
    });
    if (!settlement) {
      throw appNotFound(
        ApiErrorCode.SETTLEMENT_NOT_FOUND,
        'Settlement not found',
      );
    }
    assertBranchAccess(user, settlement.branchId);

    return this.prisma.shiftSettlement.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  }

  async exportSales(
    branchId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<string> {
    const where: Prisma.OrderWhereInput = {};
    if (branchId) where.branchId = branchId;
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }

    const orders = await this.financeRepository.findOrdersForExport(where);

    if (orders.length === 0) {
      return '';
    }

    const flatOrders = orders.map((order) => ({
      OrderID: order.id,
      Date: order.createdAt.toISOString(),
      Branch: order.branch.name,
      Cashier: order.user.name,
      Customer: order.customer ? order.customer.name : 'Walk-in',
      Status: order.status,
      TotalAmount: order.totalAmount,
      Discount: order.discountAmount,
      NetAmount: order.netAmount,
      PointsEarned: order.pointsEarned,
      PointsRedeemed: order.pointsRedeemed,
    }));

    const json2csvParser = new Parser();
    return json2csvParser.parse(flatOrders.map(escapeCsvRow));
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { AccountingService } from './accounting.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Prisma, PrismaClient } from '@prisma/client';
import { PurchaseOrderReceivedEvent } from '../procurement/events/purchase-order-received.event';
import { roundMoney } from '../common/decimal.util';

describe('AccountingService', () => {
  let service: AccountingService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AccountingService>(AccountingService);
  });

  describe('createJournalEntry', () => {
    const mockAccounts = [
      { id: 1, code: '1010', name: 'Cash', type: 'ASSET' },
      { id: 2, code: '4010', name: 'Sales Revenue', type: 'REVENUE' },
    ];

    it('throws when debits and credits do not balance', async () => {
      const entryData = {
        description: 'Unbalanced Entry',
        lines: [
          { accountCode: '1010', debit: 100, credit: 0 },
          { accountCode: '4010', debit: 0, credit: 90 }, // Unbalanced!
        ],
      };

      await expect(service.createJournalEntry(entryData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createJournalEntry(entryData)).rejects.toThrow(
        'Journal entry unbalanced',
      );

      expect(prismaMock.account.findMany).not.toHaveBeenCalled();
      expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
    });

    it('throws when account codes are invalid', async () => {
      const entryData = {
        description: 'Invalid Accounts',
        lines: [
          { accountCode: '1010', debit: 100, credit: 0 },
          { accountCode: '9999', debit: 0, credit: 100 }, // 9999 does not exist
        ],
      };

      // Mock DB returning only 1 account
      prismaMock.account.findMany.mockResolvedValue([mockAccounts[0]] as any);

      await expect(service.createJournalEntry(entryData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createJournalEntry(entryData)).rejects.toThrow(
        'One or more account codes are invalid',
      );

      expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
    });

    it('creates journal entry when balanced and accounts are valid', async () => {
      const entryData = {
        branchId: 1,
        reference: 'TEST-001',
        description: 'Valid Entry',
        lines: [
          { accountCode: '1010', debit: 100, credit: 0 },
          { accountCode: '4010', debit: 0, credit: 100 },
        ],
      };

      prismaMock.account.findMany.mockResolvedValue(mockAccounts as any);

      const createdEntry = {
        id: 1,
        ...entryData,
        status: 'POSTED',
        date: new Date(),
      };

      prismaMock.journalEntry.create.mockResolvedValue(createdEntry as any);

      const result = await service.createJournalEntry(entryData);

      expect(result).toEqual(createdEntry);
      expect(prismaMock.account.findMany).toHaveBeenCalledWith({
        where: { code: { in: ['1010', '4010'] } },
      });
      expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'POSTED',
            lines: {
              create: [
                { accountId: 1, debit: 100, credit: 0, description: undefined },
                { accountId: 2, debit: 0, credit: 100, description: undefined },
              ],
            },
          }),
        }),
      );
    });

    it('rejects an entry that is off by one cent', async () => {
      const entryData = {
        description: 'Off by a cent',
        lines: [
          { accountCode: '1010', debit: 100, credit: 0 },
          { accountCode: '4010', debit: 0, credit: 100.01 },
        ],
      };

      await expect(service.createJournalEntry(entryData)).rejects.toThrow(
        'Journal entry unbalanced',
      );
    });

    it('returns the existing entry when the reference was already posted (outbox retry)', async () => {
      const entryData = {
        reference: 'ORD-42',
        description: 'Duplicate delivery',
        lines: [
          { accountCode: '1010', debit: 100, credit: 0 },
          { accountCode: '4010', debit: 0, credit: 100 },
        ],
      };

      prismaMock.account.findMany.mockResolvedValue(mockAccounts as any);
      prismaMock.journalEntry.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['reference'] },
        }),
      );

      const existingEntry = { id: 7, reference: 'ORD-42', lines: [] };
      prismaMock.journalEntry.findUnique.mockResolvedValue(
        existingEntry as any,
      );

      const result = await service.createJournalEntry(entryData);

      expect(result).toEqual(existingEntry);
      expect(prismaMock.journalEntry.findUnique).toHaveBeenCalledWith({
        where: { reference: 'ORD-42' },
        include: { lines: true },
      });
    });
  });

  describe('handleOrderVoided / handleOrderRefunded', () => {
    const orderSnapshot = {
      id: 42,
      branchId: 1,
      netAmount: 150,
      totalCogs: 30,
      paymentMethod: 'CASH',
    };

    it('posts a VOID reversal that mirrors the sale entry', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handleOrderVoided({ order: orderSnapshot } as any);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'VOID-ORD-42',
          lines: [
            expect.objectContaining({ accountCode: '1010', credit: 150 }),
            expect.objectContaining({ accountCode: '4010', debit: 150 }),
            expect.objectContaining({ accountCode: '5010', credit: 30 }),
            expect.objectContaining({ accountCode: '1030', debit: 30 }),
          ],
        }),
      );
      createSpy.mockRestore();
    });

    it('posts a REFUND reversal with its own reference (idempotency key)', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handleOrderRefunded({
        order: orderSnapshot,
        reason: 'Wrong drink',
      } as any);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'REFUND-ORD-42',
          description: expect.stringContaining('Wrong drink'),
        }),
      );
      createSpy.mockRestore();
    });

    it('skips reversal for zero-value orders', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handleOrderVoided({
        order: { ...orderSnapshot, netAmount: 0, totalCogs: 0 },
      } as any);

      expect(createSpy).not.toHaveBeenCalled();
      createSpy.mockRestore();
    });
  });

  describe('handlePurchaseOrderReceived', () => {
    type PostedLine = { accountCode: string; debit: number; credit: number };

    function receiveEvent(snapshot: {
      totalAmount: number;
      standardAmount?: number;
      poNumber?: string;
    }) {
      return new PurchaseOrderReceivedEvent({
        poId: 12,
        poNumber: snapshot.poNumber ?? 'PO-000123',
        branchId: 2,
        totalAmount: snapshot.totalAmount,
        standardAmount: snapshot.standardAmount,
      });
    }

    function expectBalanced(lines: PostedLine[]) {
      const debits = lines.reduce((sum, line) => sum + line.debit, 0);
      const credits = lines.reduce((sum, line) => sum + line.credit, 0);
      expect(roundMoney(debits)).toBe(roundMoney(credits));
    }

    it('debits inventory at standard and parks an overpayment in 5035', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handlePurchaseOrderReceived(
        receiveEvent({ totalAmount: 450, standardAmount: 400 }),
      );

      const lines = createSpy.mock.calls[0][0].lines as PostedLine[];
      expect(lines).toEqual([
        expect.objectContaining({ accountCode: '1030', debit: 400 }),
        expect.objectContaining({ accountCode: '5035', debit: 50, credit: 0 }),
        expect.objectContaining({ accountCode: '2010', credit: 450 }),
      ]);
      expectBalanced(lines);
      createSpy.mockRestore();
    });

    it('credits 5035 when the goods cost less than standard', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handlePurchaseOrderReceived(
        receiveEvent({ totalAmount: 450, standardAmount: 500 }),
      );

      const lines = createSpy.mock.calls[0][0].lines as PostedLine[];
      expect(lines).toEqual([
        expect.objectContaining({ accountCode: '1030', debit: 500 }),
        expect.objectContaining({ accountCode: '5035', debit: 0, credit: 50 }),
        expect.objectContaining({ accountCode: '2010', credit: 450 }),
      ]);
      expectBalanced(lines);
      createSpy.mockRestore();
    });

    it('omits the variance line when the PO was bought at standard', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handlePurchaseOrderReceived(
        receiveEvent({ totalAmount: 450, standardAmount: 450 }),
      );

      const lines = createSpy.mock.calls[0][0].lines as PostedLine[];
      expect(lines).toEqual([
        expect.objectContaining({ accountCode: '1030', debit: 450 }),
        expect.objectContaining({ accountCode: '2010', credit: 450 }),
      ]);
      expectBalanced(lines);
      createSpy.mockRestore();
    });

    it('falls back to the actual cost for events enqueued before standard cost was captured', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handlePurchaseOrderReceived(
        receiveEvent({ totalAmount: 1234.56 }),
      );

      const lines = createSpy.mock.calls[0][0].lines as PostedLine[];
      expect(lines).toEqual([
        expect.objectContaining({ accountCode: '1030', debit: 1234.56 }),
        expect.objectContaining({ accountCode: '2010', credit: 1234.56 }),
      ]);
      expectBalanced(lines);
      createSpy.mockRestore();
    });

    it('ignores zero-amount receipts', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handlePurchaseOrderReceived(
        receiveEvent({ totalAmount: 0, standardAmount: 0 }),
      );

      expect(createSpy).not.toHaveBeenCalled();
      createSpy.mockRestore();
    });
  });

  describe('handleProductionCompleted', () => {
    it('posts finished goods at standard cost with variance to 5030', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handleProductionCompleted({
        orderNumber: 'PRD-001',
        targetIngredientName: 'Cold Brew Concentrate',
        branchId: 1,
        totalRawCost: 90,
        finishedGoodsValue: 100,
      } as any);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'PRD-001',
          lines: [
            expect.objectContaining({ accountCode: '1030', debit: 100 }),
            expect.objectContaining({ accountCode: '1030', credit: 90 }),
            expect.objectContaining({ accountCode: '5030', credit: 10 }),
          ],
        }),
      );

      createSpy.mockRestore();
    });

    it('skips the entry when conversion happens exactly at cost', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handleProductionCompleted({
        orderNumber: 'PRD-002',
        targetIngredientName: 'Syrup',
        branchId: 1,
        totalRawCost: 50,
        finishedGoodsValue: 50,
      } as any);

      expect(createSpy).not.toHaveBeenCalled();
      createSpy.mockRestore();
    });
  });

  describe('VAT split on sales', () => {
    it('credits sales ex-VAT and output VAT separately', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handleOrderCreated({
        order: {
          id: 99,
          branchId: 1,
          netAmount: 107,
          taxAmount: 7,
          totalCogs: 0,
          paymentMethod: 'CASH',
        },
      } as any);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            expect.objectContaining({ accountCode: '1010', debit: 107 }),
            expect.objectContaining({ accountCode: '4010', credit: 100 }),
            expect.objectContaining({ accountCode: '2020', credit: 7 }),
          ],
        }),
      );
      createSpy.mockRestore();
    });
  });

  describe('handlePayrollApproved', () => {
    it('posts gross payroll against withholdings and cash', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handlePayrollApproved({
        payrollRunId: 3,
        branchId: 2,
        month: 6,
        year: 2026,
        totalGross: 50000,
        totalNet: 46000,
        totalDeductions: 4000,
      } as any);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'PAYROLL-3',
          lines: [
            expect.objectContaining({ accountCode: '5020', debit: 50000 }),
            expect.objectContaining({ accountCode: '2030', credit: 4000 }),
            expect.objectContaining({ accountCode: '1010', credit: 46000 }),
          ],
        }),
      );
      createSpy.mockRestore();
    });
  });

  describe('handleExpenseCreated', () => {
    it('posts operating expenses against cash', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handleExpenseCreated({
        expenseId: 12,
        branchId: 2,
        amount: 320,
        category: 'Utilities',
      } as any);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'EXP-12',
          lines: [
            expect.objectContaining({ accountCode: '5050', debit: 320 }),
            expect.objectContaining({ accountCode: '1010', credit: 320 }),
          ],
        }),
      );
      createSpy.mockRestore();
    });
  });

  describe('handlePurchaseOrderPaid', () => {
    it('settles AP against cash with an idempotent reference', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handlePurchaseOrderPaid({
        poId: 5,
        poNumber: 'PO-000005',
        branchId: 2,
        amount: 450,
        method: 'BANK_TRANSFER',
      } as any);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 2,
          reference: 'PAY-PO-000005',
          lines: [
            expect.objectContaining({
              accountCode: '2010',
              debit: 450,
              credit: 0,
            }),
            expect.objectContaining({
              accountCode: '1010',
              debit: 0,
              credit: 450,
            }),
          ],
        }),
      );
      createSpy.mockRestore();
    });

    it('skips zero-amount payments', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handlePurchaseOrderPaid({
        poId: 6,
        poNumber: 'PO-000006',
        branchId: 2,
        amount: 0,
        method: 'CASH',
      } as any);

      expect(createSpy).not.toHaveBeenCalled();
      createSpy.mockRestore();
    });
  });

  describe('handleStockAdjusted', () => {
    it('posts shrinkage for a count shortage', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handleStockAdjusted({
        reference: 'STOCKCOUNT-7',
        branchId: 2,
        netVarianceValue: -125.5,
        description: 'Stock count #7 variance',
      } as any);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 2,
          reference: 'STOCKCOUNT-7',
          lines: [
            expect.objectContaining({
              accountCode: '5040',
              debit: 125.5,
              credit: 0,
            }),
            expect.objectContaining({
              accountCode: '1030',
              debit: 0,
              credit: 125.5,
            }),
          ],
        }),
      );
      createSpy.mockRestore();
    });

    it('posts a write-up for a count overage', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handleStockAdjusted({
        reference: 'ADJ-3',
        branchId: 1,
        netVarianceValue: 40,
        description: 'Manual stock adjustment #3 (CORRECTION)',
      } as any);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            expect.objectContaining({
              accountCode: '1030',
              debit: 40,
              credit: 0,
            }),
            expect.objectContaining({
              accountCode: '5040',
              debit: 0,
              credit: 40,
            }),
          ],
        }),
      );
      createSpy.mockRestore();
    });

    it('skips zero-value adjustments', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handleStockAdjusted({
        reference: 'STOCKCOUNT-9',
        branchId: 1,
        netVarianceValue: 0,
        description: 'Stock count #9 variance',
      } as any);

      expect(createSpy).not.toHaveBeenCalled();
      createSpy.mockRestore();
    });
  });

  describe('handleOrderCreated', () => {
    it('uses the payment clearing account for card sales', async () => {
      const createSpy = jest
        .spyOn(service, 'createJournalEntry')
        .mockResolvedValue({ id: 1 } as any);

      await service.handleOrderCreated({
        order: {
          id: 42,
          branchId: 1,
          netAmount: 150,
          totalCogs: 30,
          paymentMethod: 'CREDIT_CARD',
        },
      } as any);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: expect.arrayContaining([
            expect.objectContaining({
              accountCode: '1040',
              debit: 150,
              description: 'Card payment received',
            }),
          ]),
        }),
      );

      createSpy.mockRestore();
    });
  });

  describe('getTrialBalance', () => {
    const rawRows = [
      {
        account_id: 1,
        code: '1010',
        name: 'Cash',
        type: 'ASSET',
        total_debit: '1200.50',
        total_credit: '200.50',
      },
      {
        account_id: 2,
        code: '2020',
        name: 'Output VAT Payable',
        type: 'LIABILITY',
        total_debit: '0',
        total_credit: '70.00',
      },
      {
        account_id: 3,
        code: '4010',
        name: 'Sales Revenue',
        type: 'REVENUE',
        total_debit: '0',
        total_credit: '930.00',
      },
    ];

    it('nets each account onto its normal side', async () => {
      prismaMock.$queryRaw.mockResolvedValue(rawRows);

      const result = await service.getTrialBalance();

      expect(result.accounts).toEqual([
        expect.objectContaining({
          code: '1010',
          normalBalance: 'DEBIT',
          debit: 1200.5,
          credit: 200.5,
          balance: 1000,
        }),
        expect.objectContaining({
          code: '2020',
          normalBalance: 'CREDIT',
          balance: 70,
        }),
        expect.objectContaining({
          code: '4010',
          normalBalance: 'CREDIT',
          balance: 930,
        }),
      ]);
    });

    it('reports the ledger as balanced when debits equal credits', async () => {
      prismaMock.$queryRaw.mockResolvedValue(rawRows);

      const result = await service.getTrialBalance();

      expect(result.totalDebit).toBe(1200.5);
      expect(result.totalCredit).toBe(1200.5);
      expect(result.isBalanced).toBe(true);
    });

    it('reports the ledger as unbalanced when a single cent is off', async () => {
      prismaMock.$queryRaw.mockResolvedValue([
        { ...rawRows[0] },
        { ...rawRows[1], total_credit: '70.01' },
        { ...rawRows[2] },
      ]);

      const result = await service.getTrialBalance();

      expect(result.totalCredit).toBe(1200.51);
      expect(result.isBalanced).toBe(false);
    });

    it('sums in decimal space so repeating fractions do not drift', async () => {
      prismaMock.$queryRaw.mockResolvedValue([
        { ...rawRows[0], total_debit: '0.1', total_credit: '0' },
        { ...rawRows[1], total_debit: '0.2', total_credit: '0' },
      ]);

      const result = await service.getTrialBalance();

      expect(result.totalDebit).toBe(0.3);
    });

    it('marks a branch-filtered view as a partial scope', async () => {
      prismaMock.$queryRaw.mockResolvedValue(rawRows);

      const result = await service.getTrialBalance(2, '2026-07-25');

      expect(result).toEqual(
        expect.objectContaining({
          scope: 'BRANCH',
          branchId: 2,
          asOf: '2026-07-25',
        }),
      );
    });

    it('defaults to the whole chain with no cut-off date', async () => {
      prismaMock.$queryRaw.mockResolvedValue(rawRows);

      const result = await service.getTrialBalance();

      expect(result).toEqual(
        expect.objectContaining({
          scope: 'CHAIN',
          branchId: null,
          asOf: null,
        }),
      );
    });
  });
});

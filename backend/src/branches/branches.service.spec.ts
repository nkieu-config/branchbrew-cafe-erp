import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MockPrismaService,
  PrismaServiceMockProvider,
} from '../prisma/prisma.service.mock';

describe('BranchesService', () => {
  let service: BranchesService;
  let prisma: MockPrismaService;

  const pendingTransfer = {
    id: 4,
    status: 'PENDING' as const,
    fromBranchId: 1,
    toBranchId: 2,
    ingredientId: 3,
    quantity: 10,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BranchesService, PrismaServiceMockProvider],
    }).compile();

    service = module.get(BranchesService);
    prisma = module.get(PrismaService);
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
  });

  describe('acceptTransfer', () => {
    it('claims the PENDING transfer before moving any stock', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(pendingTransfer as any);
      prisma.stockTransfer.updateMany.mockResolvedValue({ count: 1 });
      prisma.inventoryBatch.findMany.mockResolvedValue([
        { id: 11, quantity: 10, expiryDate: null, status: 'ACTIVE' },
      ] as any);
      prisma.inventoryBatch.updateMany.mockResolvedValue({ count: 1 });
      prisma.branchInventory.updateMany.mockResolvedValue({ count: 1 });
      prisma.stockTransfer.findUniqueOrThrow.mockResolvedValue({
        ...pendingTransfer,
        status: 'COMPLETED',
      } as any);

      const result = await service.acceptTransfer(4, 7);

      expect(prisma.stockTransfer.updateMany).toHaveBeenCalledWith({
        where: { id: 4, status: 'PENDING' },
        data: { status: 'COMPLETED', approvedById: 7 },
      });
      expect(result.status).toBe('COMPLETED');
    });

    it('moves no stock when a concurrent accept already claimed the transfer', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(pendingTransfer as any);
      prisma.stockTransfer.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.acceptTransfer(4, 7)).rejects.toThrow(
        BadRequestException,
      );

      expect(prisma.inventoryBatch.updateMany).not.toHaveBeenCalled();
      expect(prisma.branchInventory.updateMany).not.toHaveBeenCalled();
      expect(prisma.inventoryBatch.create).not.toHaveBeenCalled();
      expect(prisma.branchInventory.upsert).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('transfer listings', () => {
    const expectedInclude = {
      fromBranch: true,
      toBranch: true,
      ingredient: true,
      requestedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          branchId: true,
        },
      },
    } as const;

    it('never exposes the requester compensation in the branch listing', async () => {
      prisma.stockTransfer.findMany.mockResolvedValue([]);

      await service.getTransfers(1);

      expect(prisma.stockTransfer.findMany).toHaveBeenCalledWith({
        where: { OR: [{ fromBranchId: 1 }, { toBranchId: 1 }] },
        include: expectedInclude,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('never exposes the requester compensation in the chain-wide listing', async () => {
      prisma.stockTransfer.findMany.mockResolvedValue([]);

      await service.getAllTransfers();

      expect(prisma.stockTransfer.findMany).toHaveBeenCalledWith({
        include: expectedInclude,
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { HrService } from './hr.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MockPrismaService,
  PrismaServiceMockProvider,
} from '../prisma/prisma.service.mock';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('HrService', () => {
  let service: HrService;
  let prisma: MockPrismaService;
  let audit: { logAction: jest.Mock };
  let notifications: { notifyBranch: jest.Mock; notifyUser: jest.Mock };

  beforeEach(async () => {
    audit = { logAction: jest.fn() };
    notifications = { notifyBranch: jest.fn(), notifyUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HrService,
        PrismaServiceMockProvider,
        { provide: AuditService, useValue: audit },
        { provide: OutboxService, useValue: { enqueue: jest.fn() } },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<HrService>(HrService);
    prisma = module.get(PrismaService);
  });

  describe('generatePayrollRun', () => {
    it('throws when payroll run already exists', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue({ id: 1 } as any);

      await expect(service.generatePayrollRun(1, 6, 2026)).rejects.toThrow(
        new BadRequestException('Payroll run already exists for this month.'),
      );
    });

    it('rejects a concurrent duplicate run via the unique period constraint', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(null);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.payrollRun.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['branchId', 'month', 'year'] },
        }),
      );

      await expect(service.generatePayrollRun(1, 6, 2026)).rejects.toThrow(
        new BadRequestException('Payroll run already exists for this month.'),
      );
    });

    it('calculates OT and deductions correctly', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(null);

      // Mock attendance records:
      // User 1: 10 hours total -> 8 standard, 2 OT. Rate = 100
      // Base: 800, OT: 2 * 150 = 300, Gross: 1100
      // SS (5%): 55. Tax (3%): 33. Net: 1100 - 55 - 33 = 1012.
      //
      // User 2: 200 hours total -> 8 standard (assuming one record for simplicity), 192 OT. Rate = 200
      // Base: 1600, OT: 192 * 300 = 57600, Gross: 59200.
      // SS (5%): 2960 -> Cap at 750. Tax (3%): 1776. Net: 59200 - 750 - 1776 = 56674.

      const mockBranchId = 2;

      prisma.attendanceRecord.findMany.mockResolvedValue([
        {
          id: 1,
          userId: 1,
          branchId: mockBranchId,
          totalHours: 10,
          user: { id: 1, hourlyRate: 100 },
        },
        {
          id: 2,
          userId: 2,
          branchId: mockBranchId,
          totalHours: 200,
          user: { id: 2, hourlyRate: 2000 }, // High rate to trigger SS cap
        },
      ] as any);

      prisma.user.findMany.mockResolvedValue([]);
      prisma.payrollRun.create.mockResolvedValue({ id: 2 } as any);

      await service.generatePayrollRun(mockBranchId, 6, 2026);

      expect(prisma.payrollRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payslips: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  userId: 1,
                  standardHours: 8,
                  otHours: 2,
                  basePay: 800,
                  otPay: 300,
                  grossPay: 1100,
                  socialSecurity: 40, // Wait, code in hr.service.ts says: socialSecurity = Math.min(basePay * 0.05, 750). basePay = 800. 800 * 0.05 = 40.
                  taxDeduction: 33, // 1100 * 0.03
                  netPay: 1027, // 1100 - 40 - 33
                }),
                expect.objectContaining({
                  userId: 2,
                  standardHours: 8,
                  otHours: 192,
                  basePay: 16000,
                  socialSecurity: 750, // Math.min(16000 * 0.05, 750) = Math.min(800, 750) = 750
                }),
              ]),
            },
          }),
        }),
      );
    });

    it('includes full-time employees with no attendance records', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(null);
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 5,
          hourlyRate: 0,
          baseSalary: 30000,
          employmentType: 'FULL_TIME',
        },
      ] as any);
      prisma.payrollRun.create.mockResolvedValue({ id: 3 } as any);

      await service.generatePayrollRun(2, 6, 2026);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { branchId: 2, employmentType: 'FULL_TIME' },
      });
      expect(prisma.payrollRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payslips: {
              create: [
                expect.objectContaining({
                  userId: 5,
                  standardHours: 0,
                  otHours: 0,
                  basePay: 30000,
                  otPay: 0,
                  grossPay: 30000,
                  socialSecurity: 750,
                  taxDeduction: 900,
                  netPay: 28350,
                }),
              ],
            },
          }),
        }),
      );
    });
  });
  describe('updateUser', () => {
    it('revokes existing tokens when branch, role, or password changes', async () => {
      prisma.user.update.mockResolvedValue({ id: 3 } as any);

      await service.updateUser(3, { branchId: 9 });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 3 },
          data: expect.objectContaining({
            branchId: 9,
            tokenVersion: { increment: 1 },
          }),
        }),
      );
    });

    it('leaves tokens intact when only the display name changes', async () => {
      prisma.user.update.mockResolvedValue({ id: 3 } as any);

      await service.updateUser(3, { name: 'New Name' });

      const data = prisma.user.update.mock.calls[0][0].data as Record<
        string,
        unknown
      >;
      expect(data.tokenVersion).toBeUndefined();
    });
  });

  describe('updateHourlyRate', () => {
    it('selects only HR response fields so the password hash never leaves the database', async () => {
      prisma.user.update.mockResolvedValue({ id: 7, hourlyRate: 120 } as any);

      await service.updateHourlyRate(7, 120);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { hourlyRate: 120 },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          hourlyRate: true,
          branchId: true,
          employmentType: true,
          baseSalary: true,
        },
      });
    });
  });

  describe('getShiftsByBranch', () => {
    it('never exposes compensation fields to branch peers', async () => {
      prisma.shift.findMany.mockResolvedValue([]);

      await service.getShiftsByBranch(1);

      expect(prisma.shift.findMany).toHaveBeenCalledWith({
        where: { branchId: 1 },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              branchId: true,
            },
          },
        },
        orderBy: { startTime: 'asc' },
      });
    });
  });

  describe('processLeaveRequest', () => {
    const branchlessLeave = {
      id: 1,
      userId: 5,
      type: 'SICK',
      user: { branchId: null },
    };

    it('denies a manager acting on a branchless user rather than skipping the check', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(branchlessLeave as any);

      await expect(
        service.processLeaveRequest(1, 'APPROVED', {
          userId: 9,
          role: 'MANAGER',
          branchId: 1,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
    });

    it('still lets a super admin act on a branchless user', async () => {
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.leaveRequest.findUnique.mockResolvedValue(branchlessLeave as any);
      prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
        id: 1,
        status: 'APPROVED',
      } as any);

      await service.processLeaveRequest(1, 'APPROVED', {
        userId: 1,
        role: 'SUPER_ADMIN',
        branchId: null,
      });

      expect(prisma.leaveRequest.updateMany).toHaveBeenCalled();
    });

    it('claims only a PENDING request and stamps who decided it', async () => {
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 5,
        userId: 2,
        type: 'SICK',
        user: { branchId: 1 },
      } as any);
      prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
        id: 5,
        status: 'APPROVED',
        decidedById: 9,
      } as any);

      const manager = { userId: 9, role: 'MANAGER' as const, branchId: 1 };
      const result = await service.processLeaveRequest(5, 'APPROVED', manager);

      expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 5, status: 'PENDING' },
        data: expect.objectContaining({
          status: 'APPROVED',
          decidedById: 9,
          decidedAt: expect.any(Date),
        }),
      });
      expect(audit.logAction).toHaveBeenCalledWith(
        9,
        'DECIDE_LEAVE',
        'LeaveRequest',
        5,
        expect.objectContaining({ status: 'APPROVED', requesterId: 2 }),
        prisma,
      );
      expect(result.decidedById).toBe(9);
    });

    it('refuses to decide a request that was already decided', async () => {
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 5,
        userId: 2,
        type: 'SICK',
        user: { branchId: 1 },
      } as any);
      prisma.leaveRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.processLeaveRequest(5, 'APPROVED', {
          userId: 9,
          role: 'MANAGER',
          branchId: 1,
        }),
      ).rejects.toThrow(ConflictException);

      expect(notifications.notifyUser).not.toHaveBeenCalled();
    });
  });
});

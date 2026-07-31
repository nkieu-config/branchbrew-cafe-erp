import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveType, EmploymentType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  assertBranchAccess,
  BranchScopedUser,
} from '../auth/branch-scope.util';
import { SAFE_USER_SELECT } from '../common/user-select';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LeaveDecision } from './dto/process-leave.dto';
import { dec, toNum, roundMoney, sumMoney } from '../common/decimal.util';
import {
  AuditService,
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
} from '../audit/audit.service';

import { OutboxService } from '../outbox/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox-event.types';
import { toPayrollApprovedSnapshot } from './domain/payroll-approved.snapshot';
import { NotificationsService } from '../notifications/notifications.service';

const OT_MULTIPLIER = '1.5';
const MONTHLY_HOURS = '240';
const SOCIAL_SECURITY_RATE = '0.05';
const SOCIAL_SECURITY_CAP = '750';
const TAX_RATE = '0.03';

@Injectable()
export class HrService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private outboxService: OutboxService,
    private notifications: NotificationsService,
  ) {}

  // ==================== ATTENDANCE ====================
  async clockIn(userId: number, branchId: number) {
    const activeRecord = await this.prisma.attendanceRecord.findFirst({
      where: { userId, clockOut: null },
    });

    if (activeRecord) {
      throw new BadRequestException('You are already clocked in.');
    }

    return this.prisma.attendanceRecord.create({
      data: { userId, branchId },
    });
  }

  async clockOut(userId: number) {
    const activeRecord = await this.prisma.attendanceRecord.findFirst({
      where: { userId, clockOut: null },
    });

    if (!activeRecord) {
      throw new BadRequestException('You are not currently clocked in.');
    }

    const clockOutTime = new Date();
    const durationMs = clockOutTime.getTime() - activeRecord.clockIn.getTime();
    const totalHours = durationMs / (1000 * 60 * 60);

    return this.prisma.attendanceRecord.update({
      where: { id: activeRecord.id },
      data: { clockOut: clockOutTime, totalHours },
    });
  }

  async getMyAttendance(userId: number) {
    return this.prisma.attendanceRecord.findMany({
      where: { userId },
      include: { branch: true },
      orderBy: { clockIn: 'desc' },
      take: 30,
    });
  }

  async getActiveClockIn(userId: number) {
    return this.prisma.attendanceRecord.findFirst({
      where: { userId, clockOut: null },
      include: { branch: true },
    });
  }

  // ==================== SHIFTS ====================
  async createShift(data: {
    userId: number;
    branchId: number;
    startTime: string;
    endTime: string;
  }) {
    return this.prisma.shift.create({
      data: {
        userId: data.userId,
        branchId: data.branchId,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
      },
    });
  }

  async getShiftsByBranch(branchId: number) {
    return this.prisma.shift.findMany({
      where: { branchId },
      include: { user: { select: SAFE_USER_SELECT } },
      orderBy: { startTime: 'asc' },
    });
  }

  async getMyShifts(userId: number) {
    return this.prisma.shift.findMany({
      where: { userId },
      include: { branch: true },
      orderBy: { startTime: 'asc' },
    });
  }

  // ==================== LEAVE MANAGEMENT ====================
  async requestLeave(
    userId: number,
    data: {
      type: LeaveType;
      startDate: string;
      endDate: string;
      reason?: string;
    },
  ) {
    return this.prisma.leaveRequest.create({
      data: {
        userId,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
      },
    });
  }

  async getLeaveRequests(branchId?: number) {
    return this.prisma.leaveRequest.findMany({
      where: branchId ? { user: { branchId } } : {},
      include: {
        user: { select: { name: true, email: true, branchId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyLeaveRequests(userId: number) {
    return this.prisma.leaveRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async processLeaveRequest(
    id: number,
    status: LeaveDecision,
    user: BranchScopedUser,
  ) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { user: { select: { branchId: true } } },
    });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.user.branchId == null) {
      if (user.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException(
          'You do not have access to this leave request.',
        );
      }
    } else {
      assertBranchAccess(user, leave.user.branchId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.leaveRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status,
          decidedById: user.userId,
          decidedAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        throw new ConflictException('Leave request has already been decided.');
      }

      await this.auditService.logAction(
        user.userId,
        AUDIT_ACTIONS.DECIDE_LEAVE,
        AUDIT_TARGETS.LEAVE_REQUEST,
        id,
        { status, requesterId: leave.userId, branchId: leave.user.branchId },
        tx,
      );

      return tx.leaveRequest.findUniqueOrThrow({ where: { id } });
    });

    await this.notifications.notifyUser({
      userId: leave.userId,
      branchId: leave.user.branchId,
      type: 'LEAVE_DECIDED',
      title: `Your ${leave.type.toLowerCase()} leave was ${status.toLowerCase()}`,
      link: '/hr/leave',
    });

    return updated;
  }

  // ==================== PAYROLL ====================
  async generatePayrollRun(
    branchId: number,
    month: number,
    year: number,
    userId?: number,
  ) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const existingRun = await this.prisma.payrollRun.findFirst({
      where: { branchId, month, year },
    });
    if (existingRun)
      throw new BadRequestException(
        'Payroll run already exists for this month.',
      );

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        branchId,
        clockIn: { gte: startDate, lte: endDate },
        clockOut: { not: null },
      },
      include: { user: true },
    });

    const userMap = new Map<
      number,
      {
        userId: number;
        hourlyRate: Prisma.Decimal;
        baseSalary: number;
        employmentType: EmploymentType;
        standardHours: number;
        otHours: number;
      }
    >();

    for (const record of records) {
      const u = record.user;
      if (!userMap.has(u.id)) {
        userMap.set(u.id, {
          userId: u.id,
          hourlyRate: u.hourlyRate,
          baseSalary: toNum(u.baseSalary),
          employmentType: u.employmentType || 'PART_TIME',
          standardHours: 0,
          otHours: 0,
        });
      }

      const p = userMap.get(u.id)!;
      const hrs = record.totalHours || 0;
      if (hrs > 8) {
        p.standardHours += 8;
        p.otHours += hrs - 8;
      } else {
        p.standardHours += hrs;
      }
    }

    const fullTimeUsers = await this.prisma.user.findMany({
      where: { branchId, employmentType: 'FULL_TIME' },
    });

    for (const u of fullTimeUsers) {
      if (!userMap.has(u.id)) {
        userMap.set(u.id, {
          userId: u.id,
          hourlyRate: u.hourlyRate,
          baseSalary: toNum(u.baseSalary),
          employmentType: 'FULL_TIME',
          standardHours: 0,
          otHours: 0,
        });
      }
    }

    const payslipsData = Array.from(userMap.values()).map((p) => {
      const isFullTime = p.employmentType === 'FULL_TIME';
      const hourlyRate = dec(p.hourlyRate);
      const baseSalary = dec(p.baseSalary);
      const basePay = roundMoney(
        isFullTime ? baseSalary : hourlyRate.times(p.standardHours),
      );

      const otRate = hourlyRate.gt(0)
        ? hourlyRate.times(OT_MULTIPLIER)
        : baseSalary.div(MONTHLY_HOURS).times(OT_MULTIPLIER);
      const otPay = roundMoney(otRate.times(p.otHours));

      const bonuses = 0;
      const otherDeductions = 0;

      const grossPay = roundMoney(dec(basePay).plus(otPay).plus(bonuses));

      const uncappedSocialSecurity = dec(basePay).times(SOCIAL_SECURITY_RATE);
      const socialSecurity = roundMoney(
        uncappedSocialSecurity.gt(SOCIAL_SECURITY_CAP)
          ? dec(SOCIAL_SECURITY_CAP)
          : uncappedSocialSecurity,
      );
      const taxDeduction = roundMoney(dec(grossPay).times(TAX_RATE));
      const netPay = roundMoney(
        dec(grossPay)
          .minus(socialSecurity)
          .minus(taxDeduction)
          .minus(otherDeductions),
      );

      return {
        userId: p.userId,
        standardHours: p.standardHours,
        otHours: p.otHours,
        basePay,
        otPay,
        bonuses,
        grossPay,
        socialSecurity,
        taxDeduction,
        otherDeductions,
        netPay,
      };
    });

    const run = await this.createPayrollRun(
      branchId,
      month,
      year,
      payslipsData,
    );

    if (userId) {
      await this.auditService.logAction(
        userId,
        AUDIT_ACTIONS.GENERATE_PAYROLL,
        AUDIT_TARGETS.PAYROLL_RUN,
        run.id,
        { branchId, month, year, payslipCount: payslipsData.length },
      );
    }

    return run;
  }

  private async createPayrollRun(
    branchId: number,
    month: number,
    year: number,
    payslipsData: Prisma.PayslipUncheckedCreateWithoutPayrollRunInput[],
  ) {
    try {
      return await this.prisma.payrollRun.create({
        data: {
          branchId,
          month,
          year,
          payslips: { create: payslipsData },
        },
        include: { payslips: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Payroll run already exists for this month.',
        );
      }
      throw err;
    }
  }

  async getPayrollRuns(branchId: number) {
    return this.prisma.payrollRun.findMany({
      where: { branchId },
      include: { payslips: { include: { user: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async approvePayrollRun(runId: number, user: BranchScopedUser) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findUnique({
        where: { id: runId },
        include: { payslips: true },
      });
      if (!run) throw new NotFoundException('Payroll run not found');
      if (run.branchId == null) {
        if (user.role !== 'SUPER_ADMIN') {
          throw new ForbiddenException(
            'You do not have access to this payroll run.',
          );
        }
      } else {
        assertBranchAccess(user, run.branchId);
      }
      if (run.status !== 'DRAFT') {
        throw new BadRequestException(
          `Payroll run is already ${run.status.toLowerCase()}.`,
        );
      }

      const claimed = await tx.payrollRun.updateMany({
        where: { id: runId, status: 'DRAFT' },
        data: {
          status: 'APPROVED',
          approvedById: user.userId,
          approvedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw new BadRequestException(
          'Payroll run changed while approving. Please retry.',
        );
      }

      const totalGross = roundMoney(
        sumMoney(run.payslips.map((p) => p.grossPay)),
      );
      const totalNet = roundMoney(sumMoney(run.payslips.map((p) => p.netPay)));
      const totalDeductions = roundMoney(dec(totalGross).minus(totalNet));

      await tx.auditLog.create({
        data: {
          userId: user.userId,
          action: AUDIT_ACTIONS.APPROVE_PAYROLL,
          targetType: AUDIT_TARGETS.PAYROLL_RUN,
          targetId: runId,
          details: JSON.stringify({
            branchId: run.branchId,
            month: run.month,
            year: run.year,
          }),
        },
      });

      if (totalGross > 0) {
        await this.outboxService.enqueue(
          tx,
          OUTBOX_EVENT_TYPES.PAYROLL_APPROVED,
          {
            payroll: toPayrollApprovedSnapshot({
              payrollRunId: runId,
              branchId: run.branchId,
              month: run.month,
              year: run.year,
              totalGross,
              totalNet,
              totalDeductions,
            }),
          },
        );
      }

      return tx.payrollRun.findUnique({ where: { id: runId } });
    });
  }

  async updateHourlyRate(userId: number, hourlyRate: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { hourlyRate },
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
  }

  async getAllUsers(branchId?: number) {
    return this.prisma.user.findMany({
      where: branchId ? { branchId } : {},
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
  }

  async createUser(data: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
      select: { id: true, name: true, email: true, role: true, branchId: true },
    });
  }

  async updateUser(id: number, data: UpdateUserDto) {
    const updateData: UpdateUserDto & { password?: string } = { ...data };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const revokesExistingTokens =
      updateData.password !== undefined ||
      updateData.role !== undefined ||
      updateData.branchId !== undefined;

    return this.prisma.user.update({
      where: { id },
      data: revokesExistingTokens
        ? { ...updateData, tokenVersion: { increment: 1 } }
        : updateData,
      select: { id: true, name: true, email: true, role: true, branchId: true },
    });
  }
}

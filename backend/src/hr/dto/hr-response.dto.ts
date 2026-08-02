import { ApiProperty } from '@nestjs/swagger';
import {
  EmploymentType,
  LeaveStatus,
  LeaveType,
  PayrollStatus,
  Role,
  ShiftStatus,
} from '@prisma/client';
import { BranchResponseDto } from '../../branches/dto/branch-response.dto';

export class HrBranchSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Downtown' })
  name: string;
}

export class HrUserSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ type: String, example: 'Jane Staff', nullable: true })
  name: string | null;

  @ApiProperty({ example: 'staff@branchbrew.dev' })
  email: string;

  @ApiProperty({ enum: Role, example: Role.STAFF })
  role: Role;

  @ApiProperty({ type: Number, example: 1, nullable: true })
  branchId: number | null;

  @ApiProperty({ enum: EmploymentType, required: false })
  employmentType?: EmploymentType;

  @ApiProperty({ example: 85, required: false })
  hourlyRate?: number;

  @ApiProperty({ example: 25000, required: false })
  baseSalary?: number;
}

export class HrUserResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ type: String, example: 'Jane Staff', nullable: true })
  name: string | null;

  @ApiProperty({ example: 'staff@branchbrew.dev' })
  email: string;

  @ApiProperty({ enum: Role, example: Role.STAFF })
  role: Role;

  @ApiProperty({ type: Number, example: 1, nullable: true })
  branchId: number | null;

  @ApiProperty({ enum: EmploymentType, required: false })
  employmentType?: EmploymentType;

  @ApiProperty({ example: 85, required: false })
  hourlyRate?: number;

  @ApiProperty({ example: 25000, required: false })
  baseSalary?: number;
}

export class LeaveRequestUserSummaryDto {
  @ApiProperty({ type: String, example: 'Jane Staff', nullable: true })
  name: string | null;

  @ApiProperty({ example: 'staff@branchbrew.dev' })
  email: string;

  @ApiProperty({ type: Number, example: 1, nullable: true })
  branchId: number | null;
}

export class AttendanceRecordResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 4 })
  userId: number;

  @ApiProperty({ example: 1 })
  branchId: number;

  @ApiProperty({ type: String, format: 'date-time' })
  clockIn: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  clockOut: Date | null;

  @ApiProperty({ type: Number, example: 7.5, nullable: true })
  totalHours: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ type: HrBranchSummaryDto, required: false })
  branch?: HrBranchSummaryDto;
}

export class ShiftResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 4 })
  userId: number;

  @ApiProperty({ example: 1 })
  branchId: number;

  @ApiProperty({ type: String, format: 'date-time' })
  startTime: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  endTime: Date;

  @ApiProperty({ enum: ShiftStatus, example: ShiftStatus.SCHEDULED })
  status: ShiftStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ type: HrUserSummaryDto, required: false })
  user?: HrUserSummaryDto;

  @ApiProperty({ type: BranchResponseDto, required: false })
  branch?: BranchResponseDto;
}

export class LeaveRequestResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 4 })
  userId: number;

  @ApiProperty({ enum: LeaveType, example: LeaveType.ANNUAL })
  type: LeaveType;

  @ApiProperty({ type: String, format: 'date' })
  startDate: Date;

  @ApiProperty({ type: String, format: 'date' })
  endDate: Date;

  @ApiProperty({ type: String, example: 'Family trip', nullable: true })
  reason: string | null;

  @ApiProperty({ enum: LeaveStatus, example: LeaveStatus.PENDING })
  status: LeaveStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ type: LeaveRequestUserSummaryDto, required: false })
  user?: LeaveRequestUserSummaryDto;
}

export class PayslipResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 10 })
  payrollRunId: number;

  @ApiProperty({ example: 4 })
  userId: number;

  @ApiProperty({ example: 160 })
  standardHours: number;

  @ApiProperty({ example: 8 })
  otHours: number;

  @ApiProperty({ example: 13600 })
  basePay: number;

  @ApiProperty({ example: 1020 })
  otPay: number;

  @ApiProperty({ example: 0 })
  bonuses: number;

  @ApiProperty({ example: 14620 })
  grossPay: number;

  @ApiProperty({ example: 438.6 })
  taxDeduction: number;

  @ApiProperty({ example: 680 })
  socialSecurity: number;

  @ApiProperty({ example: 0 })
  otherDeductions: number;

  @ApiProperty({ example: 13501.4 })
  netPay: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ type: HrUserSummaryDto, required: false })
  user?: HrUserSummaryDto;
}

export class PayrollRunResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 6 })
  month: number;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ enum: PayrollStatus, example: PayrollStatus.DRAFT })
  status: PayrollStatus;

  @ApiProperty({ type: Number, example: 1, nullable: true })
  branchId: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ type: PayslipResponseDto, isArray: true, required: false })
  payslips?: PayslipResponseDto[];

  @ApiProperty({ type: BranchResponseDto, required: false })
  branch?: BranchResponseDto;
}

export class BulkLeaveFailureDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 'Leave request has already been decided.' })
  reason: string;
}

export class BulkLeaveResultDto {
  @ApiProperty({ example: 20, description: 'Distinct ids submitted' })
  requested: number;

  @ApiProperty({ type: [Number], example: [11, 12, 13] })
  succeeded: number[];

  @ApiProperty({ type: [BulkLeaveFailureDto] })
  failed: BulkLeaveFailureDto[];
}

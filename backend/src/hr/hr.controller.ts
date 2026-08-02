import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { HrService } from './hr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  assertBranchAccess,
  resolveBranchId,
  resolveOptionalBranchId,
} from '../auth/branch-scope.util';
import { ClockInDto } from './dto/clock-in.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { RequestLeaveDto } from './dto/request-leave.dto';
import { ProcessLeaveDto } from './dto/process-leave.dto';
import { BulkProcessLeaveDto } from './dto/bulk-process-leave.dto';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { UpdateHourlyRateDto } from './dto/update-hourly-rate.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { parseOptionalPositiveInt } from '../common/query-params.util';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrorResponses } from '../common/http/swagger-error.decorators';
import {
  AttendanceRecordResponseDto,
  HrUserResponseDto,
  BulkLeaveResultDto,
  LeaveRequestResponseDto,
  PayrollRunResponseDto,
  ShiftResponseDto,
} from './dto/hr-response.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('hr')
@ApiCommonErrorResponses()
@Controller('hr')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Post('clock-in')
  @ApiOperation({ summary: 'Clock in' })
  @ApiOkResponse({
    type: AttendanceRecordResponseDto,
    description: 'Clock-in recorded',
  })
  clockIn(@Request() req: RequestWithUser, @Body() dto: ClockInDto) {
    assertBranchAccess(req.user, dto.branchId);
    return this.hrService.clockIn(req.user.userId, dto.branchId);
  }

  @Post('clock-out')
  @ApiOperation({ summary: 'Clock out' })
  @ApiOkResponse({
    type: AttendanceRecordResponseDto,
    description: 'Clock-out recorded',
  })
  clockOut(@Request() req: RequestWithUser) {
    return this.hrService.clockOut(req.user.userId);
  }

  @Get('attendance/me')
  @ApiOperation({ summary: 'Get my attendance records' })
  @ApiOkResponse({
    type: AttendanceRecordResponseDto,
    isArray: true,
    description: 'Attendance records retrieved',
  })
  getMyAttendance(@Request() req: RequestWithUser) {
    return this.hrService.getMyAttendance(req.user.userId);
  }

  @Get('attendance/status')
  @ApiOperation({ summary: 'Get active clock-in status' })
  @ApiOkResponse({
    type: AttendanceRecordResponseDto,
    description: 'Clock-in status retrieved',
  })
  getActiveClockIn(@Request() req: RequestWithUser) {
    return this.hrService.getActiveClockIn(req.user.userId);
  }

  @Roles('SUPER_ADMIN', 'MANAGER')
  @Post('shifts')
  @ApiOperation({ summary: 'Create shift' })
  @ApiOkResponse({ type: ShiftResponseDto, description: 'Shift created' })
  createShift(@Request() req: RequestWithUser, @Body() dto: CreateShiftDto) {
    const branchId = resolveBranchId(req.user, dto.branchId);
    return this.hrService.createShift({ ...dto, branchId });
  }

  @Get('shifts/branch/:branchId')
  @ApiOperation({ summary: 'Get shifts by branch' })
  @ApiOkResponse({
    type: ShiftResponseDto,
    isArray: true,
    description: 'Branch shifts retrieved',
  })
  getShiftsByBranch(
    @Request() req: RequestWithUser,
    @Param('branchId', ParseIntPipe) branchId: number,
  ) {
    assertBranchAccess(req.user, branchId);
    return this.hrService.getShiftsByBranch(branchId);
  }

  @Get('shifts/me')
  @ApiOperation({ summary: 'Get my shifts' })
  @ApiOkResponse({
    type: ShiftResponseDto,
    isArray: true,
    description: 'My shifts retrieved',
  })
  getMyShifts(@Request() req: RequestWithUser) {
    return this.hrService.getMyShifts(req.user.userId);
  }

  @Post('leave')
  @ApiOperation({ summary: 'Request leave' })
  @ApiOkResponse({
    type: LeaveRequestResponseDto,
    description: 'Leave request submitted',
  })
  requestLeave(@Request() req: RequestWithUser, @Body() dto: RequestLeaveDto) {
    return this.hrService.requestLeave(req.user.userId, dto);
  }

  @Roles('SUPER_ADMIN', 'MANAGER')
  @Get('leave')
  @ApiOperation({ summary: 'List leave requests' })
  @ApiOkResponse({
    type: LeaveRequestResponseDto,
    isArray: true,
    description: 'Leave requests retrieved',
  })
  getLeaveRequests(
    @Request() req: RequestWithUser,
    @Query('branchId') branchId?: string,
  ) {
    const resolvedBranchId = resolveOptionalBranchId(
      req.user,
      parseOptionalPositiveInt(branchId, 'branchId'),
    );
    return this.hrService.getLeaveRequests(resolvedBranchId);
  }

  @Get('leave/me')
  @ApiOperation({ summary: 'Get my leave requests' })
  @ApiOkResponse({
    type: LeaveRequestResponseDto,
    isArray: true,
    description: 'My leave requests retrieved',
  })
  getMyLeaveRequests(@Request() req: RequestWithUser) {
    return this.hrService.getMyLeaveRequests(req.user.userId);
  }

  @Roles('SUPER_ADMIN', 'MANAGER')
  @Patch('leave/bulk-status')
  @ApiOperation({
    summary: 'Decide several leave requests at once',
    description:
      'Each request is decided independently: one failure does not undo the rest. The response reports which ids succeeded and why the others did not.',
  })
  @ApiOkResponse({
    type: BulkLeaveResultDto,
    description: 'Bulk decision applied',
  })
  processLeaveRequestsBulk(
    @Request() req: RequestWithUser,
    @Body() dto: BulkProcessLeaveDto,
  ) {
    return this.hrService.processLeaveRequestsBulk(
      dto.ids,
      dto.status,
      req.user,
    );
  }

  @Roles('SUPER_ADMIN', 'MANAGER')
  @Patch('leave/:id/status')
  @ApiOperation({ summary: 'Process leave request' })
  @ApiOkResponse({
    type: LeaveRequestResponseDto,
    description: 'Leave request updated',
  })
  processLeaveRequest(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessLeaveDto,
  ) {
    return this.hrService.processLeaveRequest(id, dto.status, req.user);
  }

  @Roles('SUPER_ADMIN', 'MANAGER')
  @Post('payroll/generate')
  @ApiOperation({ summary: 'Generate payroll run' })
  @ApiOkResponse({
    type: PayrollRunResponseDto,
    description: 'Payroll run generated',
  })
  generatePayrollRun(
    @Request() req: RequestWithUser,
    @Body() dto: GeneratePayrollDto,
  ) {
    assertBranchAccess(req.user, dto.branchId);
    return this.hrService.generatePayrollRun(
      dto.branchId,
      dto.month,
      dto.year,
      req.user.userId,
    );
  }

  @Roles('SUPER_ADMIN', 'MANAGER')
  @Get('payroll-runs')
  @ApiOperation({ summary: 'List payroll runs' })
  @ApiOkResponse({
    type: PayrollRunResponseDto,
    isArray: true,
    description: 'Payroll runs retrieved',
  })
  getPayrollRuns(
    @Request() req: RequestWithUser,
    @Query('branchId', ParseIntPipe) branchId: number,
  ) {
    assertBranchAccess(req.user, branchId);
    return this.hrService.getPayrollRuns(branchId);
  }

  @Roles('SUPER_ADMIN', 'MANAGER')
  @Patch('payroll-runs/:id/approve')
  @ApiOperation({ summary: 'Approve payroll run' })
  @ApiOkResponse({
    type: PayrollRunResponseDto,
    description: 'Payroll run approved',
  })
  approvePayrollRun(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.hrService.approvePayrollRun(id, req.user);
  }

  @Roles('SUPER_ADMIN')
  @Patch('users/:userId/rate')
  @ApiOperation({ summary: 'Update user hourly rate' })
  @ApiOkResponse({
    type: HrUserResponseDto,
    description: 'Hourly rate updated',
  })
  updateHourlyRate(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateHourlyRateDto,
  ) {
    return this.hrService.updateHourlyRate(userId, dto.hourlyRate);
  }

  @Roles('SUPER_ADMIN', 'MANAGER')
  @Get('users')
  @ApiOperation({ summary: 'List users' })
  @ApiOkResponse({
    type: HrUserResponseDto,
    isArray: true,
    description: 'Users retrieved',
  })
  getAllUsers(
    @Request() req: RequestWithUser,
    @Query('branchId') branchId?: string,
  ) {
    const resolvedBranchId = resolveOptionalBranchId(
      req.user,
      parseOptionalPositiveInt(branchId, 'branchId'),
    );
    return this.hrService.getAllUsers(resolvedBranchId);
  }

  @Roles('SUPER_ADMIN')
  @Post('users')
  @ApiOperation({ summary: 'Create user' })
  @ApiOkResponse({ type: HrUserResponseDto, description: 'User created' })
  createUser(@Body() dto: CreateUserDto) {
    return this.hrService.createUser(dto);
  }

  @Roles('SUPER_ADMIN')
  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user' })
  @ApiOkResponse({ type: HrUserResponseDto, description: 'User updated' })
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.hrService.updateUser(id, dto);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { resolveOptionalBranchId } from '../auth/branch-scope.util';
import {
  parseOptionalDateString,
  parseOptionalPositiveInt,
} from '../common/query-params.util';
import {
  AccountResponseDto,
  JournalEntryResponseDto,
  ProfitLossMonthResponseDto,
  SeedAccountsResponseDto,
  TrialBalanceResponseDto,
  VatReportMonthResponseDto,
} from './dto/accounting-response.dto';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiCommonErrorResponses } from '../common/http/swagger-error.decorators';

@ApiTags('accounting')
@ApiCommonErrorResponses()
@Controller('accounting')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('accounts')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'List chart of accounts' })
  @ApiOkResponse({
    type: AccountResponseDto,
    isArray: true,
    description: 'Accounts retrieved',
  })
  async getAccounts() {
    return this.accountingService.getChartOfAccounts();
  }

  @Get('journal-entries')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'List journal entries' })
  @ApiOkResponse({
    type: JournalEntryResponseDto,
    isArray: true,
    description: 'Journal entries retrieved',
  })
  async getJournalEntries(
    @Request() req: RequestWithUser,
    @Query('branchId') branchId?: string,
  ) {
    const resolvedBranchId = resolveOptionalBranchId(
      req.user,
      parseOptionalPositiveInt(branchId, 'branchId'),
    );
    return this.accountingService.getJournalEntries(resolvedBranchId);
  }

  @Get('vat-report')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Monthly output-VAT summary (ภ.พ.30-style)' })
  @ApiOkResponse({
    type: VatReportMonthResponseDto,
    isArray: true,
    description: 'VAT report retrieved',
  })
  async getVatReport(
    @Request() req: RequestWithUser,
    @Query('branchId') branchId?: string,
  ) {
    const resolvedBranchId = resolveOptionalBranchId(
      req.user,
      parseOptionalPositiveInt(branchId, 'branchId'),
    );
    return this.accountingService.getVatReport(resolvedBranchId);
  }

  @Get('profit-loss')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get accounting profit and loss' })
  @ApiOkResponse({
    type: ProfitLossMonthResponseDto,
    isArray: true,
    description: 'Profit and loss retrieved',
  })
  async getProfitLoss(
    @Request() req: RequestWithUser,
    @Query('branchId') branchId?: string,
  ) {
    const resolvedBranchId = resolveOptionalBranchId(
      req.user,
      parseOptionalPositiveInt(branchId, 'branchId'),
    );
    return this.accountingService.getProfitLoss(resolvedBranchId);
  }

  @Get('trial-balance')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({
    summary:
      'Trial balance — every account balance and the debit/credit totals',
  })
  @ApiQuery({ name: 'branchId', required: false, type: Number })
  @ApiQuery({
    name: 'asOf',
    required: false,
    type: String,
    example: '2026-07-25',
    description: 'Inclusive cut-off date in YYYY-MM-DD form',
  })
  @ApiOkResponse({
    type: TrialBalanceResponseDto,
    description: 'Trial balance retrieved',
  })
  async getTrialBalance(
    @Request() req: RequestWithUser,
    @Query('branchId') branchId?: string,
    @Query('asOf') asOf?: string,
  ) {
    const resolvedBranchId = resolveOptionalBranchId(
      req.user,
      parseOptionalPositiveInt(branchId, 'branchId'),
    );
    return this.accountingService.getTrialBalance(
      resolvedBranchId,
      parseOptionalDateString(asOf, 'asOf'),
    );
  }

  @Post('seed')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Seed default chart of accounts' })
  @ApiOkResponse({
    type: SeedAccountsResponseDto,
    description: 'Accounts seeded',
  })
  async seedAccounts() {
    await this.accountingService.seedAccounts();
    return { success: true, message: 'Accounts seeded successfully' };
  }
}

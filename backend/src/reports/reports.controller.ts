import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { resolveOptionalBranchId } from '../auth/branch-scope.util';
import { parseOptionalPositiveInt } from '../common/query-params.util';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrorResponses } from '../common/http/swagger-error.decorators';
import {
  ExecutiveSummaryResponseDto,
  FoodCostActualResponseDto,
  ReportsProfitLossResponseDto,
  SalesTrendPointResponseDto,
  TopProductReportResponseDto,
} from './dto/reports-response.dto';

@ApiTags('reports')
@ApiCommonErrorResponses()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'MANAGER')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-trends')
  @ApiOperation({ summary: 'Get sales trends report' })
  @ApiOkResponse({
    type: SalesTrendPointResponseDto,
    isArray: true,
    description: 'Sales trends retrieved',
  })
  getSalesTrends(
    @Request() req: RequestWithUser,
    @Query('branchId') branchIdQuery?: string,
    @Query('days') daysQuery?: string,
  ) {
    const branchId = resolveOptionalBranchId(
      req.user,
      parseOptionalPositiveInt(branchIdQuery, 'branchId'),
    );
    const days = parseOptionalPositiveInt(daysQuery, 'days');
    return this.reportsService.getSalesTrends(branchId, days);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Get top products report' })
  @ApiOkResponse({
    type: TopProductReportResponseDto,
    isArray: true,
    description: 'Top products retrieved',
  })
  getTopProducts(
    @Request() req: RequestWithUser,
    @Query('branchId') branchIdQuery?: string,
  ) {
    const branchId = resolveOptionalBranchId(
      req.user,
      parseOptionalPositiveInt(branchIdQuery, 'branchId'),
    );
    return this.reportsService.getTopProducts(branchId);
  }

  @Get('profit-loss')
  @ApiOperation({ summary: 'Get profit and loss report' })
  @ApiOkResponse({
    type: ReportsProfitLossResponseDto,
    description: 'Profit and loss retrieved',
  })
  getProfitLoss(
    @Request() req: RequestWithUser,
    @Query('branchId') branchIdQuery?: string,
  ) {
    const branchId = resolveOptionalBranchId(
      req.user,
      parseOptionalPositiveInt(branchIdQuery, 'branchId'),
    );
    return this.reportsService.getProfitLoss(branchId);
  }

  @Get('food-cost-actual')
  @ApiOperation({
    summary: 'Actual food cost and gross margin across recorded orders',
  })
  @ApiOkResponse({
    type: FoodCostActualResponseDto,
    description: 'Actual food cost retrieved',
  })
  getFoodCostActual(
    @Request() req: RequestWithUser,
    @Query('branchId') branchIdQuery?: string,
  ) {
    const branchId = resolveOptionalBranchId(
      req.user,
      parseOptionalPositiveInt(branchIdQuery, 'branchId'),
    );
    return this.reportsService.getFoodCostActual(branchId);
  }

  @Get('executive-summary')
  @ApiOperation({ summary: 'Get executive summary report' })
  @ApiOkResponse({
    type: ExecutiveSummaryResponseDto,
    description: 'Executive summary retrieved',
  })
  getExecutiveSummary(
    @Request() req: RequestWithUser,
    @Query('branchId') branchIdQuery?: string,
  ) {
    const branchId = resolveOptionalBranchId(
      req.user,
      parseOptionalPositiveInt(branchIdQuery, 'branchId'),
    );
    return this.reportsService.getExecutiveSummary(branchId);
  }
}

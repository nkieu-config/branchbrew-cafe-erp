import { ApiProperty } from '@nestjs/swagger';
import { BatchStatus } from '@prisma/client';

export class SalesTrendPointResponseDto {
  @ApiProperty({ example: '2026-07-01' })
  date: string;

  @ApiProperty({ example: 24500 })
  total: number;

  @ApiProperty({ example: 128 })
  orders: number;
}

export class TopProductReportResponseDto {
  @ApiProperty({ example: 3 })
  productId: number;

  @ApiProperty({ example: 'Latte' })
  name: string;

  @ApiProperty({ example: 86 })
  totalQuantity: number;

  @ApiProperty({ example: 5160 })
  totalRevenue: number;
}

export class ReportsProfitLossResponseDto {
  @ApiProperty({ example: 185000 })
  revenue: number;

  @ApiProperty({ example: 52000 })
  cogs: number;

  @ApiProperty({ example: 133000 })
  grossProfit: number;

  @ApiProperty({ example: 18000 })
  expenses: number;

  @ApiProperty({ example: 45000 })
  payroll: number;

  @ApiProperty({ example: 70000 })
  netProfit: number;
}

export class ExecutiveSummaryTopBranchDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Downtown' })
  name: string;

  @ApiProperty({ example: 32500 })
  totalSales: number;
}

export class ExecutiveSummaryLowStockAlertDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 'Whole milk' })
  ingredientName: string;

  @ApiProperty({ example: 'Downtown' })
  branchName: string;

  @ApiProperty({ example: 4 })
  stock: number;

  @ApiProperty({ example: 10 })
  minStock: number;
}

export class ExecutiveSummaryExpiryAlertDto {
  @ApiProperty({ example: 44 })
  id: number;

  @ApiProperty({ example: 'Fresh cream' })
  ingredientName: string;

  @ApiProperty({ example: 'Downtown' })
  branchName: string;

  @ApiProperty({ example: 6 })
  quantity: number;

  @ApiProperty({ type: String, format: 'date-time' })
  expiryDate: string;

  @ApiProperty({ enum: BatchStatus, example: BatchStatus.ACTIVE })
  status: BatchStatus;
}

export class ExecutiveSummaryResponseDto {
  @ApiProperty({ example: 24500 })
  salesToday: number;

  @ApiProperty({ example: 21800 })
  salesYesterday: number;

  @ApiProperty({ example: 12.4 })
  salesGrowth: number;

  @ApiProperty({ example: 128 })
  ordersToday: number;

  @ApiProperty({ example: 115 })
  ordersYesterday: number;

  @ApiProperty({ example: 11.3 })
  ordersGrowth: number;

  @ApiProperty({ example: 191.4 })
  avgTicketToday: number;

  @ApiProperty({ example: 189.6 })
  avgTicketYesterday: number;

  @ApiProperty({ type: ExecutiveSummaryTopBranchDto, nullable: true })
  topBranch: ExecutiveSummaryTopBranchDto | null;

  @ApiProperty({ type: ExecutiveSummaryLowStockAlertDto, isArray: true })
  lowStockAlerts: ExecutiveSummaryLowStockAlertDto[];

  @ApiProperty({ example: 8 })
  lowStockCount: number;

  @ApiProperty({ type: ExecutiveSummaryExpiryAlertDto, isArray: true })
  expiryAlerts: ExecutiveSummaryExpiryAlertDto[];

  @ApiProperty({ example: 3 })
  expiryCount: number;
}

export class FoodCostActualResponseDto {
  @ApiProperty({ example: 412 })
  orderCount: number;

  @ApiProperty({ example: 198500 })
  totalRevenue: number;

  @ApiProperty({ example: 61535 })
  totalCogs: number;

  @ApiProperty({ example: 136965 })
  grossProfit: number;

  @ApiProperty({ example: 31 })
  actualFoodCostPercent: number;

  @ApiProperty({ example: 69 })
  grossMarginPercent: number;
}

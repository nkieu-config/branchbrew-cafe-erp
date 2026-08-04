import { ApiProperty } from '@nestjs/swagger';
import { AccountType, JournalStatus } from '@prisma/client';

export class AccountResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: '1010' })
  code: string;

  @ApiProperty({ example: 'Cash' })
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.ASSET })
  type: AccountType;

  @ApiProperty({
    type: String,
    example: 'Petty cash and register float',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class JournalLineResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 10 })
  journalEntryId: number;

  @ApiProperty({ example: 3 })
  accountId: number;

  @ApiProperty({ example: 1200 })
  debit: number;

  @ApiProperty({ example: 0 })
  credit: number;

  @ApiProperty({ type: String, example: 'Cash payment', nullable: true })
  description: string | null;

  @ApiProperty({ type: AccountResponseDto, required: false })
  account?: AccountResponseDto;
}

export class JournalEntryResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ type: Number, example: 1, nullable: true })
  branchId: number | null;

  @ApiProperty({ type: String, format: 'date' })
  date: Date;

  @ApiProperty({ type: String, example: 'ORD-100', nullable: true })
  reference: string | null;

  @ApiProperty({ example: 'Sales revenue for order 100' })
  description: string;

  @ApiProperty({ enum: JournalStatus, example: JournalStatus.POSTED })
  status: JournalStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ type: JournalLineResponseDto, isArray: true, required: false })
  lines?: JournalLineResponseDto[];
}

export class ProfitLossMonthResponseDto {
  @ApiProperty({ example: '2026-06' })
  month: string;

  @ApiProperty({ example: 185000 })
  revenue: number;

  @ApiProperty({ example: 92000 })
  expense: number;
}

export class VatReportMonthResponseDto {
  @ApiProperty({ example: '2026-06' })
  month: string;

  @ApiProperty({ example: 198500 })
  grossSales: number;

  @ApiProperty({ example: 185514.02 })
  salesExVat: number;

  @ApiProperty({ example: 12985.98 })
  outputVat: number;

  @ApiProperty({ example: 412 })
  orderCount: number;
}

export class TrialBalanceAccountResponseDto {
  @ApiProperty({ example: 3 })
  accountId: number;

  @ApiProperty({ example: '1030' })
  code: string;

  @ApiProperty({ example: 'Inventory' })
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.ASSET })
  type: AccountType;

  @ApiProperty({
    enum: ['DEBIT', 'CREDIT'],
    example: 'DEBIT',
    description: 'Side the account balance normally sits on',
  })
  normalBalance: 'DEBIT' | 'CREDIT';

  @ApiProperty({ example: 48250.75, description: 'Sum of all debit lines' })
  debit: number;

  @ApiProperty({ example: 12100.5, description: 'Sum of all credit lines' })
  credit: number;

  @ApiProperty({
    example: 36150.25,
    description: "Net balance on the account's normal side",
  })
  balance: number;
}

export class TrialBalanceResponseDto {
  @ApiProperty({
    enum: ['CHAIN', 'BRANCH'],
    example: 'CHAIN',
    description: 'BRANCH excludes chain-level entries, so it is a partial view',
  })
  scope: 'CHAIN' | 'BRANCH';

  @ApiProperty({ type: Number, example: 1, nullable: true })
  branchId: number | null;

  @ApiProperty({
    type: String,
    example: '2026-07-25',
    nullable: true,
    description: 'Inclusive cut-off date; null means every posted entry',
  })
  asOf: string | null;

  @ApiProperty({ type: TrialBalanceAccountResponseDto, isArray: true })
  accounts: TrialBalanceAccountResponseDto[];

  @ApiProperty({ example: 412500.25 })
  totalDebit: number;

  @ApiProperty({ example: 412500.25 })
  totalCredit: number;

  @ApiProperty({
    example: true,
    description: 'True when total debits equal total credits',
  })
  isBalanced: boolean;
}

export class BalanceSheetLineResponseDto {
  @ApiProperty({
    type: Number,
    example: 3,
    nullable: true,
    description: 'Null on a computed line that has no account behind it',
  })
  accountId: number | null;

  @ApiProperty({ type: String, example: '1030', nullable: true })
  code: string | null;

  @ApiProperty({ example: 'Inventory' })
  name: string;

  @ApiProperty({
    example: 36150.25,
    description: "Balance on the account's normal side",
  })
  amount: number;

  @ApiProperty({
    example: false,
    description:
      'True for retained earnings, which is derived from the revenue and expense accounts rather than posted',
  })
  isComputed: boolean;
}

export class BalanceSheetResponseDto {
  @ApiProperty({
    enum: ['CHAIN', 'BRANCH'],
    example: 'CHAIN',
    description: 'BRANCH excludes chain-level entries, so it is a partial view',
  })
  scope: 'CHAIN' | 'BRANCH';

  @ApiProperty({ type: Number, example: 1, nullable: true })
  branchId: number | null;

  @ApiProperty({
    type: String,
    example: '2026-07-25',
    nullable: true,
    description: 'Inclusive cut-off date; null means every posted entry',
  })
  asOf: string | null;

  @ApiProperty({ type: BalanceSheetLineResponseDto, isArray: true })
  assets: BalanceSheetLineResponseDto[];

  @ApiProperty({ type: BalanceSheetLineResponseDto, isArray: true })
  liabilities: BalanceSheetLineResponseDto[];

  @ApiProperty({
    type: BalanceSheetLineResponseDto,
    isArray: true,
    description: 'Posted equity accounts plus the computed retained earnings',
  })
  equity: BalanceSheetLineResponseDto[];

  @ApiProperty({
    example: 128400.5,
    description:
      'Revenue less expenses for every posted entry up to the cut-off. There is no period close, so this accumulates from go-live rather than resetting each year',
  })
  retainedEarnings: number;

  @ApiProperty({ example: 412500.25 })
  totalAssets: number;

  @ApiProperty({ example: 84100 })
  totalLiabilities: number;

  @ApiProperty({ example: 328400.25 })
  totalEquity: number;

  @ApiProperty({ example: 412500.25 })
  totalLiabilitiesAndEquity: number;

  @ApiProperty({
    example: true,
    description:
      'True when assets equal liabilities plus equity. It follows from the trial balance being balanced, so a false here means the ledger itself is broken',
  })
  isBalanced: boolean;
}

export class SeedAccountsResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Accounts seeded successfully' })
  message: string;
}

import type { components } from './generated/api';

export type Account = components['schemas']['AccountResponseDto'];

export type JournalLine = components['schemas']['JournalLineResponseDto'];

export type JournalEntry = components['schemas']['JournalEntryResponseDto'];

export type ProfitLossMonth =
  components['schemas']['ProfitLossMonthResponseDto'];

export type VatReportMonth =
  components['schemas']['VatReportMonthResponseDto'];

export type TrialBalanceAccount =
  components['schemas']['TrialBalanceAccountResponseDto'];

export type TrialBalance = components['schemas']['TrialBalanceResponseDto'];

export type AppNotification = components['schemas']['NotificationResponseDto'];

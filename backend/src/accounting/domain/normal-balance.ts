export const LEDGER_ACCOUNT_TYPES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
] as const;

export type LedgerAccountType = (typeof LEDGER_ACCOUNT_TYPES)[number];

export type NormalBalance = 'DEBIT' | 'CREDIT';

const DEBIT_NORMAL_TYPES: ReadonlySet<LedgerAccountType> =
  new Set<LedgerAccountType>(['ASSET', 'EXPENSE']);

export function normalBalanceOf(type: LedgerAccountType): NormalBalance {
  return DEBIT_NORMAL_TYPES.has(type) ? 'DEBIT' : 'CREDIT';
}

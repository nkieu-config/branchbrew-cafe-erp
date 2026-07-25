import { AccountType } from '@prisma/client';

export type NormalBalance = 'DEBIT' | 'CREDIT';

const DEBIT_NORMAL_TYPES: ReadonlySet<AccountType> = new Set<AccountType>([
  'ASSET',
  'EXPENSE',
]);

export function normalBalanceOf(type: AccountType): NormalBalance {
  return DEBIT_NORMAL_TYPES.has(type) ? 'DEBIT' : 'CREDIT';
}

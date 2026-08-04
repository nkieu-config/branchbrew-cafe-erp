import type { CsvColumn } from "@/lib/export/csv";
import type {
  BalanceSheetLine,
  JournalEntry,
  TrialBalanceAccount,
} from "@/types/accounting";

export type BalanceSheetCsvRow = BalanceSheetLine & { section: string };

export const BALANCE_SHEET_CSV_COLUMNS: readonly CsvColumn<BalanceSheetCsvRow>[] = [
  { header: "Section", value: (row) => row.section },
  { header: "Code", value: (row) => row.code ?? "" },
  { header: "Account", value: (row) => row.name },
  { header: "Amount", value: (row) => row.amount },
  { header: "Computed", value: (row) => (row.isComputed ? "yes" : "no") },
];

export const TRIAL_BALANCE_CSV_COLUMNS: readonly CsvColumn<TrialBalanceAccount>[] = [
  { header: "Code", value: (row) => row.code },
  { header: "Account", value: (row) => row.name },
  { header: "Type", value: (row) => row.type },
  { header: "Normal balance", value: (row) => row.normalBalance },
  { header: "Debit", value: (row) => row.debit },
  { header: "Credit", value: (row) => row.credit },
];

export const JOURNAL_ENTRY_CSV_COLUMNS: readonly CsvColumn<JournalEntry>[] = [
  { header: "Entry", value: (row) => row.id },
  { header: "Date", value: (row) => row.date },
  { header: "Reference", value: (row) => row.reference ?? "" },
  { header: "Description", value: (row) => row.description },
  { header: "Status", value: (row) => row.status },
  {
    header: "Debit",
    value: (row) => (row.lines ?? []).reduce((sum, line) => sum + (line.debit ?? 0), 0),
  },
  {
    header: "Credit",
    value: (row) => (row.lines ?? []).reduce((sum, line) => sum + (line.credit ?? 0), 0),
  },
];

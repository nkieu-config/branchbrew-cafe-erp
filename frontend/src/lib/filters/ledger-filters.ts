import type { JournalEntry } from "@/types/api";

export type JournalStatusFilter = "ALL" | "DRAFT" | "POSTED";

export type LedgerChartPoint = {
  month: string;
  revenue: number;
  expense: number;
};

export function journalStatusLabel(status: JournalEntry["status"] | string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "POSTED":
      return "Posted";
    default:
      return String(status).replace(/_/g, " ").toLowerCase();
  }
}

export const JOURNAL_PAGE_SIZE_DEFAULT = 25;

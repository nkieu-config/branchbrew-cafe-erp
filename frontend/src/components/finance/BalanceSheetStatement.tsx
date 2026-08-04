"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/money";
import {
  financeMutedMetaClassName,
  financeSectionLabelClassName,
  ledgerPanelClassName,
} from "@/lib/theme/finance";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import type { BalanceSheet, BalanceSheetLine } from "@/types/accounting";

type BalanceSheetStatementProps = {
  balanceSheet: BalanceSheet;
  isLoading: boolean;
};

function StatementLine({ line }: { line: BalanceSheetLine }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className={cn("shrink-0 font-mono text-xs tabular-nums", text.muted)}>
          {line.code ?? "—"}
        </span>
        <span className={cn("min-w-0 truncate", text.secondary)}>{line.name}</span>
        {line.isComputed ? (
          <span className={financeMutedMetaClassName("hidden shrink-0 sm:inline")}>
            computed
          </span>
        ) : null}
      </span>
      <span className={cn("shrink-0 tabular-nums", text.primary)}>
        {formatCurrency(line.amount)}
      </span>
    </div>
  );
}

function StatementSection({
  title,
  lines,
  total,
  totalLabel,
}: {
  title: string;
  lines: BalanceSheetLine[];
  total: number;
  totalLabel: string;
}) {
  return (
    <section className={ledgerPanelClassName("min-w-0 p-4 sm:p-6")}>
      <h2 className={financeSectionLabelClassName()}>{title}</h2>
      {lines.length === 0 ? (
        <p className={cn("py-1.5 text-sm", text.muted)}>Nothing posted yet.</p>
      ) : (
        lines.map((line) => (
          <StatementLine key={line.accountId ?? line.name} line={line} />
        ))
      )}
      <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-[var(--table-row-border)] pt-2">
        <span className={cn("font-medium", text.primary)}>{totalLabel}</span>
        <span className={cn("font-medium tabular-nums", text.primary)}>
          {formatCurrency(total)}
        </span>
      </div>
    </section>
  );
}

export function BalanceSheetStatement({
  balanceSheet,
  isLoading,
}: BalanceSheetStatementProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid gap-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4" data-testid="balance-sheet-statement">
      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
        <StatementSection
          title="Assets"
          lines={balanceSheet.assets}
          total={balanceSheet.totalAssets}
          totalLabel="Total assets"
        />
        <div className="grid min-w-0 gap-4">
          <StatementSection
            title="Liabilities"
            lines={balanceSheet.liabilities}
            total={balanceSheet.totalLiabilities}
            totalLabel="Total liabilities"
          />
          <StatementSection
            title="Equity"
            lines={balanceSheet.equity}
            total={balanceSheet.totalEquity}
            totalLabel="Total equity"
          />
        </div>
      </div>

      <div
        className={ledgerPanelClassName(
          "flex min-w-0 flex-col gap-2 p-4 sm:flex-row sm:items-baseline sm:justify-between sm:p-6",
        )}
      >
        <span className={cn("font-medium", text.primary)}>
          Total assets vs total liabilities and equity
        </span>
        <span className="flex items-baseline gap-3">
          <span className={cn("font-medium tabular-nums", text.primary)}>
            {formatCurrency(balanceSheet.totalAssets)}
          </span>
          <span className={text.muted}>vs</span>
          <span className={cn("font-medium tabular-nums", text.primary)}>
            {formatCurrency(balanceSheet.totalLiabilitiesAndEquity)}
          </span>
        </span>
      </div>
    </div>
  );
}

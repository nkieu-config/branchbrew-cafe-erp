"use client";

import { useMemo } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterDate } from "@/components/shared/list-filters";
import { BalanceSheetStatement } from "@/components/finance/BalanceSheetStatement";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import {
  BALANCE_SHEET_CSV_COLUMNS,
  type BalanceSheetCsvRow,
} from "@/lib/export/finance-columns";
import { useBalanceSheet } from "@/hooks/domains/useAccountingQueries";
import { useListUrlState } from "@/hooks/useListUrlState";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/money";
import { financeSectionPanelClassName } from "@/lib/theme/finance";
import { infoBannerClassName, infoBannerTextClassName } from "@/lib/theme/hub-banners";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import type { BalanceSheet } from "@/types/accounting";

const EMPTY_BALANCE_SHEET: BalanceSheet = {
  scope: "CHAIN",
  branchId: null,
  asOf: null,
  assets: [],
  liabilities: [],
  equity: [],
  retainedEarnings: 0,
  totalAssets: 0,
  totalLiabilities: 0,
  totalEquity: 0,
  totalLiabilitiesAndEquity: 0,
  isBalanced: true,
};

export default function BalanceSheetPageClient() {
  const { activeBranchId } = useAuth();
  const selectedBranch = activeBranchId ? String(activeBranchId) : "ALL";

  const { values, setValue, reset, isDefault } = useListUrlState({ asOf: "" });
  const { asOf } = values;

  const {
    data: balanceSheet = EMPTY_BALANCE_SHEET,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useBalanceSheet(selectedBranch, asOf || undefined);

  const csvRows = useMemo<BalanceSheetCsvRow[]>(
    () => [
      ...balanceSheet.assets.map((line) => ({ ...line, section: "Assets" })),
      ...balanceSheet.liabilities.map((line) => ({ ...line, section: "Liabilities" })),
      ...balanceSheet.equity.map((line) => ({ ...line, section: "Equity" })),
    ],
    [balanceSheet],
  );

  const difference = Math.abs(
    balanceSheet.totalAssets - balanceSheet.totalLiabilitiesAndEquity,
  );

  return (
    <HubListPage className={financeSectionPanelClassName()}>
      <HubListPage.Banner>
        <div className="flex items-center gap-3" data-testid="balance-sheet-status">
          {balanceSheet.isBalanced ? (
            <CheckCircle2
              className="h-6 w-6 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
          ) : (
            <TriangleAlert
              className="h-6 w-6 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
          )}
          <div>
            <p className={cn("font-medium", text.primary)}>
              {balanceSheet.isBalanced
                ? "Assets equal liabilities plus equity"
                : `Out of balance by ${formatCurrency(difference)}`}
            </p>
            <p className={cn("text-sm", text.muted)}>
              {formatCurrency(balanceSheet.totalAssets)} assets ·{" "}
              {formatCurrency(balanceSheet.totalLiabilitiesAndEquity)} liabilities and
              equity
              {balanceSheet.asOf ? ` · as of ${balanceSheet.asOf}` : ""}
            </p>
          </div>
        </div>

        <div className={infoBannerClassName("mt-3 py-3")}>
          <p className={infoBannerTextClassName()}>
            {balanceSheet.scope === "BRANCH"
              ? "Branch view — entries posted at chain level are excluded, so this is a partial picture of the company. Retained earnings is computed from the revenue and expense accounts because there is no period close."
              : "Retained earnings is computed from the revenue and expense accounts rather than posted, because there is no period close. It accumulates from go-live rather than resetting each year."}
          </p>
        </div>
      </HubListPage.Banner>

      <HubListPage.Error
        message={isError ? getErrorMessage(error, "Failed to load balance sheet") : undefined}
        onRetry={() => void refetch()}
        loading={isFetching}
      />

      <HubListPage.Toolbar
        showReset={!isDefault}
        onReset={reset}
        freshness={{ dataUpdatedAt, isFetching, onRefresh: () => void refetch() }}
        actions={
          <ExportCsvButton
            filenameBase={`balance-sheet${asOf ? `-as-of-${asOf}` : ""}`}
            rows={csvRows}
            columns={BALANCE_SHEET_CSV_COLUMNS}
          />
        }
        filters={
          <ListFilterDate
            value={asOf}
            onChange={(value) => setValue("asOf", value)}
            ariaLabel="Balances as of date"
          />
        }
      />

      <BalanceSheetStatement balanceSheet={balanceSheet} isLoading={isLoading} />
    </HubListPage>
  );
}

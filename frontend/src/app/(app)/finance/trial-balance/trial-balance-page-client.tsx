"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterDate, ListFilterSelect } from "@/components/shared/list-filters";
import { TrialBalanceTable } from "@/components/finance/TrialBalanceTable";
import { useTrialBalance } from "@/hooks/domains/useAccountingQueries";
import {
  type AccountTypeFilter,
  accountTypeLabel,
  accountTypesForLegend,
} from "@/lib/filters/account-filters";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/money";
import { financeSectionPanelClassName } from "@/lib/theme/finance";
import { infoBannerClassName, infoBannerTextClassName } from "@/lib/theme/hub-banners";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import type { TrialBalance } from "@/types/accounting";

const EMPTY_BALANCE: TrialBalance = {
  scope: "CHAIN",
  branchId: null,
  asOf: null,
  accounts: [],
  totalDebit: 0,
  totalCredit: 0,
  isBalanced: true,
};

export default function TrialBalancePageClient() {
  const { activeBranchId } = useAuth();
  const selectedBranch = activeBranchId ? String(activeBranchId) : "ALL";

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [typeFilter, setTypeFilter] = useState<AccountTypeFilter>("ALL");
  const [asOf, setAsOf] = useState("");

  const {
    data: trialBalance = EMPTY_BALANCE,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useTrialBalance(selectedBranch, asOf || undefined);

  const filteredAccounts = useMemo(
    () =>
      trialBalance.accounts.filter((account) => {
        if (typeFilter !== "ALL" && account.type !== typeFilter) return false;
        if (!deferredSearch) return true;
        return (
          account.code.toLowerCase().includes(deferredSearch) ||
          account.name.toLowerCase().includes(deferredSearch)
        );
      }),
    [trialBalance.accounts, typeFilter, deferredSearch],
  );

  const filteredTotals = useMemo(
    () =>
      filteredAccounts.reduce(
        (totals, account) => ({
          debit: Math.round((totals.debit + account.debit) * 100) / 100,
          credit: Math.round((totals.credit + account.credit) * 100) / 100,
        }),
        { debit: 0, credit: 0 },
      ),
    [filteredAccounts],
  );

  const hasActiveFilters =
    search.trim().length > 0 || typeFilter !== "ALL" || asOf.length > 0;
  const isFilteringRows = search.trim().length > 0 || typeFilter !== "ALL";
  const difference = Math.abs(trialBalance.totalDebit - trialBalance.totalCredit);

  return (
    <HubListPage className={financeSectionPanelClassName()}>
      <HubListPage.Banner>
        <div
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          data-testid="trial-balance-status"
        >
          <div className="flex items-center gap-3">
            {trialBalance.isBalanced ? (
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
                {trialBalance.isBalanced
                  ? "Debits equal credits"
                  : `Out of balance by ${formatCurrency(difference)}`}
              </p>
              <p className={cn("text-sm", text.muted)}>
                {formatCurrency(trialBalance.totalDebit)} debit ·{" "}
                {formatCurrency(trialBalance.totalCredit)} credit
                {trialBalance.asOf ? ` · as of ${trialBalance.asOf}` : ""}
              </p>
            </div>
          </div>
        </div>

        {trialBalance.scope === "BRANCH" && (
          <div className={infoBannerClassName("mt-3 py-3")}>
            <p className={infoBannerTextClassName()}>
              Branch view — entries posted at chain level are excluded, so this is a
              partial picture of the company.
            </p>
          </div>
        )}
      </HubListPage.Banner>

      <HubListPage.Error
        message={isError ? getErrorMessage(error, "Failed to load trial balance") : undefined}
        onRetry={() => void refetch()}
        loading={isFetching}
      />

      <HubListPage.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search code or account…"
        showReset={hasActiveFilters}
        onReset={() => {
          setSearch("");
          setTypeFilter("ALL");
          setAsOf("");
        }}
        filters={
          <>
            <ListFilterSelect
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as AccountTypeFilter)}
              ariaLabel="Filter by account type"
              widthClassName="w-full sm:w-[160px]"
              options={[
                { value: "ALL", label: "All types" },
                ...accountTypesForLegend().map((type) => ({
                  value: type,
                  label: accountTypeLabel(type),
                })),
              ]}
            />
            <ListFilterDate
              value={asOf}
              onChange={setAsOf}
              ariaLabel="Balances as of date"
            />
          </>
        }
      />

      <HubListPage.Count
        isLoading={isLoading}
        isError={isError}
        isFetching={isFetching}
        hasActiveFilters={hasActiveFilters}
        filteredCount={filteredAccounts.length}
        totalCount={trialBalance.accounts.length}
        itemLabel="account"
        emptyLabel="No posted entries yet"
      />

      <TrialBalanceTable
        accounts={filteredAccounts}
        totalDebit={filteredTotals.debit}
        totalCredit={filteredTotals.credit}
        totalsLabel={isFilteringRows ? "Filtered totals" : "Totals"}
        isLoading={isLoading}
        hasActiveFilters={hasActiveFilters}
      />
    </HubListPage>
  );
}

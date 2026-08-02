"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import dynamic from "next/dynamic";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { JournalEntriesTable } from "@/components/finance/JournalEntriesTable";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import { JOURNAL_ENTRY_CSV_COLUMNS } from "@/lib/export/finance-columns";
import { fetchAllPages } from "@/lib/export/fetch-all-pages";
import { ACCOUNTING_ENDPOINTS } from "@/lib/endpoints/accounting";
import type { JournalEntry } from "@/types/accounting";
import { useJournalEntries, useLedger } from "@/hooks/domains/useAccountingQueries";
import { seedAccounts } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useListUrlState } from "@/hooks/useListUrlState";
import {
  JOURNAL_PAGE_SIZE_DEFAULT,
  type JournalStatusFilter,
  type LedgerChartPoint,
} from "@/lib/filters/ledger-filters";
import { financeSectionLabelClassName, financeSectionPanelClassName } from "@/lib/theme/finance";
import { infoBannerClassName, infoBannerTextClassName } from "@/lib/theme/hub-banners";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { surfaceInsetSkeletonClassName } from "@/lib/theme/color-helpers";

const LedgerTrendChart = dynamic(
  () => import("@/components/finance/LedgerTrendChart").then((module) => module.LedgerTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className={surfaceInsetSkeletonClassName("h-[280px] w-full rounded-xl")} />
    ),
  },
);

export default function LedgerPageClient() {
  const { activeBranchId } = useAuth();
  const selectedBranch = activeBranchId ? String(activeBranchId) : "ALL";

  const [isSeeding, setIsSeeding] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);

  const { values, setValue, reset, isDefault } = useListUrlState({
    q: "",
    status: "ALL",
    page: "1",
    size: String(JOURNAL_PAGE_SIZE_DEFAULT),
  });

  const statusFilter = values.status as JournalStatusFilter;
  const search = values.q;
  const deferredSearch = useDeferredValue(search.trim());
  const page = Math.max(1, Number(values.page) || 1);
  const pageSize = Number(values.size) || JOURNAL_PAGE_SIZE_DEFAULT;
  const setSearch = (next: string) => setValue("q", next);

  const entryWindow = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      ...(deferredSearch ? { search: deferredSearch } : {}),
    }),
    [page, pageSize, statusFilter, deferredSearch],
  );

  const {
    data: chartData = [],
    isLoading: isChartLoading,
    isError: chartError,
    error: chartErr,
    refetch: refetchChart,
    isFetching: chartFetching,
  } = useLedger(selectedBranch);
  const {
    data: entryPage,
    isLoading: isEntriesLoading,
    isError: entriesError,
    error: entriesErr,
    refetch: refetchEntries,
    isFetching: entriesFetching,
    dataUpdatedAt: entriesUpdatedAt,
  } = useJournalEntries(selectedBranch, entryWindow);

  const entries = useMemo(() => entryPage?.items ?? [], [entryPage]);
  const totalEntries = entryPage?.total ?? 0;

  const hasError = chartError || entriesError;
  const isLoading = isChartLoading || isEntriesLoading;
  const isFetching = chartFetching || entriesFetching;
  const errorMessage = getErrorMessage(chartErr ?? entriesErr, "Failed to load ledger data");

  const filteredEntries = entries;

  useEffect(() => {
    setValue("page", "1");
  }, [deferredSearch, statusFilter, pageSize, selectedBranch, setValue]);

  const handlePageChange = (nextPage: number, nextPageSize: number) => {
    if (nextPageSize !== pageSize) {
      setValue("size", String(nextPageSize));
      setValue("page", "1");
      return;
    }
    setValue("page", String(nextPage));
  };

  const hasActiveFilters = !isDefault;
  const showSeedAction = entries.length === 0 && !isEntriesLoading && !entriesError;

  const handleSeed = async () => {
    try {
      setIsSeeding(true);
      await seedAccounts();
      toast.success("Chart of accounts seeded");
      setShowSeedConfirm(false);
      void refetchEntries();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to seed accounts"));
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-4">
      {showSeedAction ? (
        <div className="flex justify-end">
          <Button
            className={hubCtaClassName("finance")}
            disabled={isSeeding}
            onClick={() => setShowSeedConfirm(true)}
          >
            {isSeeding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin motion-reduce:animate-none" aria-hidden />
                Seeding…
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" aria-hidden />
                Seed accounts
              </>
            )}
          </Button>
        </div>
      ) : null}

      <HubListPage className={financeSectionPanelClassName()}>
        {showSeedAction && (
          <HubListPage.Banner>
            <div className={infoBannerClassName("py-3")}>
              <p className={infoBannerTextClassName()}>
                Chart of accounts not initialized — seed to start posting entries
              </p>
            </div>
          </HubListPage.Banner>
        )}

        <HubListPage.Error
          message={hasError ? errorMessage : undefined}
          onRetry={() => {
            void refetchChart();
            void refetchEntries();
          }}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search reference, description…"
          showReset={hasActiveFilters}
          onReset={reset}
          freshness={{
            dataUpdatedAt: entriesUpdatedAt,
            isFetching,
            onRefresh: () => {
              void refetchChart();
              void refetchEntries();
            },
          }}
          actions={
            <ExportCsvButton
              filenameBase="journal-entries"
              columns={JOURNAL_ENTRY_CSV_COLUMNS}
              loadRows={() =>
                fetchAllPages<JournalEntry>((window) =>
                  ACCOUNTING_ENDPOINTS.journalEntries(selectedBranch, {
                    ...window,
                    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
                    ...(deferredSearch ? { search: deferredSearch } : {}),
                  }),
                )
              }
            />
          }
          filters={
            <ListFilterSelect
              value={statusFilter}
              onValueChange={(value) => setValue("status", value)}
              ariaLabel="Filter journal entries by status"
              widthClassName="w-full sm:w-[180px]"
              options={[
                { value: "ALL", label: "All statuses" },
                { value: "POSTED", label: "Posted" },
                { value: "DRAFT", label: "Draft" },
              ]}
            />
          }
        />

        <HubListPage.Count
          isLoading={isLoading}
          isError={hasError}
          isFetching={isFetching}
          hasActiveFilters={hasActiveFilters}
          filteredCount={totalEntries}
          totalCount={totalEntries}
          itemLabel="entry"
          itemLabelPlural="entries"
        />

        <div>
          <h2 className={financeSectionLabelClassName()}>P&amp;L trend</h2>
          <LedgerTrendChart data={chartData as LedgerChartPoint[]} loading={isChartLoading} />
        </div>

        <div className="pt-2">
          <h2 className={financeSectionLabelClassName()}>Journal entries</h2>
          <JournalEntriesTable
            entries={filteredEntries}
            isLoading={isEntriesLoading}
            hasActiveFilters={hasActiveFilters}
            showSeedAction={showSeedAction}
            serverPagination={{
              page,
              pageSize,
              total: totalEntries,
              onChange: handlePageChange,
            }}
          />
        </div>
      </HubListPage>

      <ConfirmDialog
        open={showSeedConfirm}
        onOpenChange={setShowSeedConfirm}
        title="Seed chart of accounts?"
        description="Adds standard accounting codes for journal posting."
        confirmLabel="Seed"
        loading={isSeeding}
        onConfirm={handleSeed}
      />
    </div>
  );
}

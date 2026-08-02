"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { Loader2 } from "lucide-react";
import { useAuditLogs } from "@/hooks/domains/useReportsQueries";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { AuditLogDetailSheet } from "@/components/settings/AuditLogDetailSheet";
import { AuditLogTable } from "@/components/settings/AuditLogTable";
import { Button } from "@/components/ui/button";
import {
  type AuditActionCategory,
  type AuditLogRow,
  type AuditTargetTypeFilter,
  auditTargetTypeLabel,
  filterAuditLogs,
  uniqueAuditTargetTypes,
} from "@/lib/filters/audit-filters";
import { getErrorMessage } from "@/lib/errors";
import { infoBannerClassName, infoBannerTextClassName } from "@/lib/theme/hub-banners";
import { hubLoadingSpinnerClassName } from "@/lib/theme/hub-primitives";
import { settingsSectionPanelClassName } from "@/lib/theme/settings-hub-chrome";
import { cn } from "@/lib/utils";
import { useListUrlState } from "@/hooks/useListUrlState";

const PAGE_SIZE = 15;
const FETCH_BATCH = 100;

export default function AuditPageClient() {
  const [fetchLimit, setFetchLimit] = useState(FETCH_BATCH);
  const {
    data: logsData = [],
    isLoading: loading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAuditLogs(fetchLimit, 0);

  const [page, setPage] = useState(1);
  const { values, setValue, reset, isDefault } = useListUrlState({
    q: "",
    action: "ALL",
    target: "ALL",
  });
  const search = values.q;
  const setSearch = (next: string) => setValue("q", next);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const actionFilter = values.action as AuditActionCategory;
  const targetTypeFilter = values.target as AuditTargetTypeFilter;
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

  const logs = logsData as AuditLogRow[];
  const targetTypes = useMemo(() => uniqueAuditTargetTypes(logs), [logs]);
  const entryCount = logs.length;

  const filteredLogs = useMemo(
    () =>
      filterAuditLogs(logs, {
        search: deferredSearch,
        actionFilter,
        targetTypeFilter,
      }),
    [logs, deferredSearch, actionFilter, targetTypeFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const mayHaveOlderEntries = logs.length >= fetchLimit;

  const pageLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, currentPage]);

  const hasActiveFilters = !isDefault;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);


  const entryCountLabel = (count: number) =>
    `${count} entr${count === 1 ? "y" : "ies"}`;

  const formatLoadedSummary = () => {
    const olderSuffix = mayHaveOlderEntries ? ` · latest ${fetchLimit} loaded` : "";
    if (hasActiveFilters) {
      return `${filteredLogs.length} of ${entryCount} entries${olderSuffix}`;
    }
    return `${entryCountLabel(entryCount)}${olderSuffix}`;
  };

  return (
    <div className="space-y-4 max-w-6xl w-full mx-auto">
      <HubListPage className={settingsSectionPanelClassName()}>
        {!loading && !isError && entryCount === 0 && (
          <HubListPage.Banner>
            <div className={infoBannerClassName("py-3")}>
              <p className={infoBannerTextClassName()}>
                No audit entries yet — system actions will appear here once recorded.
              </p>
            </div>
          </HubListPage.Banner>
        )}

        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load audit logs.") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search action, user, module…"
          showReset={hasActiveFilters}
          onReset={reset}
          filters={
            <>
              <ListFilterSelect
                value={actionFilter}
                onValueChange={(value) => {
                  setValue("action", value);
                  setPage(1);
                }}
                ariaLabel="Filter by action type"
                widthClassName="w-full sm:w-[160px]"
                options={[
                  { value: "ALL", label: "All actions" },
                  { value: "create", label: "Create" },
                  { value: "update", label: "Update" },
                  { value: "approve", label: "Approve" },
                  { value: "delete", label: "Delete / reject" },
                  { value: "other", label: "Other" },
                ]}
              />
              {targetTypes.length > 1 && (
                <ListFilterSelect
                  value={targetTypeFilter}
                  onValueChange={(value) => {
                    setValue("target", value);
                    setPage(1);
                  }}
                  ariaLabel="Filter by target module"
                  widthClassName="w-full sm:w-[180px]"
                  options={[
                    { value: "ALL", label: "All modules" },
                    ...targetTypes.map((targetType) => ({
                      value: targetType,
                      label: auditTargetTypeLabel(targetType),
                    })),
                  ]}
                />
              )}
            </>
          }
        />

        {entryCount > 0 && (
          <HubListPage.Count
            isLoading={loading}
            isError={isError}
            isFetching={isFetching}
            actions={
              mayHaveOlderEntries ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 min-h-[44px] font-medium"
                  disabled={isFetching}
                  onClick={() => setFetchLimit((current) => current + FETCH_BATCH)}
                >
                  {isFetching ? (
                    <Loader2
                      className={cn("w-4 h-4 mr-2 animate-spin", hubLoadingSpinnerClassName())}
                      aria-hidden
                    />
                  ) : null}
                  Load older
                </Button>
              ) : undefined
            }
          >
            {formatLoadedSummary()}
          </HubListPage.Count>
        )}

        <AuditLogTable
          pageLogs={pageLogs}
          loading={loading}
          hasActiveFilters={hasActiveFilters}
          currentPage={currentPage}
          totalPages={totalPages}
          filteredCount={filteredLogs.length}
          pageSize={PAGE_SIZE}
          onSelectLog={setSelectedLog}
          onPreviousPage={() => setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </HubListPage>

      <AuditLogDetailSheet
        log={selectedLog}
        open={selectedLog != null}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}

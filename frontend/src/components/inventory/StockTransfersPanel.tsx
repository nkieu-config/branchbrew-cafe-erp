"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useState, useDeferredValue } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/intl-date";
import { useAuth } from "@/context/AuthContext";
import { useHubListPagination } from "@/hooks/useHubListPagination";
import { useBranches } from "@/hooks/domains/useGeneralQueries";
import { useIngredients } from "@/hooks/domains/useProductionQueries";
import {
  useTransfers,
  useCreateTransfer,
  useAcceptTransfer,
} from "@/hooks/domains/useTransferQueries";
import { DataTable } from "@/components/shared/data-table";
import {
  ListMobileCard,
  PaginatedMobileList,
  ResponsiveDataTableLayout,
} from "@/components/shared/responsive-data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TableActionButton } from "@/components/shared/table-action-button";
import { StatusBadge, formatStatusLabel, transferStatusTone } from "@/components/shared/status-badge";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterRow, ListFilterSelect } from "@/components/shared/list-filters";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import { formatHubListCountWithFetching } from "@/lib/format-hub-list-count";
import { COL_WIDTH } from "@/lib/theme/data-table";
import { compactPanelLinkClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { typeUiLabelClassName } from "@/lib/theme/typography";
import { cn } from "@/lib/utils";
import type { Branch, Ingredient, StockTransfer } from "@/types/api";
import type { ColumnsType } from "antd/es/table";
import {
  branchLabel,
  emptyCreateForm,
  parseDirectionFilter,
  parseStatusFilter,
  transferMatchesSearch,
  type CreateTransferForm,
  type DirectionFilter,
  type SourceInventory,
  type StatusFilter,
} from "@/components/inventory/stock-transfer-types";

const CreateTransferModal = dynamic(
  () => import("@/components/inventory/CreateTransferModal").then((m) => m.CreateTransferModal),
  { ssr: false, loading: () => <DialogLoadingFallback label="Opening transfer form" /> },
);

import { DialogLoadingFallback } from "@/components/shared/dialog-loading-fallback";
import type { StockTransfersPanelHandle } from "@/components/inventory/stock-transfers-panel-handle";

export type { StockTransfersPanelHandle };

interface StockTransfersPanelProps {
  /** `page` — full transfers tab. `compact` — overview widget. */
  variant?: "page" | "compact";
  /** When compact, limit ingredient picker to branch stock on hand. */
  sourceInventories?: SourceInventory[];
}

function BranchCell({ name }: { name: string | undefined }) {
  return <span className={cn("font-medium", text.secondary)}>{branchLabel(name)}</span>;
}

export function StockTransfersPanel({
  variant: variantProp = "page",
  sourceInventories,
  ref,
}: StockTransfersPanelProps & { ref?: React.Ref<StockTransfersPanelHandle> }) {
  const variant = variantProp;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { user, activeBranchId } = useAuth();
  const branchId = activeBranchId ?? undefined;

  const {
    data: transfersData,
    isLoading: loadingTransfers,
    isError: transfersError,
    error: transfersErr,
    refetch: refetchTransfers,
    isFetching: transfersFetching,
  } = useTransfers(branchId);
  const { data: branchesData, isLoading: loadingBranches } = useBranches();
  const { data: ingredientsData, isLoading: loadingIng } = useIngredients();

  const transfers = (transfersData as StockTransfer[]) || [];
  const branches = branchesData || [];
  const allIngredients = ingredientsData || [];

  const createMutation = useCreateTransfer();
  const acceptMutation = useAcceptTransfer();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<StockTransfer | null>(null);
  const [createForm, setCreateForm] = useState<CreateTransferForm>(emptyCreateForm);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    parseStatusFilter(searchParams.get("status")),
  );
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>(() =>
    parseDirectionFilter(searchParams.get("direction")),
  );

  const modalFormLoading = loadingBranches || loadingIng;

  const transferStatusParam = searchParams.get("status");
  const transferDirectionParam = searchParams.get("direction");

  useEffect(() => {
    setStatusFilter(parseStatusFilter(transferStatusParam));
    setDirectionFilter(parseDirectionFilter(transferDirectionParam));
  }, [transferStatusParam, transferDirectionParam]);

  const syncUrlFilters = useCallback(
    (status: StatusFilter, direction: DirectionFilter) => {
      const params = new URLSearchParams();
      if (status === "PENDING") params.set("status", "PENDING");
      if (direction !== "ALL") params.set("direction", direction);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const handleStatusFilterChange = useCallback(
    (value: StatusFilter) => {
      setStatusFilter(value);
      syncUrlFilters(value, directionFilter);
    },
    [directionFilter, syncUrlFilters],
  );

  const handleDirectionFilterChange = useCallback(
    (value: DirectionFilter) => {
      setDirectionFilter(value);
      syncUrlFilters(statusFilter, value);
    },
    [statusFilter, syncUrlFilters],
  );

  const transferSummary = useMemo(() => {
    let pending = 0;
    let incoming = 0;
    let outgoing = 0;
    for (const transfer of transfers) {
      if (transfer.status !== "PENDING") continue;
      pending += 1;
      if (branchId && transfer.toBranchId === branchId) incoming += 1;
      if (branchId && transfer.fromBranchId === branchId) outgoing += 1;
    }
    return { total: transfers.length, pending, incoming, outgoing };
  }, [transfers, branchId]);

  const visibleTransfers = useMemo(() => {
    let base =
      variant === "page"
        ? transfers
        : !branchId
          ? transfers.filter((t) => t.status === "PENDING")
          : transfers.filter(
              (t) =>
                t.status === "PENDING" &&
                (t.toBranchId === branchId || t.fromBranchId === branchId),
            );

    if (variant === "page") {
      if (statusFilter === "PENDING") {
        base = base.filter((t) => t.status === "PENDING");
      }
      if (directionFilter === "incoming" && branchId) {
        base = base.filter((t) => t.toBranchId === branchId);
      }
      if (directionFilter === "outgoing" && branchId) {
        base = base.filter((t) => t.fromBranchId === branchId);
      }
      if (deferredSearch) {
        base = base.filter((t) => transferMatchesSearch(t, deferredSearch));
      }
    }

    return base;
  }, [transfers, variant, branchId, statusFilter, directionFilter, deferredSearch]);

  const hasActiveFilters =
    variant === "page" &&
    (search.trim().length > 0 || statusFilter !== "ALL" || directionFilter !== "ALL");

  const canAccept = useCallback(
    (transfer: StockTransfer) => {
      if (transfer.status !== "PENDING") return false;
      if (user?.role === "SUPER_ADMIN") return true;
      return !!branchId && transfer.toBranchId === branchId;
    },
    [user?.role, branchId],
  );

  const ingredientOptions = useMemo((): { id: number; label: string }[] => {
    if (sourceInventories?.length) {
      return sourceInventories
        .filter((i) => i.stock > 0)
        .map((i) => ({
          id: i.ingredient.id,
          label: `${i.ingredient.name} (max ${i.stock} ${i.ingredient.unit})`,
        }));
    }
    return allIngredients.map((i: Ingredient) => ({
      id: i.id,
      label: `${i.name} (${i.unit})`,
    }));
  }, [sourceInventories, allIngredients]);

  const destinationBranches = useMemo(
    () => branches.filter((b: Branch) => b.id !== branchId),
    [branches, branchId],
  );

  const openCreate = useCallback(() => {
    setCreateForm({
      ...emptyCreateForm(),
      fromBranchId: branchId ?? 0,
    });
    setIsModalOpen(true);
  }, [branchId]);

  useImperativeHandle(ref, () => ({ openCreate }), [openCreate]);

  const handleCreateSubmit = async () => {
    const fromBranchId = branchId ?? createForm.fromBranchId;
    const toBranchId = createForm.toBranchId;
    const ingredientId = createForm.ingredientId;
    const quantity = Number(createForm.quantity);

    if (!fromBranchId) {
      toast.error("Select a source branch");
      return;
    }
    if (!toBranchId) {
      toast.error("Select a destination branch");
      return;
    }
    if (fromBranchId === toBranchId) {
      toast.error("Source and destination must differ");
      return;
    }
    if (!ingredientId) {
      toast.error("Select an ingredient");
      return;
    }
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("Enter a quantity greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      await createMutation.mutateAsync({
        fromBranchId,
        toBranchId,
        ingredientId,
        quantity,
      });
      toast.success("Transfer requested");
      setIsModalOpen(false);
      setCreateForm(emptyCreateForm());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create transfer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async (transferId: number) => {
    try {
      await acceptMutation.mutateAsync(transferId);
      toast.success("Transfer accepted — inventory updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to accept transfer");
    }
  };

  const resetFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("ALL");
    setDirectionFilter("ALL");
    syncUrlFilters("ALL", "ALL");
  }, [syncUrlFilters]);

  const renderTransferDirectionHint = useCallback(
    (record: StockTransfer, status: string) => {
      if (status !== "PENDING" || !branchId) return null;
      if (record.toBranchId === branchId) return "Incoming";
      if (record.fromBranchId === branchId) {
        return `To ${record.toBranch?.name ?? "branch"}`;
      }
      return null;
    },
    [branchId],
  );

  const renderTransferActions = useCallback(
    (record: StockTransfer) => {
      if (!canAccept(record)) return null;
      return (
        <TableActionButton
          icon={CheckCircle2}
          label="Accept"
          tone="emerald"
          onClick={() => setAcceptTarget(record)}
        />
      );
    },
    [canAccept],
  );

  const columns = useMemo(
    () =>
      [
      {
        title: "Date",
        dataIndex: "createdAt",
        key: "createdAt",
        width: variant === "compact" ? COL_WIDTH.date : COL_WIDTH.dateTime,
        responsive: ["md"],
        render: (date: string) => (
          <span className={`whitespace-nowrap tabular-nums text-sm ${text.subtle}`}>
            {formatDateTime(date)}
          </span>
        ),
      },
      {
        title: "From",
        key: "from",
        responsive: ["md"],
        render: (_: unknown, record: StockTransfer) => (
          <BranchCell name={record.fromBranch?.name} />
        ),
      },
      {
        title: "To",
        key: "to",
        responsive: ["md"],
        render: (_: unknown, record: StockTransfer) => (
          <BranchCell name={record.toBranch?.name} />
        ),
      },
      {
        title: "Ingredient",
        key: "ingredient",
        render: (_: unknown, record: StockTransfer) => (
          <div className="min-w-0">
            <span className={`font-medium ${text.primary}`}>
              {record.ingredient?.name ?? "—"}
            </span>
            <p className={`mt-0.5 text-xs md:hidden ${text.muted}`}>
              {branchLabel(record.fromBranch?.name)} → {branchLabel(record.toBranch?.name)}
            </p>
          </div>
        ),
      },
      {
        title: "Qty",
        key: "quantity",
        align: "right" as const,
        width: 88,
        render: (_: unknown, record: StockTransfer) => (
          <span className={cn("tabular-nums text-sm", text.subtle)}>
            {record.quantity}
            {record.ingredient?.unit ? (
              <span className={cn("ml-1 text-xs", text.muted)}>{record.ingredient.unit}</span>
            ) : null}
          </span>
        ),
      },
      ...(variant === "page"
        ? [
            {
              title: "By",
              key: "requestedBy",
              responsive: ["lg"],
              render: (_: unknown, record: StockTransfer) => (
                <span className={`text-sm ${text.muted}`}>
                  {record.requestedBy?.name ?? record.requestedBy?.email ?? "—"}
                </span>
              ),
            },
          ]
        : []),
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: COL_WIDTH.status,
        render: (status: string, record: StockTransfer) => {
          const directionHint = renderTransferDirectionHint(record, status);

          return (
            <div className="flex flex-col items-start gap-0.5">
              <StatusBadge tone={transferStatusTone(status)}>{formatStatusLabel(status)}</StatusBadge>
              {directionHint ? (
                <span className={cn("text-xs", text.muted)}>{directionHint}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        title: "Actions",
        key: "actions",
        align: "right" as const,
        width: COL_WIDTH.actions,
        render: (_: unknown, record: StockTransfer) => renderTransferActions(record),
      },
      ] as ColumnsType<StockTransfer>,
    [variant, renderTransferActions, renderTransferDirectionHint],
  );

  const emptyDescription = useMemo(() => {
    if (variant === "compact") return "No pending transfers for this branch.";
    if (hasActiveFilters) return "No transfers match your filters.";
    if (transfers.length === 0) {
      return "No transfers yet.";
    }
    return "No transfers match your filters.";
  }, [variant, hasActiveFilters, transfers.length]);

  const listPagination = useHubListPagination(
    { pageSize: variant === "page" ? 15 : 5, hideOnSinglePage: variant === "compact" },
    `${visibleTransfers.length}-${hasActiveFilters}-${variant}`,
  );

  if (variant === "page" && !branchId) {
    return (
      <BranchEmptyState description="Select a branch in the top bar to request and manage stock transfers." />
    );
  }

  const transferList = (
    <ResponsiveDataTableLayout
      mobile={
        loadingTransfers ? (
          <ResponsiveDataTableLayout.Skeleton />
        ) : visibleTransfers.length === 0 ? (
          <ResponsiveDataTableLayout.Empty message={emptyDescription} />
        ) : (
          <PaginatedMobileList
            items={visibleTransfers}
            pageSize={listPagination.pageSize}
            page={listPagination.currentPage}
            onPageChange={listPagination.setCurrentPage}
          >
            {(record) => {
              const directionHint = renderTransferDirectionHint(record, record.status);

              return (
                <ListMobileCard>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={cn("font-medium", text.primary)}>
                        {record.ingredient?.name ?? "—"}
                      </p>
                      <p className={cn("text-xs", text.muted)}>
                        {branchLabel(record.fromBranch?.name)} → {branchLabel(record.toBranch?.name)}
                      </p>
                      <time
                        className={cn("mt-1 block text-xs tabular-nums", text.subtle)}
                        dateTime={record.createdAt}
                      >
                        {formatDateTime(record.createdAt)}
                      </time>
                    </div>
                    <span className={cn("shrink-0 tabular-nums text-sm", text.subtle)}>
                      {record.quantity}
                      {record.ingredient?.unit ? (
                        <span className={cn("ml-1 text-xs", text.muted)}>
                          {record.ingredient.unit}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusBadge tone={transferStatusTone(record.status)}>{formatStatusLabel(record.status)}</StatusBadge>
                    {directionHint ? (
                      <span className={cn("text-xs", text.muted)}>{directionHint}</span>
                    ) : null}
                  </div>
                  {variant === "page" && (record.requestedBy?.name || record.requestedBy?.email) ? (
                    <p className={cn("mb-2 text-xs", text.muted)}>
                      {record.requestedBy?.name ?? record.requestedBy?.email}
                    </p>
                  ) : null}
                  {renderTransferActions(record)}
                </ListMobileCard>
              );
            }}
          </PaginatedMobileList>
        )
      }
      desktop={
        <DataTable
          columns={columns}
          dataSource={visibleTransfers}
          rowKey="id"
          loading={loadingTransfers}
          isError={transfersError}
          errorMessage={getErrorMessage(transfersErr, "Failed to load stock transfers")}
          onRetry={() => void refetchTransfers()}
          retryLoading={transfersFetching}
          hideBorders={variant === "page"}
          emptyDescription={emptyDescription}
          scroll={variant === "compact" ? { x: 720 } : undefined}
          pagination={listPagination.tablePagination}
        />
      }
    />
  );

  return (
    <>
      {variant === "compact" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className={typeUiLabelClassName(text.primary)}>Pending transfers</h2>
            <div className="flex gap-2">
              {branchId && (
                <Button variant="outline" size="sm" onClick={openCreate}>
                  New
                </Button>
              )}
              <Link href="/inventory/transfers" className={compactPanelLinkClassName()}>
                View all <ExternalLink className="w-3.5 h-3.5" aria-hidden />
              </Link>
            </div>
          </div>
          {transferList}
        </div>
      )}

      {variant === "page" && (
        <HubListPage>
          <HubListPage.Error
            message={
              transfersError
                ? getErrorMessage(transfersErr, "Failed to load stock transfers")
                : undefined
            }
            onRetry={() => void refetchTransfers()}
            loading={transfersFetching}
          />

          <HubListPage.Toolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search ingredient, branch, or requester…"
            showReset={hasActiveFilters}
            onReset={resetFilters}
            filters={
              <ListFilterRow>
                <ListFilterSelect
                  value={statusFilter}
                  onValueChange={handleStatusFilterChange}
                  ariaLabel="Filter transfers by status"
                  options={[
                    { value: "ALL", label: "All statuses" },
                    { value: "PENDING", label: "Pending only" },
                  ]}
                />
                <ListFilterSelect
                  value={directionFilter}
                  onValueChange={handleDirectionFilterChange}
                  ariaLabel="Filter transfers by direction"
                  options={[
                    { value: "ALL", label: "All directions" },
                    { value: "incoming", label: "Incoming" },
                    { value: "outgoing", label: "Outgoing" },
                  ]}
                />
              </ListFilterRow>
            }
          />

          <HubListPage.Count
            isLoading={loadingTransfers}
            isError={transfersError}
            isFetching={transfersFetching}
            hasActiveFilters={hasActiveFilters}
            filteredCount={visibleTransfers.length}
            totalCount={transferSummary.total}
            itemLabel="transfer"
          >
            {formatHubListCountWithFetching(
              (() => {
                if (hasActiveFilters) {
                  return `${visibleTransfers.length} of ${transferSummary.total} transfer${transferSummary.total === 1 ? "" : "s"}`;
                }
                if (transferSummary.total === 0) return "No transfers yet";
                const parts = [
                  `${transferSummary.total} transfer${transferSummary.total === 1 ? "" : "s"}`,
                ];
                if (transferSummary.pending > 0) {
                  parts.push(`${transferSummary.pending} pending`);
                }
                if (transferSummary.incoming > 0) {
                  parts.push(`${transferSummary.incoming} incoming`);
                }
                if (transferSummary.outgoing > 0) {
                  parts.push(`${transferSummary.outgoing} outgoing`);
                }
                return parts.join(" · ");
              })(),
              transfersFetching,
              loadingTransfers,
            )}
          </HubListPage.Count>

          <HubListPage.Body>{transferList}</HubListPage.Body>
        </HubListPage>
      )}

      {isModalOpen ? (
        <CreateTransferModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setCreateForm(emptyCreateForm());
          }}
          branchId={branchId}
          branches={branches}
          destinationBranches={destinationBranches}
          ingredientOptions={ingredientOptions}
          modalFormLoading={modalFormLoading}
          createForm={createForm}
          setCreateForm={setCreateForm}
          submitting={submitting}
          onSubmit={handleCreateSubmit}
        />
      ) : null}

      <ConfirmDialog
        open={acceptTarget !== null}
        onOpenChange={(open) => !open && setAcceptTarget(null)}
        title={
          acceptTarget
            ? `Accept transfer to ${acceptTarget.toBranch?.name ?? "branch"}?`
            : "Accept transfer?"
        }
        description={
          acceptTarget
            ? `${acceptTarget.quantity} ${acceptTarget.ingredient?.unit ?? "units"} of ${acceptTarget.ingredient?.name ?? "ingredient"} will be moved into your branch inventory.`
            : undefined
        }
        confirmLabel="Accept"
        loading={acceptMutation.isPending}
        onConfirm={async () => {
          if (acceptTarget) await handleAccept(acceptTarget.id);
        }}
      />
    </>
  );
}



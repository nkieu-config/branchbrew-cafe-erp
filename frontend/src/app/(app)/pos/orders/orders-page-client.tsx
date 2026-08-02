"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { useAuth } from "@/context/AuthContext";
import { useBranchOrders, useVoidOrder, useRefundOrder } from "@/hooks/domains/usePosQueries";
import { useBranches } from "@/hooks/domains/useGeneralQueries";
import { HubPageHeader } from "@/components/shared/hub-card";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PosOrdersTable } from "@/components/pos/PosOrdersTable";
import { PosRefundDialog } from "@/components/pos/PosRefundDialog";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { useListUrlState } from "@/hooks/useListUrlState";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import { ORDER_CSV_COLUMNS } from "@/lib/export/pos-columns";
import { fetchAllPages } from "@/lib/export/fetch-all-pages";
import { ORDER_ENDPOINTS } from "@/lib/endpoints/orders";
import {
  lookbackStartDate,
  ORDER_LOOKBACK_DEFAULT_DAYS,
  ORDER_LOOKBACK_OPTIONS,
  ORDER_PAGE_SIZE_DEFAULT,
} from "@/lib/filters/pos-order-filters";
import { posSectionPanelClassName } from "@/lib/theme/immersive";
import type { Branch, Order, OrderStatus } from "@/types/api";

const STATUS_OPTIONS: OrderStatus[] = [
  "PENDING",
  "PREPARING",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
];

export default function OrdersPageClient() {
  const { activeBranchId, user } = useAuth();
  const { data: branches = [] } = useBranches();
  const branchId = activeBranchId ? Number(activeBranchId) : undefined;
  const branchName = (branches as Branch[]).find((b) => b.id === branchId)?.name;

  const { values, setValue, reset, isDefault } = useListUrlState({
    q: "",
    status: "ALL",
    days: String(ORDER_LOOKBACK_DEFAULT_DAYS),
    page: "1",
    size: String(ORDER_PAGE_SIZE_DEFAULT),
  });

  const search = values.q;
  const deferredSearch = useDeferredValue(search.trim());
  const statusFilter = values.status as OrderStatus | "ALL";
  const lookbackDays = Number(values.days) || ORDER_LOOKBACK_DEFAULT_DAYS;
  const page = Math.max(1, Number(values.page) || 1);
  const pageSize = Number(values.size) || ORDER_PAGE_SIZE_DEFAULT;

  const setSearch = (next: string) => setValue("q", next);
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [voidTarget, setVoidTarget] = useState<Order | null>(null);

  const listWindow = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      ...(deferredSearch ? { search: deferredSearch } : {}),
      since: lookbackStartDate(lookbackDays),
    }),
    [page, pageSize, statusFilter, deferredSearch, lookbackDays],
  );

  const {
    data: ordersPage,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useBranchOrders(branchId, listWindow);
  const orders = useMemo(() => ordersPage?.items ?? [], [ordersPage]);
  const totalOrders = ordersPage?.total ?? 0;
  const voidMutation = useVoidOrder();
  const refundMutation = useRefundOrder();

  const canManage = user?.role === "SUPER_ADMIN" || user?.role === "MANAGER";

  const hasActiveFilters = !isDefault;

  useEffect(() => {
    setValue("page", "1");
  }, [deferredSearch, statusFilter, lookbackDays, pageSize, branchId, setValue]);

  const handlePageChange = (nextPage: number, nextPageSize: number) => {
    if (nextPageSize !== pageSize) {
      setValue("size", String(nextPageSize));
      setValue("page", "1");
      return;
    }
    setValue("page", String(nextPage));
  };

  const handleVoid = async (orderId: number) => {
    try {
      await voidMutation.mutateAsync(orderId);
      toast.success(`Order #${orderId} voided — stock and ledger reversed`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to void order");
    }
  };

  const handleRefund = async () => {
    if (!refundTarget) return;
    try {
      await refundMutation.mutateAsync({
        orderId: refundTarget.id,
        reason: refundReason.trim() || undefined,
      });
      toast.success(`Order #${refundTarget.id} refunded`);
      setRefundTarget(null);
      setRefundReason("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to refund order");
    }
  };

  if (!branchId) {
    return (
      <BranchEmptyState description="Select a branch in the top bar to view orders and refunds." />
    );
  }

  return (
    <>
      <div className="space-y-6">
        <HubPageHeader
          hideTitle
          icon={Receipt}
          accentHub="pos"
          description="Void same-day orders or refund completed sales from previous days."
          branchScope={{ branchName }}
        />

        <HubListPage className={posSectionPanelClassName()}>
          <HubListPage.Error
            message={isError ? getErrorMessage(error, "Failed to load orders") : undefined}
            onRetry={() => void refetch()}
            loading={isFetching}
          />

          <HubListPage.Toolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by order #, queue, payment or status…"
            showReset={hasActiveFilters}
            onReset={reset}
            freshness={{
              dataUpdatedAt,
              isFetching,
              onRefresh: () => void refetch(),
            }}
            actions={
              <ExportCsvButton
                filenameBase="orders"
                columns={ORDER_CSV_COLUMNS}
                loadRows={() =>
                  fetchAllPages<Order>((window) =>
                    ORDER_ENDPOINTS.list({ branchId, ...listWindow, ...window }),
                  )
                }
              />
            }
            filters={
              <>
                <ListFilterSelect
                  value={statusFilter}
                  onValueChange={(value) => setValue("status", value)}
                  ariaLabel="Filter by status"
                  options={[
                    { value: "ALL", label: "All statuses" },
                    ...STATUS_OPTIONS.map((status) => ({ value: status, label: status })),
                  ]}
                />
                <ListFilterSelect
                  value={String(lookbackDays)}
                  onValueChange={(value) => setValue("days", value)}
                  ariaLabel="Filter by period"
                  options={ORDER_LOOKBACK_OPTIONS.map((option) => ({ ...option }))}
                />
              </>
            }
          />

          <HubListPage.Count
            isLoading={isLoading}
            isError={isError}
            isFetching={isFetching}
            hasActiveFilters={hasActiveFilters}
            filteredCount={totalOrders}
            totalCount={totalOrders}
            itemLabel="order"
            emptyLabel={`No orders in the last ${lookbackDays} days`}
          />

          <PosOrdersTable
            orders={orders}
            loading={isLoading}
            hasActiveFilters={hasActiveFilters}
            canManage={canManage}
            serverPagination={{
              page,
              pageSize,
              total: totalOrders,
              onChange: handlePageChange,
            }}
            onVoid={setVoidTarget}
            onRefund={(order) => {
              setRefundTarget(order);
              setRefundReason("");
            }}
          />
        </HubListPage>
      </div>

      <ConfirmDialog
        open={voidTarget !== null}
        onOpenChange={(open) => !open && setVoidTarget(null)}
        title={voidTarget ? `Void order #${voidTarget.id}?` : "Void order?"}
        description="Same-day cancel — restores stock and reverses GL."
        confirmLabel="Void"
        destructive
        loading={voidMutation.isPending}
        onConfirm={async () => {
          if (voidTarget) await handleVoid(voidTarget.id);
        }}
      />

      <PosRefundDialog
        orderId={refundTarget?.id ?? null}
        reason={refundReason}
        loading={refundMutation.isPending}
        onReasonChange={setRefundReason}
        onOpenChange={(open) => {
          if (!open) {
            setRefundTarget(null);
            setRefundReason("");
          }
        }}
        onConfirm={() => void handleRefund()}
      />
    </>
  );
}

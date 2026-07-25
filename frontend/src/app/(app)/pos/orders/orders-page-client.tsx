"use client";

import { useMemo, useState, useDeferredValue } from "react";
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
import { infoBannerClassName, infoBannerTextClassName } from "@/lib/theme/hub-banners";
import {
  filterPosOrders,
  hasPosOrderFilters,
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
  const {
    data: ordersPage,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useBranchOrders(branchId);
  const orders = useMemo(() => ordersPage?.items ?? [], [ordersPage]);
  const truncatedCount = (ordersPage?.total ?? 0) - orders.length;
  const voidMutation = useVoidOrder();
  const refundMutation = useRefundOrder();

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [voidTarget, setVoidTarget] = useState<Order | null>(null);

  const canManage = user?.role === "SUPER_ADMIN" || user?.role === "MANAGER";

  const filteredOrders = useMemo(
    () =>
      filterPosOrders(orders, {
        search: deferredSearch,
        statusFilter,
      }),
    [orders, deferredSearch, statusFilter],
  );

  const hasActiveFilters = hasPosOrderFilters({ search, statusFilter });

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
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

          {truncatedCount > 0 && (
            <div className={infoBannerClassName("py-3")}>
              <p className={infoBannerTextClassName()}>
                Showing the {orders.length} most recent orders of{" "}
                {ordersPage?.total} in this window. Search and filters apply to
                the loaded page.
              </p>
            </div>
          )}

          <HubListPage.Toolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by order #, queue, status…"
            showReset={hasActiveFilters}
            onReset={handleResetFilters}
            filters={
              <ListFilterSelect
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as OrderStatus | "ALL")}
                ariaLabel="Filter by status"
                options={[
                  { value: "ALL", label: "All statuses" },
                  ...STATUS_OPTIONS.map((status) => ({ value: status, label: status })),
                ]}
              />
            }
          />

          <HubListPage.Count
            isLoading={isLoading}
            isError={isError}
            isFetching={isFetching}
            hasActiveFilters={hasActiveFilters}
            filteredCount={filteredOrders.length}
            totalCount={orders.length}
            itemLabel="order"
            emptyLabel="No orders in the last 14 days"
          />

          <PosOrdersTable
            orders={filteredOrders}
            loading={isLoading}
            hasActiveFilters={hasActiveFilters}
            canManage={canManage}
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

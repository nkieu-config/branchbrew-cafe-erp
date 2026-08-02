"use client";

import { useMemo, useState } from "react";
import { usePageChromeExtension } from "@/components/layout/PageChrome";
import dynamic from "next/dynamic";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  useKitchenOrders,
  useCompleteKitchenOrder,
  useUpdateOrderStatus,
  useCreateProductionOrder,
} from "@/hooks/domains/useProductionQueries";
import { useProductionBOMs } from "@/hooks/domains/useAccountingQueries";
import { useIngredients } from "@/hooks/domains/useProductQueries";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { HubListPage } from "@/components/shared/hub-list-page";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import { QueryLoadingPanel } from "@/components/shared/query-states";
import { CreateProductionOrderModal } from "@/components/kitchen/CreateProductionOrderModal";
import { CentralKitchenBranchNotice } from "@/components/kitchen/CentralKitchenBanner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useBranches } from "@/hooks/domains/useGeneralQueries";
import type { Branch, ProductionBOM } from "@/types/api";
import type { ProductionOrderWithTarget } from "@/components/kitchen/KitchenKanbanBoard";
import { getErrorMessage } from "@/lib/errors";
import { getBomTargetIds } from "@/lib/filters/bom-filters";
import { summarizeProductionOrders } from "@/lib/filters/production-order-filters";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { kitchenSectionPanelClassName } from "@/lib/theme/hub-kitchen";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

const KitchenKanbanBoard = dynamic(
  () => import("@/components/kitchen/KitchenKanbanBoard").then((m) => m.KitchenKanbanBoard),
  {
    ssr: false,
    loading: () => <QueryLoadingPanel message="Loading production board…" minHeightClassName="py-20" />,
  },
);

export default function CentralKitchenPageClient() {
  const { activeBranchId } = useAuth();
  const { data: branchesData = [] } = useBranches();
  const branches = branchesData as Branch[];
  const activeBranch = branches.find((b) => b.id === activeBranchId);
  const isCentralKitchen = activeBranch?.isCentralKitchen === true;

  const { data: ingredients = [], isLoading: loadingIngredients } = useIngredients();
  const {
    data: ordersData = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useKitchenOrders();
  const { data: bomsData = [] } = useProductionBOMs();

  const orders = ordersData
    .filter((o: ProductionOrderWithTarget) =>
      ["PLANNED", "IN_PROGRESS", "COMPLETED"].includes(o.status),
    )
    .filter((o: ProductionOrderWithTarget) => !activeBranchId || o.branchId === activeBranchId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<ProductionOrderWithTarget | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);

  const completeMutation = useCompleteKitchenOrder();
  const updateStatusMutation = useUpdateOrderStatus();
  const createOrderMutation = useCreateProductionOrder();

  const bomTargetIds = useMemo(
    () => getBomTargetIds(bomsData as ProductionBOM[]),
    [bomsData],
  );

  const summary = useMemo(() => summarizeProductionOrders(orders), [orders]);

  const handleCreate = async (payload: {
    targetIngredientId: number;
    quantityToProduce: number;
    plannedStartDate: string;
  }) => {
    if (!activeBranchId) {
      toast.error("Please select a branch");
      return;
    }
    try {
      await createOrderMutation.mutateAsync({
        branchId: activeBranchId,
        ...payload,
      });
      toast.success("Production order created");
      setIsModalOpen(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create order"));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const order = orders.find((o: ProductionOrderWithTarget) => o.id === event.active.id);
    setActiveOrder(order ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveOrder(null);
    const { active, over } = event;
    if (!over) return;

    const orderId = active.id as number;
    const newStatus = over.id as string;
    const order = orders.find((o: ProductionOrderWithTarget) => o.id === orderId);

    if (!order || order.status === newStatus) return;

    if (order.status === "COMPLETED") {
      toast.error("Cannot change status of a completed order.");
      return;
    }

    if (pendingOrderId != null) return;

    const isCompleting = newStatus === "COMPLETED";
    const pending = isCompleting
      ? completeMutation.mutateAsync(orderId)
      : updateStatusMutation.mutateAsync({ id: orderId, status: newStatus });

    setPendingOrderId(orderId);
    toast.promise(pending, {
      loading: isCompleting ? "Deducting raw materials…" : "Updating status…",
      success: isCompleting ? "Production completed & inventory updated!" : "Status updated",
      error: (err: unknown) =>
        getErrorMessage(err, isCompleting ? "Failed to complete order" : "Failed to update status"),
    });

    try {
      await pending;
    } catch {
      // toast.promise already surfaced the failure
    } finally {
      setPendingOrderId(null);
    }
  };

  const plannedOrders = orders.filter((o: ProductionOrderWithTarget) => o.status === "PLANNED");
  const inProgressOrders = orders.filter((o: ProductionOrderWithTarget) => o.status === "IN_PROGRESS");
  const completedOrders = orders.filter((o: ProductionOrderWithTarget) => o.status === "COMPLETED");

  usePageChromeExtension(
    useMemo(
      () => ({
        actions:
          activeBranchId && isCentralKitchen ? (
            <Button className={hubCtaClassName("kitchen")} onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" aria-hidden />
              New order
            </Button>
          ) : null,
      }),
      [activeBranchId, isCentralKitchen],
    ),
  );

  if (!activeBranchId) {
    return <BranchEmptyState title="Select a branch for production" />;
  }

  return (
    <div className="space-y-4 w-full">
      {!isCentralKitchen ? (
        <CentralKitchenBranchNotice mode="blocking" />
      ) : (
        <HubListPage className={kitchenSectionPanelClassName()}>
          <HubListPage.Error
            message={isError ? getErrorMessage(error, "Failed to load production orders") : undefined}
            onRetry={() => void refetch()}
            loading={isFetching}
          />

          <HubListPage.Count
            isLoading={isLoading}
            isError={isError}
            isFetching={isFetching}
          >
            {summary.total === 0 ? (
              <span className={text.muted}>No production orders yet</span>
            ) : (
              <span className={cn("tabular-nums", text.secondary)}>
                {summary.planned} planned · {summary.inProgress} in progress · {summary.completed}{" "}
                done
              </span>
            )}
            {isFetching && !isLoading && (
              <span className={cn("ml-1", text.muted)}>· Updating…</span>
            )}
          </HubListPage.Count>

          <HubListPage.Body>
            {isLoading && orders.length === 0 ? (
              <QueryLoadingPanel message="Loading production board…" minHeightClassName="py-20" />
            ) : !isError ? (
              <KitchenKanbanBoard
                plannedOrders={plannedOrders}
                inProgressOrders={inProgressOrders}
                completedOrders={completedOrders}
                activeOrder={activeOrder}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                pendingOrderId={pendingOrderId}
              />
            ) : null}
          </HubListPage.Body>
        </HubListPage>
      )}

      {isCentralKitchen && (
        <CreateProductionOrderModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          ingredients={ingredients}
          loadingIngredients={loadingIngredients}
          bomTargetIds={bomTargetIds}
          onSubmit={handleCreate}
          isSubmitting={createOrderMutation.isPending}
        />
      )}
    </div>
  );
}

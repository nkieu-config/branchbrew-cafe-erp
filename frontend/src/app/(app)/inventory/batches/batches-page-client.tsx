"use client";

import { useCallback, useEffect, useMemo, useState, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { useBranchDetails, useReportWaste } from "@/hooks/domains/useInventoryQueries";
import { useAuth } from "@/context/AuthContext";
import { ButtonLink } from "@/components/ui/button-link";
import { BatchInventoryPanel } from "@/components/inventory/BatchInventoryPanel";
import { BatchWasteDialog } from "@/components/inventory/BatchWasteDialog";
import { ExpiryHeatmapPanel } from "@/components/inventory/ExpiryHeatmapPanel";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import {
  filterBatchInventories,
  hasBatchInventoryFilters,
  summarizeTrackableBatches,
  type BatchWithSupplier,
  type ExpiryFilter,
  type InventoryWithIngredient,
} from "@/lib/filters/batch-filters";
import { isTrackableBatch } from "@/lib/inventory-alerts";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import type { Role } from "@/types/api";

function canReceiveStock(role: Role | undefined) {
  return role === "SUPER_ADMIN" || role === "MANAGER";
}

export default function BatchesPageClient() {
  const searchParams = useSearchParams();
  const batchFilterParam = searchParams.get("filter");
  const expiringFromUrl = batchFilterParam === "expiring";
  const { activeBranchId, user } = useAuth();
  const role = user?.role as Role | undefined;
  const showGrnAction = canReceiveStock(role);

  const {
    data: branchDetails,
    isLoading: loadingBranch,
    isError: branchError,
    error: branchErr,
    refetch: refetchBranch,
    isFetching: branchFetching,
  } = useBranchDetails(activeBranchId ?? undefined);
  const inventories: InventoryWithIngredient[] = branchDetails?.inventories || [];
  const batches: BatchWithSupplier[] = branchDetails?.inventoryBatches || [];
  const trackableBatches = useMemo(() => batches.filter(isTrackableBatch), [batches]);

  const reportWasteMutation = useReportWaste();

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>(
    expiringFromUrl ? "expiring" : "ALL",
  );

  useEffect(() => {
    if (batchFilterParam === "expiring") setExpiryFilter("expiring");
  }, [batchFilterParam]);

  const [wasteTarget, setWasteTarget] = useState<{
    batchId: number;
    ingredientId: number;
    maxQty: number;
    ingredientName: string;
  } | null>(null);
  const [wasteQty, setWasteQty] = useState("");
  const [wasteReason, setWasteReason] = useState("Expired");
  const [isWasteOpen, setIsWasteOpen] = useState(false);

  const batchSummary = useMemo(
    () => summarizeTrackableBatches(trackableBatches),
    [trackableBatches],
  );

  const filteredInventories = useMemo(
    () =>
      filterBatchInventories(inventories, batches, {
        search: deferredSearch,
        expiryFilter,
      }),
    [inventories, deferredSearch, expiryFilter, batches],
  );

  const hasActiveFilters = hasBatchInventoryFilters({ search, expiryFilter });

  const openWasteDialog = useCallback(
    (batchId: number, ingredientId: number, maxQty: number, ingredientName: string) => {
      setWasteTarget({ batchId, ingredientId, maxQty, ingredientName });
      setWasteQty(String(maxQty));
      setWasteReason("Expired");
      setIsWasteOpen(true);
    },
    [],
  );

  const handleWasteSubmit = async () => {
    if (!wasteTarget || !activeBranchId) return;
    const qty = Number(wasteQty);
    if (isNaN(qty) || qty <= 0 || qty > wasteTarget.maxQty) {
      toast.error(`Enter a quantity between 0 and ${wasteTarget.maxQty}`);
      return;
    }
    if (!wasteReason.trim()) {
      toast.error("Please enter a reason");
      return;
    }
    try {
      await reportWasteMutation.mutateAsync({
        branchId: activeBranchId,
        data: {
          batchId: wasteTarget.batchId,
          ingredientId: wasteTarget.ingredientId,
          quantity: qty,
          reason: wasteReason.trim(),
        },
      });
      toast.success("Waste reported successfully.");
      setIsWasteOpen(false);
      setWasteTarget(null);
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
    }
  };

  const resetFilters = useCallback(() => {
    setSearch("");
    setExpiryFilter("ALL");
  }, []);

  if (!activeBranchId) {
    return (
      <BranchEmptyState description="Select a branch in the top bar to manage batches and expiry." />
    );
  }

  return (
    <div className="w-full space-y-5">
      {showGrnAction && (
        <div className="flex justify-end">
          <ButtonLink href="/inventory/stock-in" className={hubCtaClassName("inventory")}>
            <ArrowDownToLine className="w-4 h-4 mr-2" aria-hidden />
            Receive stock
          </ButtonLink>
        </div>
      )}

      <BatchWasteDialog
        open={isWasteOpen}
        onOpenChange={setIsWasteOpen}
        ingredientName={wasteTarget?.ingredientName ?? null}
        maxQty={wasteTarget?.maxQty ?? null}
        quantity={wasteQty}
        onQuantityChange={setWasteQty}
        reason={wasteReason}
        onReasonChange={setWasteReason}
        onSubmit={() => void handleWasteSubmit()}
        isPending={reportWasteMutation.isPending}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1">
          <ExpiryHeatmapPanel batches={batches} loading={loadingBranch} />
        </div>

        <BatchInventoryPanel
          inventories={inventories}
          filteredInventories={filteredInventories}
          batches={batches}
          batchSummary={batchSummary}
          search={search}
          onSearchChange={setSearch}
          expiryFilter={expiryFilter}
          onExpiryFilterChange={setExpiryFilter}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
          loading={loadingBranch}
          isError={branchError}
          error={branchErr}
          isFetching={branchFetching}
          onRefetch={() => void refetchBranch()}
          onReportWaste={openWasteDialog}
        />
      </div>
    </div>
  );
}

"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import type { StockTransfersPanelHandle } from "@/components/inventory/stock-transfers-panel-handle";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { Plus } from "lucide-react";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { inventorySectionPanelClassName } from "@/lib/theme/stock";

const StockTransfersPanel = dynamic(
  () =>
    import("@/components/inventory/StockTransfersPanel").then((m) => m.StockTransfersPanel),
  { ssr: false, loading: () => <PageSkeleton /> },
);

export default function TransfersPageClient() {
  const panelRef = useRef<StockTransfersPanelHandle>(null);
  const { activeBranchId } = useAuth();

  if (!activeBranchId) {
    return (
      <BranchEmptyState description="Select a branch in the top bar to request and manage stock transfers." />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          className={hubCtaClassName("inventory")}
          onClick={() => panelRef.current?.openCreate()}
        >
          <Plus className="w-4 h-4 mr-2" aria-hidden />
          Request transfer
        </Button>
      </div>
      <div className={inventorySectionPanelClassName()}>
        <StockTransfersPanel ref={panelRef} variant="page" />
      </div>
    </div>
  );
}

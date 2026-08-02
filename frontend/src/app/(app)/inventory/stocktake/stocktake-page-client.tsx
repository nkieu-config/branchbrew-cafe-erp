"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnsType } from "antd/es/table";
import { ClipboardList, Plus, Scale, Loader2 } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import {
  StatusBadge,
  stockCountStatusTone,
  formatStatusLabel,
} from "@/components/shared/status-badge";
import { FormModal } from "@/components/shared/form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import {
  useBranchInventory,
  useCreateStockAdjustment,
  useCreateStockCount,
  useStockAdjustments,
  useStockCounts,
} from "@/hooks/domains/useInventoryQueries";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/intl-date";
import { formatQuantity } from "@/lib/money";
import { COL_WIDTH } from "@/lib/theme/data-table";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import {
  formFieldInsetClassName,
  formSelectContentClassName,
  inventorySectionPanelClassName,
} from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import type { BranchInventory, StockAdjustment, StockCount } from "@/types/api";

type AdjustmentForm = {
  ingredientId: number;
  quantity: string;
  direction: "DECREASE" | "INCREASE";
  reason: "DAMAGE" | "CORRECTION";
  notes: string;
};

const EMPTY_ADJUSTMENT: AdjustmentForm = {
  ingredientId: 0,
  quantity: "",
  direction: "DECREASE",
  reason: "DAMAGE",
  notes: "",
};

export default function StocktakePageClient() {
  const router = useRouter();
  const { activeBranchId, user } = useAuth();
  const branchId = activeBranchId ? Number(activeBranchId) : undefined;
  const isManagerOrAdmin =
    user?.role === "SUPER_ADMIN" || user?.role === "MANAGER";

  const [createOpen, setCreateOpen] = useState(false);
  const [isBlind, setIsBlind] = useState(false);
  const [notes, setNotes] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState<AdjustmentForm>(EMPTY_ADJUSTMENT);

  const {
    data: counts = [],
    isLoading: countsLoading,
  } = useStockCounts(branchId);
  const { data: adjustments = [], isLoading: adjustmentsLoading } =
    useStockAdjustments(branchId);
  const { data: inventory = [], isLoading: loadingInventory } = useBranchInventory(branchId) as {
    data?: BranchInventory[];
    isLoading: boolean;
  };

  const createCount = useCreateStockCount();
  const createAdjustment = useCreateStockAdjustment();

  const countColumns = useMemo(
    () =>
      [
        {
          title: "Count",
          key: "id",
          width: 110,
          render: (_: unknown, row: StockCount) => (
            <span className={cn("font-mono text-sm", text.primary)}>
              #{row.id}
              {row.isBlind ? (
                <span className={cn("ml-2 text-xs", text.muted)}>blind</span>
              ) : null}
            </span>
          ),
        },
        {
          title: "Status",
          dataIndex: "status",
          key: "status",
          width: COL_WIDTH.status,
          render: (status: StockCount["status"]) => (
            <StatusBadge tone={stockCountStatusTone(status)}>{formatStatusLabel(status)}</StatusBadge>
          ),
        },
        {
          title: "Started",
          dataIndex: "createdAt",
          key: "createdAt",
          responsive: ["md"],
          render: (v: string) => (
            <span className={cn("tabular-nums text-sm", text.subtle)}>
              {formatDateTime(v)}
            </span>
          ),
        },
        {
          title: "Items",
          key: "lines",
          width: 90,
          align: "right" as const,
          responsive: ["sm"],
          render: (_: unknown, row: StockCount) => (
            <span className={cn("tabular-nums text-sm", text.subtle)}>
              {row._count?.lines ?? "—"}
            </span>
          ),
        },
        {
          title: "By",
          key: "createdBy",
          responsive: ["lg"],
          render: (_: unknown, row: StockCount) => (
            <span className={text.secondary}>{row.createdBy?.name ?? "—"}</span>
          ),
        },
        {
          title: "Approved by",
          key: "approvedBy",
          responsive: ["lg"],
          render: (_: unknown, row: StockCount) => (
            <span className={text.secondary}>{row.approvedBy?.name ?? "—"}</span>
          ),
        },
      ] as ColumnsType<StockCount>,
    [],
  );

  const adjustmentColumns = useMemo(
    () =>
      [
        {
          title: "Date",
          dataIndex: "createdAt",
          key: "createdAt",
          width: 150,
          responsive: ["md"],
          render: (v: string) => (
            <span className={cn("tabular-nums text-sm", text.subtle)}>
              {formatDateTime(v)}
            </span>
          ),
        },
        {
          title: "Ingredient",
          key: "ingredient",
          render: (_: unknown, row: StockAdjustment) => (
            <span className={cn("font-medium", text.primary)}>
              {row.ingredient?.name ?? `#${row.ingredientId}`}
            </span>
          ),
        },
        {
          title: "Δ Qty",
          dataIndex: "quantityDelta",
          key: "quantityDelta",
          align: "right" as const,
          width: 110,
          render: (delta: number, row: StockAdjustment) => (
            <span
              className={cn(
                "font-mono tabular-nums text-sm",
                delta < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {delta > 0 ? "+" : ""}
              {formatQuantity(delta)}
              {row.ingredient?.unit ? (
                <span className={cn("ml-1 text-xs", text.muted)}>
                  {row.ingredient.unit}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          title: "Reason",
          dataIndex: "reason",
          key: "reason",
          width: 150,
          render: (reason: StockAdjustment["reason"], row: StockAdjustment) => (
            <span className={text.secondary}>
              {reason === "COUNT_VARIANCE" && row.stockCountId
                ? `Count #${row.stockCountId}`
                : reason.toLowerCase().replace("_", " ")}
            </span>
          ),
        },
        {
          title: "By",
          key: "createdBy",
          responsive: ["lg"],
          render: (_: unknown, row: StockAdjustment) => (
            <span className={text.secondary}>{row.createdBy?.name ?? "—"}</span>
          ),
        },
      ] as ColumnsType<StockAdjustment>,
    [],
  );

  if (!branchId) {
    return (
      <BranchEmptyState description="Select a branch in the top bar to run stock counts and adjustments." />
    );
  }

  const hasOpenCount = counts.some(
    (c: StockCount) => c.status === "DRAFT" || c.status === "SUBMITTED",
  );

  const handleCreate = async () => {
    try {
      const created = await createCount.mutateAsync({
        branchId,
        isBlind,
        notes,
      });
      setCreateOpen(false);
      setIsBlind(false);
      setNotes("");
      toast.success(`Stock count #${created.id} started`);
      router.push(`/inventory/stocktake/${created.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to start stock count"));
    }
  };

  const handleAdjust = async () => {
    const qty = Number(adjustForm.quantity);
    if (!adjustForm.ingredientId || !qty || qty <= 0) {
      toast.error("Select an ingredient and enter a quantity above zero.");
      return;
    }
    try {
      await createAdjustment.mutateAsync({
        branchId,
        ingredientId: adjustForm.ingredientId,
        quantityDelta: adjustForm.direction === "DECREASE" ? -qty : qty,
        reason: adjustForm.reason,
        notes: adjustForm.notes,
      });
      setAdjustOpen(false);
      setAdjustForm(EMPTY_ADJUSTMENT);
      toast.success("Stock adjustment recorded");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to record adjustment"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        {isManagerOrAdmin ? (
          <Button variant="outline" onClick={() => setAdjustOpen(true)}>
            <Scale className="mr-2 h-4 w-4" aria-hidden />
            Manual adjustment
          </Button>
        ) : null}
        <Button
          className={hubCtaClassName("inventory")}
          disabled={hasOpenCount}
          title={hasOpenCount ? "Finish or cancel the open count first" : undefined}
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Start stock count
        </Button>
      </div>

      <div className={inventorySectionPanelClassName()}>
        <h2 className={cn("mb-4 text-base font-semibold", text.primary)}>
          Stock counts
        </h2>
        <DataTable
          hideBorders
          loading={countsLoading}
          rowKey="id"
          dataSource={counts}
          columns={countColumns}
          emptyDescription="No stock counts yet — start one to reconcile physical stock with the system."
          onRow={(row: StockCount) => ({
            onClick: () => router.push(`/inventory/stocktake/${row.id}`),
            style: { cursor: "pointer" },
          })}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
        />
      </div>

      <div className={inventorySectionPanelClassName()}>
        <h2 className={cn("mb-4 text-base font-semibold", text.primary)}>
          Adjustment history
        </h2>
        <DataTable
          hideBorders
          loading={adjustmentsLoading}
          rowKey="id"
          dataSource={adjustments}
          columns={adjustmentColumns}
          emptyDescription="No stock adjustments recorded for this branch yet."
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
        />
      </div>

      <FormModal
        title="Start stock count"
        icon={ClipboardList}
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        width={480}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="stocktake-blind" className={text.secondary}>
                Blind count
              </Label>
              <p className={cn("mt-1 text-xs", text.muted)}>
                Hide system stock while counting so staff record what they
                actually see.
              </p>
            </div>
            <Switch
              id="stocktake-blind"
              checked={isBlind}
              onCheckedChange={setIsBlind}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stocktake-notes" className={text.secondary}>
              Notes (optional)
            </Label>
            <Input
              id="stocktake-notes"
              className={formFieldInsetClassName("h-11")}
              value={notes}
              placeholder="e.g. Month-end full count"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className={hubCtaClassName("inventory")}
              disabled={createCount.isPending}
              onClick={() => void handleCreate()}
            >
              {createCount.isPending ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                  Starting…
                </>
              ) : (
                "Start count"
              )}
            </Button>
          </div>
        </div>
      </FormModal>

      <FormModal
        title="Manual stock adjustment"
        icon={Scale}
        isOpen={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        width={480}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adjust-ingredient" className={text.secondary}>
              Ingredient
            </Label>
            <Select
              value={
                adjustForm.ingredientId === 0
                  ? ""
                  : String(adjustForm.ingredientId)
              }
              onValueChange={(value) => {
                if (value == null) return;
                setAdjustForm((prev) => ({
                  ...prev,
                  ingredientId: Number(value),
                }));
              }}
            >
              <SelectTrigger
                id="adjust-ingredient"
                className={formFieldInsetClassName("h-11 w-full")}
                loading={loadingInventory}
              >
                <SelectValue
                  placeholder={loadingInventory ? "Loading ingredients…" : "Select ingredient"}
                />
              </SelectTrigger>
              <SelectContent className={formSelectContentClassName()}>
                {inventory.map((row) => (
                  <SelectItem key={row.ingredientId} value={String(row.ingredientId)}>
                    {row.ingredient?.name ?? `#${row.ingredientId}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="adjust-direction" className={text.secondary}>
                Direction
              </Label>
              <Select
                value={adjustForm.direction}
                onValueChange={(value) => {
                  if (value == null) return;
                  setAdjustForm((prev) => ({
                    ...prev,
                    direction: value as AdjustmentForm["direction"],
                  }));
                }}
              >
                <SelectTrigger
                  id="adjust-direction"
                  className={formFieldInsetClassName("h-11 w-full")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={formSelectContentClassName()}>
                  <SelectItem value="DECREASE">Decrease stock</SelectItem>
                  <SelectItem value="INCREASE">Increase stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-quantity" className={text.secondary}>
                Quantity
              </Label>
              <Input
                id="adjust-quantity"
                type="number"
                min="0"
                step="0.01"
                className={formFieldInsetClassName("h-11")}
                value={adjustForm.quantity}
                onChange={(e) =>
                  setAdjustForm((prev) => ({ ...prev, quantity: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjust-reason" className={text.secondary}>
              Reason
            </Label>
            <Select
              value={adjustForm.reason}
              onValueChange={(value) => {
                if (value == null) return;
                setAdjustForm((prev) => ({
                  ...prev,
                  reason: value as AdjustmentForm["reason"],
                }));
              }}
            >
              <SelectTrigger
                id="adjust-reason"
                className={formFieldInsetClassName("h-11 w-full")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={formSelectContentClassName()}>
                <SelectItem value="DAMAGE">Damage</SelectItem>
                <SelectItem value="CORRECTION">Correction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjust-notes" className={text.secondary}>
              Notes (optional)
            </Label>
            <Input
              id="adjust-notes"
              className={formFieldInsetClassName("h-11")}
              value={adjustForm.notes}
              onChange={(e) =>
                setAdjustForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button
              className={hubCtaClassName("inventory")}
              disabled={createAdjustment.isPending}
              onClick={() => void handleAdjust()}
            >
              {createAdjustment.isPending ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                  Recording…
                </>
              ) : (
                "Record adjustment"
              )}
            </Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}

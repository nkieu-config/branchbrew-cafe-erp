"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnsType } from "antd/es/table";
import { ArrowLeft, Check, Loader2, Save, Send, X } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatusBadge,
  stockCountStatusTone,
  formatStatusLabel,
} from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import {
  useApproveStockCount,
  useCancelStockCount,
  useStockCount,
  useSubmitStockCount,
  useUpdateStockCountLines,
} from "@/hooks/domains/useInventoryQueries";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/intl-date";
import { formatMoney, formatQuantity } from "@/lib/money";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { inventorySectionPanelClassName } from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import type { StockCount, StockCountLine } from "@/types/api";

type DetailedStockCount = StockCount & { lines: StockCountLine[] };

function varianceOf(line: StockCountLine): number | null {
  if (line.countedQty == null || line.expectedQty == null) return null;
  return Number(line.countedQty) - Number(line.expectedQty);
}

export default function StockCountDetailClient({ id }: { id: number }) {
  const router = useRouter();
  const { activeBranchId, user } = useAuth();
  const branchId = activeBranchId ? Number(activeBranchId) : undefined;
  const isManagerOrAdmin =
    user?.role === "SUPER_ADMIN" || user?.role === "MANAGER";

  const {
    data: count,
    isLoading,
    isError,
    error,
  } = useStockCount(id) as {
    data?: DetailedStockCount;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
  };

  const updateLines = useUpdateStockCountLines();
  const submitCount = useSubmitStockCount();
  const approveCount = useApproveStockCount();
  const cancelCount = useCancelStockCount();

  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [confirmAction, setConfirmAction] = useState<
    "submit" | "approve" | "cancel" | null
  >(null);

  useEffect(() => {
    if (!count) return;
    const next: Record<number, string> = {};
    for (const line of count.lines) {
      next[line.ingredientId] =
        line.countedQty == null ? "" : String(line.countedQty);
    }
    setDrafts(next);
  }, [count]);

  const isDraft = count?.status === "DRAFT";
  const isSubmitted = count?.status === "SUBMITTED";

  const dirtyLines = useMemo(() => {
    if (!count) return [];
    return count.lines
      .filter((line) => {
        const draft = drafts[line.ingredientId];
        if (draft == null || draft === "") return false;
        return Number(draft) !== Number(line.countedQty ?? NaN);
      })
      .map((line) => ({
        ingredientId: line.ingredientId,
        countedQty: Number(drafts[line.ingredientId]),
      }))
      .filter((line) => Number.isFinite(line.countedQty) && line.countedQty >= 0);
  }, [count, drafts]);

  const totals = useMemo(() => {
    if (!count) return { counted: 0, varianceValue: 0, varianceLines: 0 };
    let counted = 0;
    let varianceValue = 0;
    let varianceLines = 0;
    for (const line of count.lines) {
      if (line.countedQty != null) counted += 1;
      const variance = varianceOf(line);
      if (variance != null && variance !== 0) {
        varianceLines += 1;
        varianceValue += variance * Number(line.ingredient?.costPerUnit ?? 0);
      }
    }
    return { counted, varianceValue, varianceLines };
  }, [count]);

  const columns = useMemo(() => {
    const cols: ColumnsType<StockCountLine> = [
      {
        title: "Ingredient",
        key: "ingredient",
        render: (_: unknown, row: StockCountLine) => (
          <div className="min-w-0">
            <span className={cn("font-medium", text.primary)}>
              {row.ingredient?.name ?? `#${row.ingredientId}`}
            </span>
            {row.ingredient?.unit ? (
              <span className={cn("ml-2 text-xs", text.muted)}>
                {row.ingredient.unit}
              </span>
            ) : null}
          </div>
        ),
      },
    ];

    if (!(count?.isBlind && isDraft)) {
      cols.push({
        title: isDraft ? "System stock" : "Expected",
        key: "expected",
        align: "right" as const,
        width: 130,
        render: (_: unknown, row: StockCountLine) => {
          const value = isDraft ? row.currentStock : row.expectedQty;
          return (
            <span className={cn("font-mono tabular-nums text-sm", text.subtle)}>
              {value == null ? "—" : formatQuantity(value)}
            </span>
          );
        },
      });
    }

    cols.push({
      title: "Counted",
      key: "counted",
      align: "right" as const,
      width: 150,
      render: (_: unknown, row: StockCountLine) =>
        isDraft ? (
          <Input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            aria-label={`Counted quantity for ${row.ingredient?.name ?? row.ingredientId}`}
            className="h-9 w-28 text-right font-mono tabular-nums ml-auto"
            value={drafts[row.ingredientId] ?? ""}
            placeholder="—"
            onChange={(e) =>
              setDrafts((prev) => ({
                ...prev,
                [row.ingredientId]: e.target.value,
              }))
            }
          />
        ) : (
          <span className={cn("font-mono tabular-nums text-sm", text.subtle)}>
            {row.countedQty == null ? "—" : formatQuantity(row.countedQty)}
          </span>
        ),
    });

    if (!isDraft) {
      cols.push(
        {
          title: "Variance",
          key: "variance",
          align: "right" as const,
          width: 120,
          render: (_: unknown, row: StockCountLine) => {
            const variance = varianceOf(row);
            if (variance == null)
              return <span className={text.muted}>not counted</span>;
            if (variance === 0)
              return (
                <span className={cn("font-mono tabular-nums text-sm", text.muted)}>
                  0.00
                </span>
              );
            return (
              <span
                className={cn(
                  "font-mono tabular-nums text-sm",
                  variance < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {variance > 0 ? "+" : ""}
                {formatQuantity(variance)}
              </span>
            );
          },
        },
        {
          title: "Value",
          key: "value",
          align: "right" as const,
          width: 120,
          responsive: ["md"],
          render: (_: unknown, row: StockCountLine) => {
            const variance = varianceOf(row);
            if (variance == null || variance === 0)
              return <span className={text.muted}>—</span>;
            const value = variance * Number(row.ingredient?.costPerUnit ?? 0);
            return (
              <span
                className={cn(
                  "font-mono tabular-nums text-sm",
                  value < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {formatMoney(value)}
              </span>
            );
          },
        },
      );
    }

    return cols;
  }, [count?.isBlind, isDraft, drafts]);

  if (!branchId) {
    router.replace("/inventory/stocktake");
    return null;
  }

  if (isError) {
    return (
      <div className={inventorySectionPanelClassName()}>
        <p className={text.secondary}>
          {getErrorMessage(error, "Failed to load stock count")}
        </p>
      </div>
    );
  }

  const runMutation = async (
    action: "save" | "submit" | "approve" | "cancel",
  ) => {
    try {
      if (action === "save") {
        await updateLines.mutateAsync({ id, branchId, lines: dirtyLines });
        toast.success("Counted quantities saved");
      } else if (action === "submit") {
        if (dirtyLines.length > 0) {
          await updateLines.mutateAsync({ id, branchId, lines: dirtyLines });
        }
        await submitCount.mutateAsync({ id, branchId });
        toast.success("Stock count submitted for approval");
      } else if (action === "approve") {
        await approveCount.mutateAsync({ id, branchId });
        toast.success("Stock count approved — variances applied to stock");
      } else {
        await cancelCount.mutateAsync({ id, branchId });
        toast.success("Stock count cancelled");
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Action failed"));
    } finally {
      setConfirmAction(null);
    }
  };

  const busy =
    updateLines.isPending ||
    submitCount.isPending ||
    approveCount.isPending ||
    cancelCount.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/inventory/stocktake")}>
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
            Back
          </Button>
          <h2 className={cn("text-base font-semibold", text.primary)}>
            Stock count #{id}
          </h2>
          {count ? (
            <StatusBadge tone={stockCountStatusTone(count.status)}>
              {formatStatusLabel(count.status)}
            </StatusBadge>
          ) : isLoading ? (
            <Skeleton className="h-6 w-24 rounded-full" />
          ) : null}
          {count?.isBlind ? (
            <StatusBadge tone="purple">Blind</StatusBadge>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {isLoading && !count ? (
            <>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-8 w-36" />
            </>
          ) : null}
          {isDraft ? (
            <>
              <Button
                variant="outline"
                disabled={busy || dirtyLines.length === 0}
                onClick={() => void runMutation("save")}
              >
                <Save className="mr-2 h-4 w-4" aria-hidden />
                Save
              </Button>
              <Button
                className={hubCtaClassName("inventory")}
                disabled={busy}
                onClick={() => setConfirmAction("submit")}
              >
                <Send className="mr-2 h-4 w-4" aria-hidden />
                Submit for approval
              </Button>
            </>
          ) : null}
          {isSubmitted && isManagerOrAdmin ? (
            <Button
              className={hubCtaClassName("inventory")}
              disabled={busy}
              onClick={() => setConfirmAction("approve")}
            >
              {approveCount.isPending ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : (
                <Check className="mr-2 h-4 w-4" aria-hidden />
              )}
              Approve &amp; apply
            </Button>
          ) : null}
          {(isDraft || isSubmitted) && isManagerOrAdmin ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmAction("cancel")}
            >
              <X className="mr-2 h-4 w-4" aria-hidden />
              Cancel count
            </Button>
          ) : null}
        </div>
      </div>

      {count ? (
        <div className={cn("flex flex-wrap gap-x-6 gap-y-1 text-sm", text.muted)}>
          <span>
            Started {formatDateTime(count.createdAt)} by {count.createdBy?.name ?? "—"}
          </span>
          {count.submittedAt ? (
            <span>Submitted {formatDateTime(count.submittedAt)}</span>
          ) : null}
          {count.approvedAt ? (
            <span>
              Approved {formatDateTime(count.approvedAt)} by {count.approvedBy?.name ?? "—"}
            </span>
          ) : null}
          <span>
            {totals.counted}/{count.lines.length} items counted
          </span>
          {!isDraft && totals.varianceLines > 0 ? (
            <span
              className={cn(
                "font-medium",
                totals.varianceValue < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {totals.varianceLines} variance{totals.varianceLines === 1 ? "" : "s"} ·{" "}
              {formatMoney(totals.varianceValue)}
            </span>
          ) : null}
          {count.notes ? <span>“{count.notes}”</span> : null}
        </div>
      ) : isLoading ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <Skeleton className="h-5 w-72 max-w-full" />
          <Skeleton className="h-5 w-40" />
        </div>
      ) : null}

      <div className={inventorySectionPanelClassName()}>
        <DataTable
          hideBorders
          loading={isLoading}
          rowKey="id"
          dataSource={count?.lines ?? []}
          columns={columns}
          emptyDescription="No lines on this stock count."
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
        />
      </div>

      <ConfirmDialog
        open={confirmAction === "submit"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Submit stock count?"
        description="Submitting snapshots today's system stock as the expected quantity. Lines without a counted quantity are skipped."
        confirmLabel="Submit"
        onConfirm={() => void runMutation("submit")}
        loading={busy}
      />
      <ConfirmDialog
        open={confirmAction === "approve"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Approve and apply variances?"
        description="Stock will be adjusted to the counted quantities and the variance value will post to the general ledger. This cannot be undone."
        confirmLabel="Approve"
        onConfirm={() => void runMutation("approve")}
        loading={busy}
      />
      <ConfirmDialog
        open={confirmAction === "cancel"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Cancel this stock count?"
        description="Counted quantities will be discarded and no stock will change."
        confirmLabel="Cancel count"
        destructive
        onConfirm={() => void runMutation("cancel")}
        loading={busy}
      />
    </div>
  );
}

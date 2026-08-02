"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Calendar, Popover, Radio, Select } from "antd";
import { CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AntdProvider } from "@/providers/AntdProvider";
import { differenceInDays } from "date-fns";
import { formatIsoDate } from "@/lib/intl-date";
import { isTrackableBatch } from "@/lib/inventory-alerts";
import {
  expiryCalendarShellClassName,
  expiryCalendarFrameClassName,
  expiryCellClassName,
  expiryHeatmapHeaderClassName,
  expiryHeatmapHeaderIconClassName,
  expiryHeatmapPanelClassName,
  expiryHeatmapPopoverClassName,
  expiryLegendDotClassName,
  expiryLegendItemClassName,
  expiryLegendRowClassName,
  expiryPopoverQtyClassName,
  expiryUrgency,
} from "@/lib/theme/stock";
import { text } from "@/lib/theme/surface";
import { typeUiLabelClassName } from "@/lib/theme/typography";
import { cn } from "@/lib/utils";
import type { Dayjs } from "dayjs";
import type { InventoryBatch, Ingredient, PurchaseOrder, Supplier } from "@/types/api";

type BatchWithSupplier = InventoryBatch & {
  purchaseOrder?: PurchaseOrder & { supplier?: Supplier };
  ingredient?: Ingredient;
};

type ExpiryHeatmapPanelProps = {
  batches: BatchWithSupplier[];
  loading?: boolean;
};

function batchIngredientLabel(batch: BatchWithSupplier) {
  return batch.ingredient?.name ?? `#${batch.ingredientId}`;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const LEGEND_ITEMS = [
  { urgency: "expired" as const, label: "Expired" },
  { urgency: "critical" as const, label: "0–1d" },
  { urgency: "warning" as const, label: "2–3d" },
  { urgency: "notice" as const, label: "4–7d" },
  { urgency: "safe" as const, label: "8d+" },
];

export function ExpiryHeatmapPanel({ batches, loading = false }: ExpiryHeatmapPanelProps) {
  const { resolvedTheme } = useTheme();
  const themeKey = resolvedTheme ?? "light";
  const [calendarMode, setCalendarMode] = useState<"month" | "year">("month");
  const [openDate, setOpenDate] = useState<string | null>(null);

  useEffect(() => {
    setOpenDate(null);
  }, [themeKey]);

  const trackableBatches = batches.filter(isTrackableBatch);

  const expiryMap = trackableBatches.reduce(
    (acc: Record<string, BatchWithSupplier[]>, batch: BatchWithSupplier) => {
      if (!batch.expiryDate) return acc;
      const dateStr = formatIsoDate(batch.expiryDate);
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(batch);
      return acc;
    },
    {},
  );

  const dateCellRender = (value: Dayjs) => {
    const dateStr = value.format("YYYY-MM-DD");
    const expiringBatches = expiryMap[dateStr];
    if (!expiringBatches) return null;

    const daysLeft = differenceInDays(value.toDate(), new Date());
    const urgency = expiryUrgency(daysLeft);
    const label = `${expiringBatches.length} item${expiringBatches.length === 1 ? "" : "s"} expiring`;

    const popoverContent = (
      <div className="max-w-xs space-y-1.5">
        {expiringBatches.map((b) => (
          <div key={b.id} className="flex justify-between items-center gap-4 text-sm">
            <span className={typeUiLabelClassName(text.secondary)}>{batchIngredientLabel(b)}</span>
            <span className={expiryPopoverQtyClassName()}>
              {b.quantity} {b.ingredient?.unit ?? ""}
            </span>
          </div>
        ))}
      </div>
    );

    return (
      <Popover
        key={`${dateStr}-${themeKey}`}
        content={popoverContent}
        title={null}
        trigger="click"
        open={openDate === dateStr}
        onOpenChange={(open) => setOpenDate(open ? dateStr : null)}
        overlayClassName={expiryHeatmapPopoverClassName()}
        destroyOnHidden
      >
        <button
          type="button"
          className={cn(expiryCellClassName(urgency), "border-0 w-full")}
          aria-label={label}
        >
          {expiringBatches.length}
        </button>
      </Popover>
    );
  };

  return (
    <AntdProvider>
    <div className={expiryHeatmapPanelClassName()}>
      <div className={expiryHeatmapHeaderClassName()}>
        <CalendarDays className={expiryHeatmapHeaderIconClassName()} aria-hidden />
        Expiry calendar
      </div>
      {loading ? (
        <div className="px-4 pb-4" role="status" aria-live="polite">
          <span className="sr-only">Loading expiry calendar</span>
          <Skeleton className="h-[320px] w-full rounded-lg" />
          <Skeleton className="mt-3 h-6 w-full rounded-lg" />
        </div>
      ) : (
      <div className="px-4 pb-4">
        <Calendar
          key={themeKey}
          fullscreen={false}
          mode={calendarMode}
          headerRender={({ value, type, onChange, onTypeChange }) => {
            const year = value.year();
            const yearOptions = Array.from({ length: 5 }, (_, i) => {
              const y = year - 2 + i;
              return { value: y, label: String(y) };
            });
            const monthOptions = MONTH_LABELS.map((label, index) => ({
              value: index,
              label,
            }));
            return (
              <div className="flex items-center justify-end gap-2 pb-2">
                <Select
                  size="small"
                  aria-label="Calendar year"
                  value={year}
                  options={yearOptions}
                  onChange={(y) => onChange(value.clone().year(y))}
                  popupMatchSelectWidth={false}
                />
                {type === "month" && (
                  <Select
                    size="small"
                    aria-label="Calendar month"
                    value={value.month()}
                    options={monthOptions}
                    onChange={(m) => onChange(value.clone().month(m))}
                    popupMatchSelectWidth={false}
                  />
                )}
                <Radio.Group
                  size="small"
                  value={type}
                  onChange={(e) => onTypeChange(e.target.value as "month" | "year")}
                >
                  <Radio.Button value="month">Month</Radio.Button>
                  <Radio.Button value="year">Year</Radio.Button>
                </Radio.Group>
              </div>
            );
          }}
          onPanelChange={(_, mode) => {
            setCalendarMode(mode === "year" ? "month" : mode);
          }}
          cellRender={(current, info) => {
            if (info.type === "date") return dateCellRender(current);
            return info.originNode;
          }}
          className={expiryCalendarShellClassName(expiryCalendarFrameClassName())}
        />
        <div className={expiryLegendRowClassName("mt-3 pt-3 border-t border-[var(--table-row-border)]")}>
          {LEGEND_ITEMS.map(({ urgency, label }) => (
            <span key={urgency} className={expiryLegendItemClassName()}>
              <span className={expiryLegendDotClassName(urgency)} aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </div>
      )}
    </div>
    </AntdProvider>
  );
}

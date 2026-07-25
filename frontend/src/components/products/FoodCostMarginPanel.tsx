"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/money";
import { foodCostVariance } from "@/lib/food-cost-margin";
import { inlineLinkClassName } from "@/lib/theme/hub-primitives";
import { foodCostStatusClassName } from "@/lib/theme/hub-products";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import type { FoodCostActual } from "@/types/api";
import { foodCostStatus } from "@/lib/food-cost";

type FoodCostMarginPanelProps = {
  actual?: FoodCostActual;
  theoreticalAvgPercent: number;
  isLoading?: boolean;
};

export function FoodCostMarginPanel({
  actual,
  theoreticalAvgPercent,
  isLoading = false,
}: FoodCostMarginPanelProps) {
  if (isLoading || !actual || actual.orderCount === 0 || theoreticalAvgPercent <= 0) {
    return null;
  }

  const margin = foodCostVariance(actual, theoreticalAvgPercent);
  const actualStatus = foodCostStatus(margin.actualFoodCostPercent);
  const theoreticalStatus = foodCostStatus(theoreticalAvgPercent);
  const varianceUp = margin.variancePercent > 0;

  return (
    <section
      className="rounded-xl bg-[var(--table-container-bg)]/60 px-4 py-3 text-sm"
      aria-label="Actual vs theoretical food cost"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className={cn("font-medium", text.primary)}>Actual vs recipe</span>
        <Link href="/pos/orders" className={inlineLinkClassName("text-xs")}>
          View orders
        </Link>
      </div>
      <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums", text.secondary)}>
        <span>
          Recipe{" "}
          <span className={foodCostStatusClassName(theoreticalStatus)}>
            {theoreticalAvgPercent.toFixed(1)}%
          </span>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          Actual{" "}
          <span className={foodCostStatusClassName(actualStatus)}>
            {margin.actualFoodCostPercent.toFixed(1)}%
          </span>
        </span>
        <span aria-hidden="true">·</span>
        <span className={varianceUp ? "text-[var(--metric-red)]" : "text-[var(--metric-emerald)]"}>
          {margin.variancePercent > 0 ? "+" : ""}
          {margin.variancePercent.toFixed(1)}% variance
        </span>
        <span className={cn("text-xs", text.muted)}>
          ({margin.orderCount} orders · COGS {formatCurrency(margin.totalCogs)})
        </span>
      </p>
    </section>
  );
}

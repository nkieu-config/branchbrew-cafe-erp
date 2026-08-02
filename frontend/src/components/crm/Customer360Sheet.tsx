"use client";

import { useCustomer360 } from "@/hooks/domains/useCrmQueries";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/intl-date";
import { StatusBadge } from "@/components/shared/status-badge";
import { TierIcon } from "@/components/crm/TierIcon";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Customer360, Customer360Order } from "@/types/api";
import {
  crmFavoriteChipClassName,
  crmFavoriteCountClassName,
  crmInsightPanelClassName,
  crmMaxTierBadgeClassName,
  crmOrderCardClassName,
  crmProgressClassName,
  crmSectionLabelClassName,
  crmSheetContentClassName,
  customerTierTone,
} from "@/lib/theme/hub-crm";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import { QueryLoadingPanel } from "@/components/shared/query-states";

type Customer360SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number | null;
};

function churnLabel(risk: string) {
  switch (risk?.toUpperCase()) {
    case "LOW":
      return "Active";
    case "MEDIUM":
      return "At risk";
    default:
      return "High churn risk";
  }
}

function Customer360Profile({ data }: { data: Customer360 }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("tabular-nums text-sm", text.muted)}>{data.customer.phone}</p>
        </div>
        <StatusBadge tone={customerTierTone(data.customer.tier)} className="shrink-0">
          <span className="inline-flex items-center gap-1">
            <TierIcon tier={data.customer.tier} />
            {data.customer.tier}
          </span>
        </StatusBadge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className={crmInsightPanelClassName()}>
          <p className={crmSectionLabelClassName("mb-1")}>Retention</p>
          <p className={cn("font-medium", text.primary)}>{churnLabel(data.churnRisk)}</p>
          <p className={cn("text-xs mt-0.5", text.muted)}>
            Last order {data.daysSinceLastOrder}d ago
          </p>
        </div>
        <div className={crmInsightPanelClassName()}>
          <p className={crmSectionLabelClassName("mb-1")}>Lifetime spend</p>
          <p className={cn("font-semibold tabular-nums", text.primary)}>
            {formatCurrency(data.lifetimeSpend)}
          </p>
          {data.nextTier !== "MAX" ? (
            <p className={cn("text-xs mt-0.5", text.muted)}>
              {formatCurrency(data.amountToNextTier)} to {data.nextTier}
            </p>
          ) : (
            <p className={cn("text-xs mt-0.5", text.muted)}>Top tier</p>
          )}
        </div>
      </div>

      {data.nextTier !== "MAX" ? (
        <Progress
          value={parseFloat(data.progressPercentage.toFixed(1))}
          className={crmProgressClassName()}
        />
      ) : (
        <p className={crmMaxTierBadgeClassName()}>Maximum tier reached</p>
      )}

      <div>
        <h4 className={crmSectionLabelClassName()}>Favorites</h4>
        {data.favoriteDrinks.length > 0 ? (
          <ul className="space-y-1">
            {data.favoriteDrinks.map((fav, i) => (
              <li key={i} className={crmFavoriteChipClassName()}>
                {fav.name}
                <span className={crmFavoriteCountClassName()}> · {fav.count}x</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn("text-sm", text.muted)}>No orders yet.</p>
        )}
      </div>

      <div>
        <h4 className={crmSectionLabelClassName()}>Recent orders</h4>
        {data.recentOrders?.length > 0 ? (
          <div>
            {data.recentOrders.map((order: Customer360Order) => (
              <div key={order.id} className={crmOrderCardClassName()}>
                <div>
                  <p className={cn("text-sm", text.secondary)}>
                    {formatDate(order.createdAt)}
                  </p>
                  <p className={cn("text-xs", text.muted)}>
                    {order.items?.length ?? 0} items
                  </p>
                </div>
                <span className={cn("tabular-nums font-medium", text.primary)}>
                  {formatCurrency(order.netAmount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className={cn("text-sm", text.muted)}>No orders yet.</p>
        )}
      </div>
    </div>
  );
}

export function Customer360Sheet({ open, onOpenChange, customerId }: Customer360SheetProps) {
  const { data: customer360, isLoading } = useCustomer360(open ? customerId : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={crmSheetContentClassName("w-full sm:max-w-md overflow-y-auto")}>
        <SheetHeader className="mb-4">
          <SheetTitle className="text-xl font-semibold truncate pr-8">
            {customer360?.customer.name ?? "Member profile"}
          </SheetTitle>
        </SheetHeader>

        {isLoading || !customer360 ? (
          <QueryLoadingPanel message="Loading member profile" minHeightClassName="h-48" />
        ) : (
          <Customer360Profile data={customer360} />
        )}
      </SheetContent>
    </Sheet>
  );
}

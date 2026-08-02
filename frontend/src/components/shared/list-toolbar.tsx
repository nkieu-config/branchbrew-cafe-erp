"use client";

import { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataFreshness } from "@/components/shared/data-freshness";
import { decorativeIconClassName } from "@/lib/theme/color-helpers";
import { listToolbarClassName, listToolbarFieldClassName, listToolbarFiltersClassName, listToolbarSearchClassName } from "@/lib/theme/feedback";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

export type ListToolbarFreshness = {
  dataUpdatedAt: number;
  isFetching?: boolean;
  onRefresh?: () => void;
};

type ListToolbarProps = {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchTestId?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  freshness?: ListToolbarFreshness;
  onReset?: () => void;
  showReset?: boolean;
  className?: string;
};

export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  searchTestId,
  filters,
  actions,
  freshness,
  onReset,
  showReset = false,
  className,
}: ListToolbarProps) {
  const hasSearch = onSearchChange != null;

  return (
    <div className={listToolbarClassName(className)}>
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        {hasSearch && (
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className={decorativeIconClassName(
                "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none",
              )}
              aria-hidden
            />
            <Input
              type="search"
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(listToolbarFieldClassName(), listToolbarSearchClassName(), "pl-9")}
              aria-label={searchPlaceholder}
              data-testid={searchTestId}
            />
          </div>
        )}
        {filters && <div className={listToolbarFiltersClassName()}>{filters}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {freshness && (
          <DataFreshness
            dataUpdatedAt={freshness.dataUpdatedAt}
            isFetching={freshness.isFetching}
            onRefresh={freshness.onRefresh}
          />
        )}
        {actions}
        {showReset && onReset && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className={cn("min-h-[44px]", text.secondary)}
          >
            <X className="w-4 h-4 mr-1.5" aria-hidden />
            Reset filters
          </Button>
        )}
      </div>
    </div>
  );
}

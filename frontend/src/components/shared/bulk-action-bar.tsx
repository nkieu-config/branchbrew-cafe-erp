"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

type BulkActionBarProps = {
  selectedCount: number;
  itemLabel: string;
  itemLabelPlural?: string;
  onClear: () => void;
  children: ReactNode;
  className?: string;
};

export function BulkActionBar({
  selectedCount,
  itemLabel,
  itemLabelPlural,
  onClear,
  children,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  const label = selectedCount === 1 ? itemLabel : (itemLabelPlural ?? `${itemLabel}s`);

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      data-testid="bulk-action-bar"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-accent/10 px-4 py-3",
        className,
      )}
    >
      <span className={cn("text-sm font-medium tabular-nums", text.primary)}>
        {selectedCount} {label} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClear}
        className={cn("ml-auto", text.secondary)}
      >
        <X className="mr-1.5 h-4 w-4" aria-hidden />
        Clear
      </Button>
    </div>
  );
}

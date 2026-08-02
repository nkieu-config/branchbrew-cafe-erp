"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";

export const STALE_WARNING_MS = 5 * 60 * 1000;

export function formatFreshness(updatedAt: number, now: number): string {
  if (!updatedAt) return "Not loaded yet";
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (seconds < 45) return "Updated just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours} hr ago`;
  return `Updated ${Math.round(hours / 24)} d ago`;
}

type DataFreshnessProps = {
  dataUpdatedAt: number;
  isFetching?: boolean;
  onRefresh?: () => void;
  className?: string;
};

export function DataFreshness({
  dataUpdatedAt,
  isFetching = false,
  onRefresh,
  className,
}: DataFreshnessProps) {
  const now = useTicker(30_000);
  const isStale = dataUpdatedAt > 0 && now - dataUpdatedAt > STALE_WARNING_MS;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span
        className={cn("text-xs tabular-nums", isStale ? text.primary : text.muted)}
        aria-live="polite"
        data-testid="data-freshness"
      >
        {isFetching ? "Refreshing…" : formatFreshness(dataUpdatedAt, now)}
      </span>
      {onRefresh && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label="Refresh data"
        >
          <RefreshCw
            className={cn(
              "size-3.5",
              isFetching && "animate-spin motion-reduce:animate-none",
            )}
            aria-hidden
          />
        </Button>
      )}
    </div>
  );
}

function useTicker(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

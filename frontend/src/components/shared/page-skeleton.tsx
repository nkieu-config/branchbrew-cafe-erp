import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageSkeletonProps = {
  /** Include the page title block — only when the hub chrome is not already mounted. */
  withHeader?: boolean;
  rows?: number;
  className?: string;
};

/** Placeholder for a hub list page while its route segment loads. */
export function PageSkeleton({ withHeader = false, rows = 6, className }: PageSkeletonProps) {
  return (
    <div
      className={cn("space-y-4", className)}
      role="status"
      aria-live="polite"
      data-testid="page-skeleton"
    >
      <span className="sr-only">Loading page</span>

      {withHeader ? (
        <div className="space-y-2 pb-1">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <Skeleton className="h-4 w-40" />

      <div className="space-y-2 rounded-xl border border-border/60 p-3">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

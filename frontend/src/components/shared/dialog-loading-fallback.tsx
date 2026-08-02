"use client";

import { Loader2 } from "lucide-react";

/** Stand-in overlay for a lazily loaded dialog, so opening one is never silent. */
export function DialogLoadingFallback({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 supports-backdrop-filter:backdrop-blur-xs"
      role="status"
      aria-live="polite"
      data-testid="dialog-loading"
    >
      <span className="sr-only">{label}</span>
      <Loader2
        className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

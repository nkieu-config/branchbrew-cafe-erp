"use client";

import { SegmentError } from "@/components/shared/segment-error";

export default function ProductsSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      error={error}
      reset={reset}
      title="Products unavailable"
      description="The products section hit an error while loading the menu, ingredients or costing. You can retry or return to the dashboard."
    />
  );
}

"use client";

import { SegmentError } from "@/components/shared/segment-error";

export default function InventorySegmentError({
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
      title="Inventory unavailable"
      description="The inventory section hit an error while loading stock levels or movements. You can retry or return to the dashboard."
    />
  );
}

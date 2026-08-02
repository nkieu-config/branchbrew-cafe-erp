"use client";

import { SegmentError } from "@/components/shared/segment-error";

export default function ProcurementSegmentError({
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
      title="Procurement unavailable"
      description="The procurement section hit an error while loading purchase orders or suppliers. You can retry or return to the dashboard."
    />
  );
}

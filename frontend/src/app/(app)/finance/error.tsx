"use client";

import { SegmentError } from "@/components/shared/segment-error";

export default function FinanceSegmentError({
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
      title="Finance unavailable"
      description="The finance section hit an error. Ledger figures shown elsewhere are unaffected. You can retry or return to the dashboard."
    />
  );
}

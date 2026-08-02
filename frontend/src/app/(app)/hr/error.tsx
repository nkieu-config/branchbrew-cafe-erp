"use client";

import { SegmentError } from "@/components/shared/segment-error";

export default function HrSegmentError({
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
      title="People unavailable"
      description="The HR section hit an error while loading staff, shifts or payroll. You can retry or return to the dashboard."
    />
  );
}

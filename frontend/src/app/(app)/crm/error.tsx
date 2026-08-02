"use client";

import { SegmentError } from "@/components/shared/segment-error";

export default function CrmSegmentError({
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
      title="Customers unavailable"
      description="The CRM section hit an error while loading customers or promotions. You can retry or return to the dashboard."
    />
  );
}

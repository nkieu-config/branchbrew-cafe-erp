"use client";

import { SegmentError } from "@/components/shared/segment-error";

export default function OrganizationSegmentError({
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
      title="Organization unavailable"
      description="The organization section hit an error while loading branches or users. You can retry or return to the dashboard."
    />
  );
}

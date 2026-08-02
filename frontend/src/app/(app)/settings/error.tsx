"use client";

import { SegmentError } from "@/components/shared/segment-error";

export default function SettingsSegmentError({
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
      title="Settings unavailable"
      description="The settings section hit an error. Your saved configuration is unchanged. You can retry or return to the dashboard."
    />
  );
}

"use client";

import { useEffect, useState } from "react";
import { useMutationState } from "@tanstack/react-query";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

const RECONNECTED_VISIBLE_MS = 4000;

export function ConnectionStatusBanner() {
  const online = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOffline = useWasOffline(online);

  const pausedCount = useMutationState({
    filters: { status: "pending" },
    select: (mutation) => mutation.state.isPaused,
  }).filter(Boolean).length;

  useEffect(() => {
    if (!online || !wasOffline) return;
    setShowReconnected(true);
    const timer = setTimeout(() => setShowReconnected(false), RECONNECTED_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [online, wasOffline]);

  if (online && !showReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="connection-status-banner"
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium",
        online
          ? "bg-[var(--success)] text-white"
          : "bg-[var(--destructive)] text-[var(--destructive-foreground)]",
      )}
    >
      {online ? (
        <>
          <Wifi className="size-4 shrink-0" aria-hidden />
          Back online — catching up.
        </>
      ) : (
        <>
          <CloudOff className="size-4 shrink-0" aria-hidden />
          <span>
            You are offline. Data may be out of date.
            {pausedCount > 0 && " Your changes are queued and will send automatically."}
          </span>
          {pausedCount > 0 && (
            <RefreshCw
              className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          )}
        </>
      )}
    </div>
  );
}

function useWasOffline(online: boolean): boolean {
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) setWasOffline(true);
  }, [online]);

  return wasOffline;
}

"use client";

import { useEffect, useState } from "react";
import { useLinkStatus } from "next/link";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const SPINNER_DELAY_MS = 120;

/**
 * Pending state of the enclosing `<Link>`, held back briefly so prefetched
 * navigations that resolve immediately never flash a spinner.
 * Only valid inside a `<Link>` subtree.
 */
export function useDelayedLinkPending(delayMs = SPINNER_DELAY_MS) {
  const { pending } = useLinkStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [pending, delayMs]);

  return visible;
}

/** Nav icon that becomes a spinner while its link navigation is in flight. */
export function NavLinkIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  const pending = useDelayedLinkPending();

  if (pending) {
    return (
      <Loader2
        className={cn(className, "animate-spin motion-reduce:animate-none")}
        aria-hidden
      />
    );
  }

  return <Icon className={className} aria-hidden />;
}

/** Trailing spinner for nav links that have no icon of their own (hub sub-tabs). */
export function NavLinkPendingDot({ className }: { className?: string }) {
  const pending = useDelayedLinkPending();

  if (!pending) return null;

  return (
    <Loader2
      className={cn("size-3 shrink-0 animate-spin motion-reduce:animate-none", className)}
      aria-hidden
    />
  );
}

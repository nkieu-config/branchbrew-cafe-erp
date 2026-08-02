"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { SessionExpiredDialog } from "@/components/auth/session-expired-dialog";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarRail } from "@/components/layout/SidebarRail";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { RouteTransition } from "@/components/layout/RouteTransition";
import { AppHeader } from "@/components/layout/AppHeader";
import { MobileNavProvider, useMobileNav } from "@/context/MobileNavContext";
import { ScrollCompactProvider } from "@/context/ScrollCompactContext";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { isImmersiveRoute, isOperationalImmersiveRoute } from "@/lib/shell-routes";
import { cn } from "@/lib/utils";
import { mainContentWithMobileNavClassName, mainContentWithPosImmersiveNavClassName, immersiveMobileShellClassName, shell, shellContentFrameClassName, shellContentPaddingYClassName, skipLinkClassName } from "@/lib/theme/shell";

const SCROLL_COMPACT_THRESHOLD_PX = 20;

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { open, setOpen, close } = useMobileNav();
  const immersive = isImmersiveRoute(pathname);
  const operationalImmersive = isOperationalImmersiveRoute(pathname);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [scrollCompact, setScrollCompact] = useState(false);
  const scrollCompactRef = useRef(false);
  const useRail = immersive && !sidebarExpanded;
  const showMobileBottomNav = !immersive;
  const mobileContentPadding = showMobileBottomNav
    ? mainContentWithMobileNavClassName()
    : operationalImmersive
      ? mainContentWithPosImmersiveNavClassName()
      : undefined;

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = el.scrollTop > SCROLL_COMPACT_THRESHOLD_PX;
    if (scrollCompactRef.current === next) return;
    scrollCompactRef.current = next;
    setScrollCompact(next);
  }, []);

  useEffect(() => {
    close();
    mainRef.current?.focus({ preventScroll: true });
    scrollCompactRef.current = false;
    setScrollCompact(false);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname, close]);

  useEffect(() => {
    if (!immersive) {
      setSidebarExpanded(false);
    }
  }, [immersive]);

  return (
      <div className={cn("flex h-dvh w-full overflow-hidden", shell.bg)}>
        <a href="#main-content" className={skipLinkClassName()}>
          Skip to main content
        </a>

        <aside
          className={cn(
            "hidden lg:block shrink-0 overflow-hidden",
            "transition-[width] duration-200 motion-reduce:transition-none",
            useRail ? "w-16" : "w-60",
          )}
          aria-label="Application sidebar"
        >
          {useRail ? (
            <SidebarRail onExpand={() => setSidebarExpanded(true)} />
          ) : (
            <Sidebar
              onCollapse={immersive ? () => setSidebarExpanded(false) : undefined}
            />
          )}
        </aside>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="left"
            className={cn("w-[min(100vw,15rem)] max-w-[15rem] p-0 gap-0 border-r border-border", shell.sidebarBorder)}
            showCloseButton
          >
            <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            <Sidebar
              onNavigate={close}
              className="h-full w-full border-r-0"
            />
          </SheetContent>
        </Sheet>

        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 min-w-0 min-h-0 h-full relative z-10 flex flex-col outline-none"
        >
          <ScrollCompactProvider compact={scrollCompact}>
            <AppHeader />
          </ScrollCompactProvider>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={cn(
              "relative z-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden",
              mobileContentPadding,
            )}
          >
          {immersive ? (
            <RouteTransition className="h-full min-h-0 flex flex-col">
              <div className={immersiveMobileShellClassName()}>{children}</div>
            </RouteTransition>
          ) : (
            <RouteTransition
              className={cn(
                shellContentFrameClassName(),
                shellContentPaddingYClassName(),
                "min-h-full flex flex-col",
              )}
            >
              {children}
            </RouteTransition>
          )}
          </div>
        </main>

        {showMobileBottomNav && <MobileBottomNav />}

        <Suspense fallback={null}>
          <SessionExpiredDialog />
        </Suspense>
      </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavProvider>
      <AppShellInner>{children}</AppShellInner>
    </MobileNavProvider>
  );
}

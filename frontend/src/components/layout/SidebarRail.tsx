"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coffee, PanelLeftOpen } from "lucide-react";
import { NavLinkIcon } from "@/components/layout/nav-link-status";
import { useAuth } from "@/context/AuthContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FLAT_SIDEBAR_ITEMS, findActiveSidebarItem, isSidebarItemActive } from "@/lib/navigation/sidebar";
import { sidebarRailExpandButtonClassName, sidebarRailLinkClassName, sidebarBrandMarkClassName, sidebarBrandMarkIconClassName, sidebarRootClassName, shell, shellHeaderInsetClassName } from "@/lib/theme/shell";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/api";

type SidebarRailProps = {
  onExpand?: () => void;
  onNavigate?: () => void;
  className?: string;
};

export function SidebarRail({ onExpand, onNavigate, className }: SidebarRailProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = (user?.role ?? "STAFF") as Role;

  const visibleItems = FLAT_SIDEBAR_ITEMS.filter((item) => item.roles.includes(role));
  const activeItem = findActiveSidebarItem(pathname);

  return (
    <TooltipProvider delay={150}>
      <div className={sidebarRootClassName(className, true)}>
        <div className={cn("h-14 flex items-center justify-center border-b shrink-0", shell.sidebarDivider, shellHeaderInsetClassName())}>
          <Link
            href="/"
            onClick={onNavigate}
            className={sidebarBrandMarkClassName()}
            aria-label="BranchBrew home"
          >
            <Coffee className={sidebarBrandMarkIconClassName()} aria-hidden />
          </Link>
        </div>

        {onExpand && (
          <div className={cn("p-2 border-b shrink-0 flex justify-center", shell.sidebarDivider)}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onExpand}
                    className={sidebarRailExpandButtonClassName()}
                    aria-label="Expand sidebar"
                  >
                    <PanelLeftOpen className="w-4 h-4" aria-hidden />
                  </button>
                }
              />
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
          </div>
        )}

        <nav
          className="flex-1 p-2 overflow-y-auto custom-scrollbar flex flex-col items-center gap-1"
          aria-label="Primary navigation"
        >
          {visibleItems.map((item) => {
            const isActive = isSidebarItemActive(item, pathname);
            const isCurrentPage = activeItem?.id === item.id;
            const ItemIcon = item.icon;

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.linkHref ?? item.href}
                      onClick={onNavigate}
                      aria-label={item.label}
                      aria-current={isCurrentPage ? "page" : undefined}
                      className={cn(sidebarRailLinkClassName(isActive, isCurrentPage), "relative")}
                    >
                      <NavLinkIcon icon={ItemIcon} className="w-[18px] h-[18px] shrink-0" />
                    </Link>
                  }
                />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </div>
    </TooltipProvider>
  );
}

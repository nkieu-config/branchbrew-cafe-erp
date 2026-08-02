"use client";

import Link from "next/link";
import { NavLinkIcon, NavLinkPendingDot } from "@/components/layout/nav-link-status";
import {
  getHubConfig,
  getVisibleHubTabs,
  isTabActive,
  shouldShowHubSubNav,
} from "@/lib/navigation/hub-utils";
import { isSidebarItemActive, resolveSidebarHubId } from "@/lib/navigation/sidebar";
import type { SidebarItem } from "@/lib/navigation/types";
import { sidebarNavChildLinkClassName, sidebarNavIconClassName, sidebarNavLinkClassName, sidebarTreeIndentClassName } from "@/lib/theme/shell";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/api";

type SidebarNavItemProps = {
  item: SidebarItem;
  pathname: string;
  role: Role;
  onNavigate?: () => void;
};

export function SidebarNavItem({
  item,
  pathname,
  role,
  onNavigate,
}: SidebarNavItemProps) {
  const ItemIcon = item.icon;
  const hubId = resolveSidebarHubId(item.id);
  const hub = hubId ? getHubConfig(hubId) : null;
  const childTabs = hubId ? getVisibleHubTabs(hubId, role) : [];
  const isHubActive = isSidebarItemActive(item, pathname);
  const showTree =
    hub != null && isHubActive && shouldShowHubSubNav(childTabs, hub.basePath);

  const activeChildTab = hub
    ? childTabs.find((tab) => isTabActive(pathname, tab.path, hub.basePath))
    : undefined;
  const isParentCurrentPage =
    isHubActive && (!activeChildTab || activeChildTab.path === item.href);

  return (
    <div className="space-y-0.5">
      <Link
        href={item.linkHref ?? item.href}
        onClick={onNavigate}
        aria-current={isParentCurrentPage ? "page" : undefined}
        className={sidebarNavLinkClassName(isHubActive, isParentCurrentPage)}
        data-testid={`nav-${item.id}`}
      >
        <NavLinkIcon icon={ItemIcon} className={sidebarNavIconClassName(isHubActive)} />
        <span className="truncate">{item.label}</span>
      </Link>

      {showTree && (
        <ul
          className={cn(sidebarTreeIndentClassName, "space-y-0.5")}
          aria-label={`${item.label} sections`}
        >
          {childTabs.map((tab) => {
            const isChildActive = isTabActive(pathname, tab.path, hub.basePath);
            return (
              <li key={tab.path}>
                <Link
                  href={tab.path}
                  onClick={onNavigate}
                  aria-current={isChildActive ? "page" : undefined}
                  className={sidebarNavChildLinkClassName(isChildActive)}
                >
                  <span className="truncate">{tab.label}</span>
                  <NavLinkPendingDot />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Gift,
  ClipboardList,
  Truck,
  ChefHat,
  UserSquare2,
  Landmark,
  Wrench,
  Building2,
  Settings,
  MonitorPlay,
} from "lucide-react";
import type { HubId, SidebarGroup, SidebarItem } from "./types";

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    group: "Overview",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        roles: ["SUPER_ADMIN", "MANAGER", "STAFF"],
      },
    ],
  },
  {
    group: "Operations",
    items: [
      {
        id: "pos",
        label: "Point of Sale",
        href: "/pos",
        icon: ShoppingCart,
        roles: ["SUPER_ADMIN", "MANAGER", "STAFF"],
      },
      {
        id: "kds",
        label: "Kitchen Display",
        href: "/kds",
        icon: MonitorPlay,
        roles: ["SUPER_ADMIN", "MANAGER", "STAFF"],
      },
      {
        id: "inventory",
        label: "Inventory",
        href: "/inventory",
        icon: Package,
        roles: ["SUPER_ADMIN", "MANAGER", "STAFF"],
      },
      {
        id: "crm",
        label: "CRM",
        href: "/crm",
        icon: Gift,
        roles: ["SUPER_ADMIN", "MANAGER"],
      },
    ],
  },
  {
    group: "Back office",
    items: [
      {
        id: "products",
        label: "Products",
        href: "/products",
        icon: ClipboardList,
        roles: ["SUPER_ADMIN", "MANAGER"],
      },
      {
        id: "procurement",
        label: "Procurement",
        href: "/procurement",
        icon: Truck,
        roles: ["SUPER_ADMIN", "MANAGER", "STAFF"],
      },
      {
        id: "kitchen",
        label: "Central Kitchen",
        href: "/kitchen",
        icon: ChefHat,
        roles: ["SUPER_ADMIN", "MANAGER"],
      },
      {
        id: "hr",
        label: "Human Resources",
        href: "/hr",
        icon: UserSquare2,
        roles: ["SUPER_ADMIN", "MANAGER", "STAFF"],
      },
      {
        id: "finance",
        label: "Finance",
        href: "/finance",
        icon: Landmark,
        roles: ["SUPER_ADMIN", "MANAGER"],
      },
      {
        id: "assets",
        label: "Assets",
        href: "/assets",
        icon: Wrench,
        roles: ["SUPER_ADMIN", "MANAGER"],
      },
    ],
  },
  {
    group: "Admin",
    items: [
      {
        id: "organization",
        label: "Organization",
        href: "/organization",
        icon: Building2,
        roles: ["SUPER_ADMIN"],
      },
      {
        id: "settings",
        label: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },
];

export const FLAT_SIDEBAR_ITEMS = SIDEBAR_GROUPS.flatMap((g) => g.items);

const SIDEBAR_HUB_IDS = new Set<HubId>([
  "inventory",
  "procurement",
  "hr",
  "products",
  "kitchen",
  "crm",
  "finance",
  "assets",
  "pos",
  "settings",
  "organization",
]);

/** Maps a sidebar item id to its hub config when the item represents a hub. */
export function resolveSidebarHubId(itemId: string): HubId | null {
  if (SIDEBAR_HUB_IDS.has(itemId as HubId)) {
    return itemId as HubId;
  }
  return null;
}

/** Legacy paths that redirect to new locations — still match sidebar active state. */
const LEGACY_PATH_PREFIXES: Record<string, string> = {
  "/branches": "/organization",
  "/users": "/organization",
  "/inventory/stock": "/inventory",
  "/procurement/transfers": "/inventory",
  "/assets/equipment": "/assets",
};

export function findActiveSidebarItem(pathname: string): SidebarItem | undefined {
  return [...FLAT_SIDEBAR_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/" && pathname.startsWith(`${item.href}/`)),
    );
}

export function isSidebarItemActive(item: SidebarItem, pathname: string): boolean {
  let resolvedPath = pathname;
  for (const [legacy, target] of Object.entries(LEGACY_PATH_PREFIXES)) {
    if (pathname === legacy || pathname.startsWith(`${legacy}/`)) {
      resolvedPath = pathname.replace(legacy, target);
      break;
    }
  }

  const activeItem = findActiveSidebarItem(resolvedPath);
  if (activeItem) {
    return item.href === activeItem.href;
  }

  for (const [legacy, target] of Object.entries(LEGACY_PATH_PREFIXES)) {
    if (pathname === legacy || pathname.startsWith(`${legacy}/`)) {
      return item.href === target || item.href.startsWith(target);
    }
  }

  return item.href === "/" && pathname === "/";
}

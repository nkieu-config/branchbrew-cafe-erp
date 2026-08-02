import type { LucideIcon } from "lucide-react";
import type { Role } from "@/types/api";

export type NavRole = Role;

export type SidebarItem = {
  id: string;
  label: string;
  /** Base path used for active-state matching — keep it the hub root. */
  href: string;
  /**
   * Where the link actually navigates. Set this when `href` only redirects,
   * so a click costs one round trip instead of two.
   */
  linkHref?: string;
  icon: LucideIcon;
  roles: NavRole[];
};

export type SidebarGroup = {
  group: string;
  items: SidebarItem[];
};

export type HubTab = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  roles: NavRole[];
  /** Lower numbers appear first. Used for role-specific ordering. */
  order?: Partial<Record<NavRole, number>>;
};

export type HubId =
  | "inventory"
  | "procurement"
  | "hr"
  | "products"
  | "kitchen"
  | "crm"
  | "finance"
  | "assets"
  | "pos"
  | "settings"
  | "organization";

export type HubConfig = {
  id: HubId;
  label: string;
  description: string;
  icon: LucideIcon;
  basePath: string;
  tabs: HubTab[];
  wrapAntd?: boolean;
};

export type MobileBottomNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  roles: NavRole[];
  /** Opens the full navigation sheet instead of navigating. */
  action?: "menu";
};

export type BreadcrumbItem = {
  label: string;
  href: string | null;
};

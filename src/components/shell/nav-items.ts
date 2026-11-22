import {
  ArrowLeftRightIcon,
  Building2Icon,
  ChartColumnIcon,
  HistoryIcon,
  IdCardIcon,
  InboxIcon,
  LayoutDashboardIcon,
  MapPinIcon,
  RouteIcon,
  ShieldCheckIcon,
  TicketIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { components } from "@/lib/api/schema";

type StaffRole = components["schemas"]["StaffRole"];

/** A heading in the sidebar (`Shell.group<Name>` in messages/en.json); Overview has none. */
export type NavGroup = "operations" | "people" | "places" | "admin";

export const navGroups: readonly NavGroup[] = [
  "operations",
  "people",
  "places",
  "admin",
];

export type NavItem = {
  /** Label key in messages/en.json, `Shell.nav.<key>`. */
  key:
    | "overview"
    | "routes"
    | "routeRequests"
    | "offers"
    | "demand"
    | "companies"
    | "riders"
    | "drivers"
    | "areas"
    | "corridors"
    | "staff"
    | "auditLog";
  href: string;
  /** Shown before the label, for sight only (the label names the link). */
  icon: LucideIcon;
  group?: NavGroup;
  /** Hidden from Staff for convenience; the API still refuses them (403). */
  adminOnly?: boolean;
  /** The screen exists. Each screen's ticket sets this, so the sidebar never links to nothing. */
  available: boolean;
};

/** The portal's navigation (milestones.md, GZW-011, GZW-073): MVP screens only, in this order. */
export const navItems: readonly NavItem[] = [
  { key: "overview", href: "/", icon: LayoutDashboardIcon, available: true },
  {
    key: "routes",
    href: "/routes",
    icon: RouteIcon,
    group: "operations",
    available: true,
  },
  {
    key: "routeRequests",
    href: "/route-requests",
    icon: InboxIcon,
    group: "operations",
    available: true,
  },
  {
    key: "offers",
    href: "/offers",
    icon: TicketIcon,
    group: "operations",
    available: true,
  },
  {
    key: "demand",
    href: "/demand",
    icon: ChartColumnIcon,
    group: "operations",
    available: true,
  },
  {
    key: "companies",
    href: "/companies",
    icon: Building2Icon,
    group: "people",
    available: true,
  },
  {
    key: "riders",
    href: "/riders",
    icon: UsersIcon,
    group: "people",
    available: true,
  },
  {
    key: "drivers",
    href: "/drivers",
    icon: IdCardIcon,
    group: "people",
    available: true,
  },
  {
    key: "areas",
    href: "/areas",
    icon: MapPinIcon,
    group: "places",
    available: true,
  },
  {
    key: "corridors",
    href: "/corridors",
    icon: ArrowLeftRightIcon,
    group: "places",
    available: true,
  },
  {
    key: "staff",
    href: "/staff",
    icon: ShieldCheckIcon,
    group: "admin",
    adminOnly: true,
    available: true,
  },
  {
    key: "auditLog",
    href: "/audit-log",
    icon: HistoryIcon,
    group: "admin",
    adminOnly: true,
    available: true,
  },
];

/** What a role sees: built screens, admin tools only for admins (and not before the role is known). */
export function visibleNavItems(
  items: readonly NavItem[],
  role: StaffRole | undefined,
): NavItem[] {
  return items.filter(
    (item) => item.available && (!item.adminOnly || role === "admin"),
  );
}

/** The item for the current page: its own path or a page below it; Overview only on "/". */
export function isCurrentPath(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

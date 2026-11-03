import type { components } from "@/lib/api/schema";

type StaffRole = components["schemas"]["StaffRole"];

export type NavItem = {
  /** Label key in messages/en.json, `Shell.nav.<key>`. */
  key:
    | "overview"
    | "routes"
    | "routeRequests"
    | "demand"
    | "companies"
    | "riders"
    | "drivers"
    | "areas"
    | "corridors"
    | "staff"
    | "auditLog";
  href: string;
  group?: "places";
  /** Hidden from Staff for convenience; the API still refuses them (403). */
  adminOnly?: boolean;
  /** The screen exists. Each screen's ticket sets this, so the sidebar never links to nothing. */
  available: boolean;
};

/** The portal's navigation (milestones.md, GZW-011): MVP screens only, in this order. */
export const navItems: readonly NavItem[] = [
  { key: "overview", href: "/", available: true },
  { key: "routes", href: "/routes", available: true },
  { key: "routeRequests", href: "/route-requests", available: true },
  { key: "demand", href: "/demand", available: false },
  { key: "companies", href: "/companies", available: true },
  { key: "riders", href: "/riders", available: false },
  { key: "drivers", href: "/drivers", available: false },
  { key: "areas", href: "/areas", group: "places", available: true },
  { key: "corridors", href: "/corridors", group: "places", available: true },
  { key: "staff", href: "/staff", adminOnly: true, available: false },
  { key: "auditLog", href: "/audit-log", adminOnly: true, available: false },
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

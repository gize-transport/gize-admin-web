import { describe, expect, it } from "vitest";
import {
  isCurrentPath,
  navItems,
  visibleNavItems,
  type NavItem,
} from "./nav-items";

/** The full MVP list as if every screen were built. */
const allBuilt: NavItem[] = navItems.map((item) => ({
  ...item,
  available: true,
}));

describe("navItems", () => {
  it("lists the MVP screens in the agreed order, Places grouped, admin tools last", () => {
    expect(navItems.map((item) => item.key)).toEqual([
      "overview",
      "routes",
      "routeRequests",
      "demand",
      "companies",
      "riders",
      "drivers",
      "areas",
      "corridors",
      "staff",
      "auditLog",
    ]);
    expect(
      navItems
        .filter((item) => item.group === "places")
        .map((item) => item.key),
    ).toEqual(["areas", "corridors"]);
    expect(
      navItems.filter((item) => item.adminOnly).map((item) => item.key),
    ).toEqual(["staff", "auditLog"]);
  });

  it("shows only screens that exist (Overview, Routes, Route requests, Demand, Companies, Areas, Corridors and Staff so far)", () => {
    expect(visibleNavItems(navItems, "admin").map((item) => item.key)).toEqual([
      "overview",
      "routes",
      "routeRequests",
      "demand",
      "companies",
      "areas",
      "corridors",
      "staff",
    ]);
  });
});

describe("visibleNavItems", () => {
  it("hides admin tools from staff", () => {
    const keys = visibleNavItems(allBuilt, "staff").map((item) => item.key);

    expect(keys).not.toContain("staff");
    expect(keys).not.toContain("auditLog");
    expect(keys).toHaveLength(9);
  });

  it("shows admin tools to admins", () => {
    expect(visibleNavItems(allBuilt, "admin")).toHaveLength(11);
  });

  it("shows only what staff see while the role is still loading", () => {
    expect(visibleNavItems(allBuilt, undefined)).toEqual(
      visibleNavItems(allBuilt, "staff"),
    );
  });
});

describe("isCurrentPath", () => {
  it("matches a section and its detail pages, and Overview only on /", () => {
    expect(isCurrentPath("/routes", "/routes")).toBe(true);
    expect(isCurrentPath("/routes", "/routes/abc")).toBe(true);
    expect(isCurrentPath("/routes", "/route-requests")).toBe(false);
    expect(isCurrentPath("/", "/")).toBe(true);
    expect(isCurrentPath("/", "/routes")).toBe(false);
  });
});

import path from "node:path";
import messages from "../../messages/en.json";
import type { TestUserName } from "./auth";

/**
 * Every screen of the portal. Each one gets the axe check and a PR screenshot (e2e/screens.spec.ts),
 * so a ticket that adds or changes a screen adds it here.
 */
export type Screen = {
  name: string;
  path: string;
  /** Text that is visible once client-rendered content has loaded; checks wait for it. */
  readyText?: string;
  /** Test user to sign in as first (e2e/support/test-users.mjs); omitted for public pages. */
  signInAs?: TestUserName;
  /** Expected HTTP status when it isn't 200 (e.g. the 404 page). */
  status?: number;
};

export const screens: readonly Screen[] = [
  { name: "sign-in", path: "/sign-in" },
  {
    name: "forgot-password",
    path: "/forgot-password",
    readyText: messages.ForgotPassword.description,
  },
  {
    name: "email-link",
    // An invitation link's page (any token: opening it checks nothing).
    path: "/auth/confirm?token_hash=sample&type=invite",
    readyText: messages.EmailLink.description,
  },
  {
    name: "set-password",
    // Signed in (as after an email link): the page needs a session.
    path: "/set-password",
    signInAs: "staff",
    readyText: messages.SetPassword.rules
      .replace("{min}", "12")
      .replace("{max}", "72"),
  },
  {
    name: "overview",
    path: "/",
    signInAs: "staff",
    readyText: messages.Overview.description,
  },
  {
    name: "areas",
    path: "/areas",
    signInAs: "admin",
    readyText: "Megenagna",
  },
  {
    name: "corridors",
    path: "/corridors",
    signInAs: "admin",
    // Only in the sample corridor ሳሪስ → Bole, which no e2e test touches (a row's text is split
    // for screen readers, so not the whole "ሳሪስ → Bole").
    readyText: "ሳሪስ",
  },
  {
    name: "routes",
    // The sample student routes (S-03, S-06), searched for: e2e tests add routes, newest first,
    // which would push them off the first page.
    path: "/routes?q=S-0",
    signInAs: "admin",
    // A sample route no e2e test changes (they add their own).
    readyText: "S-03",
  },
  {
    name: "route",
    // B-01: forming, priced, two areas served.
    path: "/routes/00000000-0000-4000-d000-000000000003",
    signInAs: "admin",
    readyText: messages.Routes.prices,
  },
  {
    name: "route-panel",
    // From 1280 px the details open beside the list; narrower, this opens the route's page.
    path: "/routes?route=00000000-0000-4000-d000-000000000003",
    signInAs: "admin",
    readyText: messages.Routes.prices,
  },
  {
    name: "route-requests",
    path: "/route-requests",
    signInAs: "staff",
    // A sample request no e2e test changes (they record their own).
    readyText: "Dawit Alemu",
  },
  {
    name: "route-request",
    // Selam Bekele: from Ayat to an area not listed yet, new.
    path: "/route-requests/00000000-0000-4000-e000-000000000001",
    signInAs: "admin",
    readyText: "+251911000101",
  },
  {
    name: "route-request-panel",
    // From 1280 px the details open beside the list; narrower, this opens the request's page.
    path: "/route-requests?request=00000000-0000-4000-e000-000000000002",
    signInAs: "staff",
    readyText: "Works near Piassa, any seat from next month.",
  },
  {
    name: "demand",
    path: "/demand",
    signInAs: "staff",
    // Shown once the summary has loaded (the cards' contents change as e2e tests add requests).
    readyText: messages.Demand.pairsDescription,
  },
  {
    name: "companies",
    path: "/companies",
    signInAs: "admin",
    // A sample company no e2e test changes (they add their own).
    readyText: "Abyssinia Textiles",
  },
  {
    name: "company",
    // Addis Brewery: notes, a route, and the admin's actions.
    path: "/companies/00000000-0000-4000-c000-000000000001",
    signInAs: "admin",
    readyText: "Invoices to the finance office, 2nd floor.",
  },
  {
    name: "company-panel",
    // From 1280 px the details open beside the list; narrower, this opens the company's page.
    path: "/companies?company=00000000-0000-4000-c000-000000000001",
    signInAs: "admin",
    readyText: "Invoices to the finance office, 2nd floor.",
  },
  {
    name: "staff",
    path: "/staff",
    signInAs: "admin",
    // A sample member no e2e test changes (they invite their own).
    readyText: "hana@gize.test",
  },
  {
    name: "staff-member",
    // Hana Tesfaye: invited, never signed in (Pending).
    path: "/staff/00000000-0000-4000-8000-000000000004",
    signInAs: "admin",
    readyText: messages.Staff.statusPendingNote,
  },
  {
    name: "staff-panel",
    // From 1280 px the details open beside the list; narrower, this opens the member's page.
    path: "/staff?member=00000000-0000-4000-8000-000000000004",
    signInAs: "admin",
    readyText: messages.Staff.statusPendingNote,
  },
  {
    name: "audit-log",
    path: "/audit-log",
    signInAs: "admin",
    // A sample entry (the stand-in's entries are fixed).
    readyText: messages.AuditLog.actions.area.renamed,
  },
  {
    name: "not-found",
    path: "/this-page-does-not-exist",
    signInAs: "staff",
    status: 404,
    readyText: messages.NotFound.title,
  },
  // Dev-only gallery of shared components (needs GIZE_DEV_PAGES=1 in production builds).
  {
    name: "components",
    path: "/dev/components",
    readyText: messages.DevComponents.noRouteSelected,
  },
];

// Resolved from the repo root, so it doesn't depend on the directory Playwright is started from.
export const SCREENSHOT_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "screenshots",
);

/** e.g. screenshots/home-1440.png – the same names the pr-screenshots branch uses. */
export function screenshotPath(name: string, width: number) {
  return path.join(SCREENSHOT_DIR, `${name}-${width}.png`);
}

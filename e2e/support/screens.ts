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

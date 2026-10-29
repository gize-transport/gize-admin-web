import path from "node:path";
import messages from "../../messages/en.json";

/**
 * Every screen of the portal. Each one gets the axe check and a PR screenshot (e2e/screens.spec.ts),
 * so a ticket that adds or changes a screen adds it here.
 */
export type Screen = {
  name: string;
  path: string;
  /** Text that is visible once client-rendered content has loaded; checks wait for it. */
  readyText?: string;
};

export const screens: readonly Screen[] = [
  { name: "home", path: "/" },
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

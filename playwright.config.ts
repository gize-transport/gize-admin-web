import { defineConfig, devices } from "@playwright/test";

// Dedicated port so e2e never runs against another app (or a dev server) already listening on 3000.
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/support/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // The two widths every screen must work at (product-brief.md).
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // CI builds in an earlier step; locally build first so tests always run against a production build.
    command: isCI
      ? `npx next start -p ${port}`
      : `npm run build && npx next start -p ${port}`,
    url: baseURL,
    // Turns on dev-only pages such as /dev/components in this production build (src/lib/dev-pages.ts).
    env: { GIZE_DEV_PAGES: "1" },
    // Opt-in only (E2E_REUSE=1), so a stale server can't make the suite pass or fail by accident.
    reuseExistingServer: !isCI && process.env.E2E_REUSE === "1",
    timeout: 180_000,
  },
});

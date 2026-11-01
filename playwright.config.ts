import { defineConfig, devices } from "@playwright/test";
import {
  FAKE_API_PORT,
  FAKE_SUPABASE_PORT,
} from "./e2e/support/test-users.mjs";

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
  webServer: [
    {
      // Stand-ins for Supabase Auth and the API (W1 decision): signed-in flows need no real services.
      command: "node e2e/support/fake-services.mjs",
      port: FAKE_API_PORT,
      reuseExistingServer: false,
    },
    {
      // CI builds in an earlier step; locally build first so tests always run against a production build.
      command: isCI
        ? `npx next start -p ${port}`
        : `npm run build && npx next start -p ${port}`,
      url: baseURL,
      // GIZE_DEV_PAGES turns on dev-only pages such as /dev/components (src/lib/dev-pages.ts);
      // NEXT_PUBLIC_* point the build at the stand-ins (same values as the CI Build job).
      env: {
        GIZE_DEV_PAGES: "1",
        NEXT_PUBLIC_API_BASE_URL: `http://localhost:${FAKE_API_PORT}`,
        NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${FAKE_SUPABASE_PORT}`,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        NEXT_PUBLIC_SENTRY_DSN: "",
      },
      // Opt-in only (E2E_REUSE=1), so a stale server can't make the suite pass or fail by accident.
      reuseExistingServer: !isCI && process.env.E2E_REUSE === "1",
      timeout: 180_000,
    },
  ],
});

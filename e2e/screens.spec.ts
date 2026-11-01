import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support/auth";
import { expectNoSeriousA11yViolations } from "./support/axe";
import { screenshotPath, screens, type Screen } from "./support/screens";

async function openScreen(page: Page, screen: Screen) {
  if (screen.signInAs) await signIn(page, screen.signInAs);
  const response = await page.goto(screen.path);
  expect(response?.ok()).toBe(true);
  if (screen.readyText) {
    await expect(page.getByText(screen.readyText)).toBeVisible();
  }
}

// Runs at both project widths (1440 px and 375 px). `npm run screenshots` runs only the screenshot tests.
for (const screen of screens) {
  test.describe(`${screen.name} screen`, () => {
    test("has no serious or critical accessibility violations", async ({
      page,
    }) => {
      await openScreen(page, screen);

      await expectNoSeriousA11yViolations(page);
    });

    test("loads without page or console errors", async ({ page }) => {
      // Catches code that runs in the browser before the page is interactive
      // (instrumentation-client.ts, the env check, providers).
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });

      await openScreen(page, screen);
      await page.waitForLoadState("networkidle");

      expect(errors).toEqual([]);
    });

    test("screenshot @screenshot", async ({ page }) => {
      await openScreen(page, screen);

      const width = page.viewportSize()?.width;
      expect(width).toBeDefined();
      await page.screenshot({
        path: screenshotPath(screen.name, width ?? 0),
        fullPage: true,
        animations: "disabled",
        caret: "hide",
      });
    });
  });
}

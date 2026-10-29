import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./support/axe";
import { screenshotPath, screens, type Screen } from "./support/screens";

async function openScreen(page: Page, screen: Screen) {
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

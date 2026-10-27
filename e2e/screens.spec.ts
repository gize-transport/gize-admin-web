import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./support/axe";
import { screenshotPath, screens } from "./support/screens";

// Runs at both project widths (1440 px and 375 px). `npm run screenshots` runs only the screenshot tests.
for (const screen of screens) {
  test.describe(`${screen.name} screen`, () => {
    test("has no serious or critical accessibility violations", async ({
      page,
    }) => {
      await page.goto(screen.path);

      await expectNoSeriousA11yViolations(page);
    });

    test("screenshot @screenshot", async ({ page }) => {
      const response = await page.goto(screen.path);
      expect(response?.ok()).toBe(true);

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

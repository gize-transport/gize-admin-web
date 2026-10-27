import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { screenshotPath, screens } from "./support/screens";

// Captures every screen at the project's width (1440 px and 375 px) for PR descriptions.
// Run alone with `npm run screenshots`; CI uploads the folder as an artifact.
for (const screen of screens) {
  test(`${screen.name} screenshot @screenshot`, async ({ page }) => {
    const response = await page.goto(screen.path);
    expect(response?.ok()).toBe(true);

    const width = page.viewportSize()?.width;
    expect(width).toBeDefined();
    const path = screenshotPath(screen.name, width ?? 0);
    await page.screenshot({ path, fullPage: true });

    expect(existsSync(path)).toBe(true);
  });
}

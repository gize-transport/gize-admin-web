import { expect, test } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";

test.describe("smoke", () => {
  test("home page loads with the portal heading in English", async ({
    page,
  }) => {
    await signIn(page, "staff");

    await expect(page).toHaveTitle(messages.Metadata.title);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.Overview.title,
    );
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: messages.Overview.actionTitle,
      }),
    ).toBeVisible();
  });

  test("page fits the viewport without horizontal scrolling", async ({
    page,
  }) => {
    await signIn(page, "staff");

    // Compare with the configured width: mobile emulation widens window.innerWidth to fit content.
    const viewportWidth = page.viewportSize()?.width ?? 0;
    const pageWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(pageWidth).toBeLessThanOrEqual(viewportWidth);
  });
});

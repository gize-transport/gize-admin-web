import { expect, test } from "@playwright/test";
import messages from "../messages/en.json";

test.describe("smoke", () => {
  test("home page loads with the portal heading in English", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(messages.Metadata.title);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.HomePage.title,
    );
    await expect(page.getByText(messages.HomePage.description)).toBeVisible();
  });

  test("page fits the viewport without horizontal scrolling", async ({
    page,
  }) => {
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

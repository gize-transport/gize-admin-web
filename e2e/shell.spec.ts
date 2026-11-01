import { expect, test } from "@playwright/test";
import messages from "../messages/en.json";
import { accountName, signIn } from "./support/auth";

const t = messages.Shell;

/** The sidebar shows from 1024 px; below that it is the menu drawer. */
function isWide(width: number | undefined) {
  return (width ?? 0) >= 1024;
}

test.describe("portal shell", () => {
  test("on a wide screen, the sidebar shows the navigation and the account", async ({
    page,
  }) => {
    test.skip(!isWide(page.viewportSize()?.width), "wide screens only");
    await signIn(page, "staff");

    const sidebar = page.getByRole("complementary");
    await expect(
      sidebar
        .getByRole("navigation")
        .getByRole("link", { name: t.nav.overview }),
    ).toHaveAttribute("aria-current", "page");
    await expect(sidebar.getByText(accountName("staff"))).toBeVisible();
    await expect(
      sidebar.getByText(messages.Roles.staff, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: t.openMenu })).toBeHidden();
  });

  test("on a phone, the menu drawer works with the keyboard alone", async ({
    page,
  }) => {
    test.skip(isWide(page.viewportSize()?.width), "narrow screens only");
    await signIn(page, "staff");
    await expect(page.getByRole("complementary")).toBeHidden();
    const menu = page.getByRole("button", { name: t.openMenu });

    await menu.focus();
    await page.keyboard.press("Enter");

    const drawer = page.getByRole("dialog", { name: t.menuTitle });
    await expect(drawer).toBeVisible();
    await expect(
      drawer
        .getByRole("navigation")
        .getByRole("link", { name: t.nav.overview }),
    ).toHaveAttribute("aria-current", "page");
    await expect(drawer.getByText(accountName("staff"))).toBeVisible();
    // Focus stays inside the drawer.
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    expect(
      await drawer.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);

    await page.keyboard.press("Escape");

    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();
  });

  test("the skip link moves keyboard users to the page content", async ({
    page,
  }) => {
    await signIn(page, "staff");
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: t.skipToContent });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("main")).toBeFocused();
  });

  test("an unknown address shows the 404 page with a way back", async ({
    page,
  }) => {
    await signIn(page, "staff");

    const response = await page.goto("/no-such-page");

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: messages.NotFound.title }),
    ).toBeVisible();
    await page.getByRole("link", { name: messages.NotFound.backHome }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

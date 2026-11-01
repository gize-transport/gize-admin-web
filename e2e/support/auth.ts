import { expect, type Page } from "@playwright/test";
import messages from "../../messages/en.json";
import { testUsers } from "./test-users.mjs";

export type TestUserName = keyof typeof testUsers;

/** Signs in through the sign-in page (against the e2e stand-ins) and waits to leave it. */
export async function signIn(
  page: Page,
  name: TestUserName,
  path = "/sign-in",
) {
  const user = testUsers[name];
  await page.goto(path);
  await page.getByLabel(messages.SignIn.email).fill(user.email);
  await page.getByLabel(messages.SignIn.password).fill(user.password);
  await page.getByRole("button", { name: messages.SignIn.submit }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

/** The signed-in person's name, as the sidebar shows it once their account has loaded. */
export function accountName(name: TestUserName) {
  const staff = testUsers[name].staff;
  return typeof staff === "object" ? staff.full_name : "";
}

/**
 * Checks the sidebar's account area names this person. Below 1024 px the sidebar is the menu
 * drawer, so it is opened (and closed again with Escape).
 */
export async function expectSignedInAs(page: Page, name: TestUserName) {
  const menu = page.getByRole("button", { name: messages.Shell.openMenu });
  // Wait for the portal shell (not, say, the sign-in page still on screen).
  await expect(menu.or(page.getByRole("complementary"))).toBeVisible();
  if (await menu.isVisible()) {
    await menu.click();
    await expect(
      page.getByRole("dialog").getByText(accountName(name)),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  } else {
    await expect(
      page.getByRole("complementary").getByText(accountName(name)),
    ).toBeVisible();
  }
}

/** Signs out from the sidebar; on narrow screens it is inside the menu drawer. */
export async function signOut(page: Page) {
  const menu = page.getByRole("button", { name: messages.Shell.openMenu });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("button", { name: messages.Shell.signOut })
    .filter({ visible: true })
    .click();
}

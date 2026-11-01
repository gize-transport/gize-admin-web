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

import { randomUUID } from "node:crypto";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import messages from "../messages/en.json";
import { expectSignedInAs, signOut, type TestUserName } from "./support/auth";
import { FAKE_SUPABASE_PORT, testUsers } from "./support/test-users.mjs";

const t = messages.SetPassword;
const tLink = messages.EmailLink;
const tForgot = messages.ForgotPassword;
const tSignIn = messages.SignIn;

// These tests change their person's password, so each Playwright project has its own person,
// and the tests run one after another.
test.describe.configure({ mode: "serial" });

function person(testInfo: TestInfo): TestUserName {
  return testInfo.project.name === "mobile" ? "resetMobile" : "resetDesktop";
}

/** The link an email would hold, from the Supabase stand-in (it sends no email). */
async function emailLink(kind: "invite" | "recovery", email: string) {
  const response = await fetch(
    `http://localhost:${FAKE_SUPABASE_PORT}/__e2e/${kind}-link?email=${encodeURIComponent(email)}`,
  );
  const { token_hash } = (await response.json()) as { token_hash: string };
  return `/auth/confirm?token_hash=${token_hash}&type=${kind}`;
}

/** Opens an email link's page and presses Continue (opening it alone uses nothing). */
async function followLink(page: Page, link: string) {
  await page.goto(link);
  await page.getByRole("button", { name: tLink.continue }).click();
}

async function setNewPassword(page: Page, password: string) {
  await page.getByLabel(t.password, { exact: true }).fill(password);
  await page.getByLabel(t.confirm).fill(password);
  await page.getByRole("button", { name: t.submit }).click();
}

test.describe("setting a password", () => {
  test("an invited person opens their link (after a mail scanner did), sets a password and is in the portal; elsewhere they're signed out; the link works once", async ({
    page,
    browser,
  }, testInfo) => {
    const name = person(testInfo);
    const { email } = testUsers[name];

    // Another browser signed in as the same person (from an earlier link).
    const elsewhere = await browser.newContext();
    const other = await elsewhere.newPage();
    await followLink(other, await emailLink("invite", email));
    await expect(other).toHaveURL(/\/set-password$/);

    const link = await emailLink("invite", email);
    // A mail scanner opens every link first: that uses nothing up.
    expect((await page.request.get(link)).status()).toBe(200);

    await page.goto(link);
    await expect(
      page.getByRole("heading", { level: 1, name: tLink.inviteTitle }),
    ).toBeVisible();
    await page.getByRole("button", { name: tLink.continue }).click();
    await expect(page).toHaveURL(/\/set-password$/);
    await expect(
      page.getByRole("heading", { level: 1, name: t.title }),
    ).toBeVisible();

    // Too short: explained before anything is sent.
    await setNewPassword(page, "Gize2026!");
    await expect(
      page.getByText(t.tooShort.replace("{min}", "12")),
    ).toBeVisible();

    await setNewPassword(page, `invite-${randomUUID()}`);
    await expect(page.getByText(t.done)).toBeVisible();
    await expectSignedInAs(page, name);

    // The other browser was signed out.
    await other.goto("/");
    await expect(other).toHaveURL(/\/sign-in/);
    await elsewhere.close();

    // The same link again: used, so its page says so.
    await signOut(page);
    await followLink(page, link);
    await expect(page).toHaveURL(/\/auth\/confirm\?link=expired$/);
    await expect(
      page.getByRole("heading", { level: 1, name: tLink.expiredTitle }),
    ).toBeVisible();
  });

  test("“Forgot your password?” emails a link; the new password then signs in", async ({
    page,
  }, testInfo) => {
    const name = person(testInfo);
    const { email } = testUsers[name];

    await page.goto("/sign-in");
    await page.getByRole("link", { name: tSignIn.forgotPassword }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: tForgot.title }),
    ).toBeVisible();
    await page.getByLabel(tForgot.email).fill(email);
    await page.getByRole("button", { name: tForgot.submit }).click();
    await expect(page.getByText(tForgot.sentTitle)).toBeVisible();
    const link = await emailLink("recovery", email);

    // Asking again within the minute: Supabase refuses for a real account, which must not show.
    await page.goto("/forgot-password");
    await page.getByLabel(tForgot.email).fill(email);
    await page.getByRole("button", { name: tForgot.submit }).click();
    await expect(page.getByText(tForgot.sentTitle)).toBeVisible();

    await followLink(page, link);
    const password = `reset-${randomUUID()}`;
    await setNewPassword(page, password);
    await expectSignedInAs(page, name);

    await signOut(page);
    await expect(page).toHaveURL(/\/sign-in/);
    await page.getByLabel(tSignIn.email).fill(email);
    await page.getByLabel(tSignIn.password).fill(password);
    await page.getByRole("button", { name: tSignIn.submit }).click();
    await expectSignedInAs(page, name);
  });

  test("“Forgot your password?” answers the same for an email with no account", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.getByLabel(tForgot.email).fill("nobody@gize.test");
    await page.getByRole("button", { name: tForgot.submit }).click();
    await expect(
      page.getByText(tForgot.sent.replace("{email}", "nobody@gize.test")),
    ).toBeVisible();
  });

  test("signed out, “Set your password” goes to sign-in", async ({ page }) => {
    await page.goto("/set-password");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fset-password$/);
  });
});

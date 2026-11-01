import { expect, test, type APIRequestContext } from "@playwright/test";
import messages from "../messages/en.json";
import { expectSignedInAs, signIn, signOut } from "./support/auth";
import { FAKE_SUPABASE_PORT, testUsers } from "./support/test-users.mjs";

const t = messages.SignIn;

async function refreshCount(request: APIRequestContext) {
  const response = await request.get(
    `http://localhost:${FAKE_SUPABASE_PORT}/__e2e/refresh-count`,
  );
  return ((await response.json()) as { refreshCount: number }).refreshCount;
}

test.describe("sign-in", () => {
  test("a signed-out visitor is sent to sign-in and back to the page they wanted", async ({
    page,
  }) => {
    await page.goto("/routes?status=forming");
    await expect(page).toHaveURL(
      /\/sign-in\?next=%2Froutes%3Fstatus%3Dforming$/,
    );

    await page.getByLabel(t.email).fill(testUsers.staff.email);
    await page.getByLabel(t.password).fill(testUsers.staff.password);
    await page.getByRole("button", { name: t.submit }).click();

    // /routes doesn't exist yet (GZW-021): the redirect target is what matters.
    await expect(page).toHaveURL(/\/routes\?status=forming$/);
  });

  test("staff sign in, see who they are, and sign out", async ({ page }) => {
    await signIn(page, "staff");

    await expectSignedInAs(page, "staff");
    await signOut(page);

    await expect(page).toHaveURL(/\/sign-in\?reason=signed_out$/);
    await expect(page.getByRole("status")).toHaveText(t.signedOut);
    // The session is gone: home asks to sign in again.
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("an admin sees their role", async ({ page }) => {
    await signIn(page, "admin");

    await expectSignedInAs(page, "admin");
  });

  test("a wrong password is explained and nobody is signed in", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel(t.email).fill(testUsers.staff.email);
    await page.getByLabel(t.password).fill("not-the-password");
    await page.getByRole("button", { name: t.submit }).click();

    await expect(page.locator('[data-slot="alert"]')).toContainText(
      t.reasons.invalid_credentials,
    );
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("someone who isn't staff is signed out again with the reason", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel(t.email).fill(testUsers.outsider.email);
    await page.getByLabel(t.password).fill(testUsers.outsider.password);
    await page.getByRole("button", { name: t.submit }).click();

    await expect(page.locator('[data-slot="alert"]')).toContainText(
      t.reasons.not_staff,
    );
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("a signed-in person who opens sign-in goes home", async ({ page }) => {
    await signIn(page, "staff");

    await page.goto("/sign-in");

    await expect(page).toHaveURL(/\/$/);
  });

  test("works with the keyboard alone", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel(t.email).focus();
    await page.keyboard.type(testUsers.staff.email);
    await page.keyboard.press("Tab");
    await page.keyboard.type(testUsers.staff.password);
    await page.keyboard.press("Enter");

    await expectSignedInAs(page, "staff");
  });

  test("a signed-in visit with a next page on another site stays on this site", async ({
    page,
  }) => {
    await signIn(page, "staff");

    await page.goto("/sign-in?next=%2F%2Fevil.example");

    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
  });

  test("an expired session is refreshed by the middleware on the next page", async ({
    page,
    context,
    request,
  }) => {
    await signIn(page, "staff");
    const before = await refreshCount(request);

    // Make the stored session look expired (@supabase/ssr stores it as "base64-<json>").
    const cookie = (await context.cookies()).find((candidate) =>
      /^sb-.+-auth-token$/.test(candidate.name),
    );
    expect(
      cookie,
      "one Supabase session cookie, not split in chunks",
    ).toBeDefined();
    if (!cookie) return;
    const session = JSON.parse(
      Buffer.from(cookie.value.replace(/^base64-/, ""), "base64url").toString(),
    ) as { expires_at: number };
    session.expires_at = Math.floor(Date.now() / 1000) - 60;
    await context.addCookies([
      {
        ...cookie,
        value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      },
    ]);

    const response = await page.goto("/");

    expect(response?.ok()).toBe(true);
    await expect(page).toHaveURL(/\/$/);
    expect(await response?.headerValue("set-cookie")).toContain("-auth-token=");
    expect(await refreshCount(request)).toBeGreaterThan(before);
    await expectSignedInAs(page, "staff");
  });
});

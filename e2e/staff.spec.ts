import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";
import { actionItems, actionsButton, chooseAction } from "./support/actions";

const t = messages.Staff;

const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    text,
  );

const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1280;

async function openInvite(page: Page) {
  await page.getByRole("button", { name: t.invite }).first().click();
  return page.getByRole("dialog", { name: t.inviteTitle });
}

test.describe("staff accounts", () => {
  test("an admin invites someone, makes them an admin, deactivates and reactivates them", async ({
    page,
  }) => {
    await signIn(page, "admin", "/sign-in?next=%2Fstaff");
    const id = randomUUID().slice(0, 6);
    const name = `E2E Person ${id}`;
    const dialog = await openInvite(page);
    await dialog.getByLabel(t.emailLabel).fill(`E2E.${id}@Gize.test`);
    await dialog.getByLabel(t.nameLabel).fill(name);
    await dialog.getByRole("button", { name: t.send }).click();
    await expect(page.getByText(t.invited)).toBeVisible();

    // The new member opens with focus: beside the list, or their page.
    const details = isWide(page)
      ? page.getByRole("region", { name })
      : page.getByRole("article", { name });
    if (isWide(page)) await expect(details).toBeFocused();
    else {
      await expect(page.getByRole("heading", { level: 1, name })).toBeFocused();
    }
    // The email as the API stores it, and Pending until they sign in.
    await expect(details.getByText(`e2e.${id}@gize.test`)).toBeVisible();
    await expect(details.getByText(t.statusPendingNote)).toBeVisible();

    await chooseAction(page, details, t.makeAdmin);
    await page
      .getByRole("alertdialog", { name: fill(t.makeAdminTitle, { name }) })
      .getByRole("button", { name: t.makeAdmin })
      .click();
    await expect(page.getByText(t.roleChanged)).toBeVisible();
    // Focus is back on the menu, which now offers the other way.
    await expect(actionsButton(details)).toBeFocused();
    expect(await actionItems(page, details)).toContain(t.makeStaff);

    await chooseAction(page, details, t.deactivate);
    await page
      .getByRole("alertdialog", { name: fill(t.deactivateTitle, { name }) })
      .getByRole("button", { name: t.deactivate })
      .click();
    // Focus is back on the menu; Reactivate shows beside Edit name.
    await expect(actionsButton(details)).toBeFocused();
    await details.getByRole("button", { name: t.reactivate }).click();
    await expect(page.getByText(t.reactivated)).toBeVisible();
    // Reactivate goes away with the change: focus moves to the menu, which offers Deactivate.
    await expect(
      details.getByRole("button", { name: t.reactivate }),
    ).toHaveCount(0);
    await expect(actionsButton(details)).toBeFocused();
    expect(await actionItems(page, details)).toContain(t.deactivate);
  });

  test("an invite to an email already used explains why, offering to reactivate a former member", async ({
    page,
  }) => {
    await signIn(page, "admin", "/sign-in?next=%2Fstaff");
    const dialog = await openInvite(page);
    await dialog.getByLabel(t.emailLabel).fill("dawit@gize.test");
    await dialog.getByLabel(t.nameLabel).fill("Dawit Again");
    await dialog.getByRole("button", { name: t.send }).click();
    await expect(dialog.getByText(t.emailTaken)).toBeVisible();
    // Not reactivated here: the sample member is shared by every test.
    await expect(
      dialog.getByRole("button", {
        name: fill(t.reactivateInstead, {
          name: "Dawit Former",
          role: "staff",
        }),
      }),
    ).toBeVisible();

    // An email with a sign-in account but no staff member can't be invited.
    await dialog.getByLabel(t.emailLabel).fill("outsider@gize.test");
    await dialog.getByRole("button", { name: t.send }).click();
    await expect(dialog.getByText(t.authAccountExists)).toBeVisible();
  });

  test("staff don't see Staff, and the page says they may not use it", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fstaff");
    await expect(page.getByText(messages.NoPermission.title)).toBeVisible();
    await expect(
      page.getByRole("link", { name: messages.Shell.nav.staff }),
    ).toHaveCount(0);
  });
});

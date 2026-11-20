import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { chooseFilter } from "./support/filters";
import { signIn } from "./support/auth";
import { actionItems, chooseAction } from "./support/actions";

const t = messages.Companies;

const fill = (text: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    text,
  );

/** Wide enough for the side panel (design-system.md: details beside the list from 1280 px). */
const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1280;

/**
 * Adds a company no other test (or worker) uses, with the keyboard alone: the stand-in's data is
 * shared, so tests that change a company work on their own.
 */
async function addCompany(page: Page) {
  const name = `E2e Co ${randomUUID().slice(0, 8)}`;
  await page.getByRole("button", { name: t.add }).first().click();
  const dialog = page.getByRole("dialog", { name: t.addTitle });
  await expect(dialog.getByLabel(t.nameLabel)).toBeFocused();
  await page.keyboard.type(name);
  await page.keyboard.press("Tab");
  await page.keyboard.type("Mekdes Haile");
  await page.keyboard.press("Tab");
  await page.keyboard.type("0911 22 33 44");
  await page.keyboard.press("Tab");
  await page.keyboard.type("mekdes@example.test");
  await page.keyboard.press("Enter");
  await expect(page.getByText(fill(t.addedToast, { name }))).toBeVisible();
  await expect(dialog).toBeHidden();
  return name;
}

/** Opens a company's details: the side panel on wide screens, its page otherwise. */
async function openCompany(page: Page, name: string) {
  await page.getByLabel(t.searchLabel).fill(name);
  await page.getByRole("link", { name, exact: true }).click();
  if (isWide(page)) {
    const panel = page.getByRole("region", { name });
    await expect(panel).toBeVisible();
    return panel;
  }
  await expect(page).toHaveURL(/\/companies\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  // Next keeps the list page (hidden) in the document: look only in the company's article.
  return page.getByRole("article", { name });
}

test.describe("companies", () => {
  test("staff find companies by the start of their name and by status", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fcompanies");
    const table = page.getByRole("table", { name: t.tableLabel });
    await expect(
      table.getByRole("link", { name: "Addis Brewery" }),
    ).toBeVisible();

    await page.getByLabel(t.searchLabel).fill("abys");
    await expect(
      table.getByRole("link", { name: "Abyssinia Textiles" }),
    ).toBeVisible();
    await expect(
      table.getByRole("link", { name: "Addis Brewery" }),
    ).toBeHidden();

    await page.getByLabel(t.searchLabel).fill("");
    await chooseFilter(page, t.statusFilter, t.filterInactive);
    await expect(page).toHaveURL(/[?&]is_active=false/);
    await expect(
      table.getByRole("link", { name: "Bole Logistics" }),
    ).toBeVisible();
    await expect(
      table.getByRole("link", { name: "Addis Brewery" }),
    ).toBeHidden();
  });

  test("staff add a company with the keyboard, are told when the name is taken, and edit it", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fcompanies");
    const name = await addCompany(page);

    await page.getByRole("button", { name: t.add }).first().click();
    const again = page.getByRole("dialog", { name: t.addTitle });
    await again.getByLabel(t.nameLabel).fill("addis brewery");
    await again.getByLabel(t.contactNameLabel).fill("Someone");
    await again.getByLabel(t.contactPhoneLabel).fill("0911 00 00 00");
    await again.getByLabel(t.contactEmailLabel).fill("someone@example.test");
    await again.getByRole("button", { name: t.save }).click();
    await expect(
      again.getByText(messages.Errors.COMPANY_NAME_TAKEN),
    ).toBeVisible();
    await expect(again.getByLabel(t.nameLabel)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(again).toBeHidden();

    const details = await openCompany(page, name);
    // The API stored the number in E.164.
    await expect(details.getByText("+251911223344")).toBeVisible();
    await details.getByRole("button", { name: t.edit }).click();
    const edit = page.getByRole("dialog", {
      name: fill(t.editTitle, { name }),
    });
    await edit.getByLabel(t.contactNameLabel).fill("Mekdes H.");
    await edit.getByRole("button", { name: t.save }).click();
    await expect(page.getByText(fill(t.savedToast, { name }))).toBeVisible();
    await expect(details.getByText("Mekdes H.")).toBeVisible();
  });

  test("a company running a route can't be deactivated; another is deactivated and reactivated", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fcompanies");
    const brewery = await openCompany(page, "Addis Brewery");
    await expect(brewery.getByText("R-21")).toBeVisible();
    await chooseAction(page, brewery, t.deactivate);
    const refuse = page.getByRole("alertdialog");
    await refuse.getByRole("button", { name: t.deactivate }).click();
    await expect(refuse.getByText(t.inUseDeactivate)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/companies");
    const name = await addCompany(page);
    const details = await openCompany(page, name);
    await chooseAction(page, details, t.deactivate);
    await page
      .getByRole("alertdialog", { name: fill(t.deactivateTitle, { name }) })
      .getByRole("button", { name: t.deactivate })
      .click();
    await expect(page.getByText(fill(t.deactivated, { name }))).toBeVisible();
    await expect(details.getByText(t.inactive)).toBeVisible();

    await details.getByRole("button", { name: t.reactivate }).click();
    await expect(page.getByText(fill(t.reactivated, { name }))).toBeVisible();
    await expect(details.getByText(t.active, { exact: true })).toBeVisible();
  });

  test("details open beside the list on wide screens and as a page on phones", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fcompanies");
    const row = page.getByRole("link", { name: "Abyssinia Textiles" });
    await row.click();

    if (isWide(page)) {
      const panel = page.getByRole("region", {
        name: "Abyssinia Textiles",
      });
      await expect(panel).toBeVisible();
      await expect(panel).toBeFocused();
      await expect(page).toHaveURL(/\/companies\?company=[0-9a-f-]{36}$/);
      await expect(row).toHaveAttribute("aria-current", "true");
      await panel.getByRole("button", { name: t.closeDetail }).click();
      await expect(panel).toBeHidden();
      await expect(row).toBeFocused();
    } else {
      await expect(page).toHaveURL(/\/companies\/[0-9a-f-]{36}$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Abyssinia Textiles" }),
      ).toBeVisible();
      await page.getByRole("link", { name: t.backToList }).click();
      await expect(page).toHaveURL(/\/companies$/);
    }
  });

  test("a shared panel link opens the panel on wide screens and the page on phones", async ({
    page,
  }) => {
    // Abyssinia Textiles (sample data no test changes).
    const id = "00000000-0000-4000-c000-000000000003";
    await signIn(page, "staff");
    await page.goto(`/companies?company=${id}`);

    if (isWide(page)) {
      await expect(
        page.getByRole("region", { name: "Abyssinia Textiles" }),
      ).toBeVisible();
      // Still the list with the panel, after hydration has settled.
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(`/companies\\?company=${id}$`));
    } else {
      await expect(page).toHaveURL(new RegExp(`/companies/${id}$`));
      await expect(
        page.getByRole("heading", { level: 1, name: "Abyssinia Textiles" }),
      ).toBeVisible();
    }
  });

  test("an admin deletes a company, and one with routes is refused with the reason", async ({
    page,
  }) => {
    await signIn(page, "admin", "/sign-in?next=%2Fcompanies");
    const name = await addCompany(page);
    const details = await openCompany(page, name);
    await chooseAction(page, details, t.delete);
    await page
      .getByRole("alertdialog", { name: fill(t.deleteTitle, { name }) })
      .getByRole("button", { name: t.delete })
      .click();
    await expect(page.getByText(fill(t.deleted, { name }))).toBeVisible();
    await expect(page).toHaveURL(/\/companies(\?q=[^&]*)?$/);
    await expect(page.getByRole("link", { name, exact: true })).toBeHidden();

    await page.goto("/companies");
    const brewery = await openCompany(page, "Addis Brewery");
    await chooseAction(page, brewery, t.delete);
    const refuse = page.getByRole("alertdialog");
    await refuse.getByRole("button", { name: t.delete }).click();
    await expect(refuse.getByText(t.inUseDelete)).toBeVisible();
  });

  test("staff don't see Delete", async ({ page }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fcompanies");
    const details = await openCompany(page, "Abyssinia Textiles");
    await expect(details.getByRole("button", { name: t.edit })).toBeVisible();

    expect(await actionItems(page, details)).not.toContain(t.delete);
  });
});

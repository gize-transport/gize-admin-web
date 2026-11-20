import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";
import { expectNoSeriousA11yViolations } from "./support/axe";
import { actionItems, chooseAction } from "./support/actions";

const t = messages.Drivers;

const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    text,
  );

const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1280;

/** A driver no other test (or worker) adds: their own name, phone and plate. */
function newDriver() {
  const id = randomUUID().slice(0, 6).toUpperCase();
  const digits = String(parseInt(id, 16) % 100000000).padStart(8, "0");
  return {
    name: `E2E Driver ${id}`,
    phone: `09${digits}`,
    stored: `+2519${digits}`,
    plate: `E2E ${id}`,
  };
}

/** The driver just opened: beside the list on wide screens, their page otherwise. */
async function opened(page: Page, name: string) {
  if (isWide(page)) return page.getByRole("region", { name });
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return page.getByRole("article", { name });
}

async function addDriver(page: Page, who: ReturnType<typeof newDriver>) {
  await page.getByRole("button", { name: t.add }).first().click();
  const dialog = page.getByRole("dialog", { name: t.addTitle });
  await dialog.getByLabel(t.nameLabel).fill(who.name);
  await dialog.getByLabel(t.phoneLabel).fill(who.phone);
  await dialog.getByLabel(t.addressLabel).fill("Ayat, block 12");
  // Any case: stored in capitals.
  await dialog.getByLabel(t.plateLabel).fill(who.plate.toLowerCase());
  await dialog.getByRole("button", { name: t.save }).click();
  await expect(page.getByText(t.addedToast)).toBeVisible();
  await expect(dialog).toBeHidden();
}

test.describe("drivers", () => {
  test("staff add a driver, find them by plate, correct them, and deactivate and reactivate them", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fdrivers");
    const table = page.getByRole("table", { name: t.tableLabel });
    await expect(
      table.getByRole("link", { name: "Bereket Tolosa" }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    const who = newDriver();
    await addDriver(page, who);
    let driver = await opened(page, who.name);
    await expect(driver.getByText(who.stored)).toBeVisible();
    await expect(driver.getByText(who.plate, { exact: true })).toBeVisible();

    // Found by the start of their plate, in any case; nothing typed goes in the address.
    await page.goto("/drivers");
    const box = page.getByLabel(t.searchLabel);
    const typed = who.plate.slice(0, 7).toLowerCase();
    await box.fill(typed);
    await box.press("Tab");
    await expect(table.getByRole("link", { name: who.name })).toBeVisible();
    await expect(
      table.getByRole("link", { name: "Bereket Tolosa" }),
    ).toHaveCount(0);
    // The address is marked a moment after the search (a replace): wait for it.
    await expect(page).toHaveURL(/searched=1/);
    // The path and query only: the host's port (3100) can share digits with the plate.
    const { pathname, search } = new URL(page.url());
    expect(decodeURIComponent(pathname + search).toLowerCase()).not.toContain(
      typed.slice(4),
    );
    await table.getByRole("link", { name: who.name }).click();
    driver = await opened(page, who.name);

    // A new address.
    await driver.getByRole("button", { name: t.edit }).click();
    const form = page.getByRole("dialog", {
      name: fill(t.editTitle, { name: who.name }),
    });
    await form.getByLabel(t.addressLabel).fill("Bole Bulbula");
    await form.getByRole("button", { name: t.save }).click();
    await expect(page.getByText(t.savedToast)).toBeVisible();
    await expect(driver.getByText("Bole Bulbula")).toBeVisible();

    // Deactivated, then back. Buttons after a toast are pressed by keyboard: on phones the
    // toast can sit over them.
    await chooseAction(page, driver, t.deactivate, { keyboard: true });
    await page
      .getByRole("alertdialog", {
        name: fill(t.deactivateTitle, { name: who.name }),
      })
      .getByRole("button", { name: t.deactivate })
      .click();
    await expect(driver.getByText(t.inactive, { exact: true })).toBeVisible();
    await driver.getByRole("button", { name: t.reactivate }).press("Enter");
    await page
      .getByRole("alertdialog", {
        name: fill(t.reactivateTitle, { name: who.name }),
      })
      .getByRole("button", { name: t.reactivate })
      .click();
    await expect(driver.getByText(t.active, { exact: true })).toBeVisible();
  });

  test("a phone another driver has is refused on its field, and a driver of a route can't be deactivated until that route changes", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fdrivers");
    const who = newDriver();
    await page.getByRole("button", { name: t.add }).first().click();
    const dialog = page.getByRole("dialog", { name: t.addTitle });
    await dialog.getByLabel(t.nameLabel).fill(who.name);
    // Bereket Tolosa's number, written another way.
    await dialog.getByLabel(t.phoneLabel).fill("0911 000 301");
    await dialog.getByLabel(t.addressLabel).fill("Ayat");
    await dialog.getByLabel(t.plateLabel).fill(who.plate);
    await dialog.getByRole("button", { name: t.save }).click();
    const phone = dialog.getByLabel(t.phoneLabel);
    await expect(phone).toBeFocused();
    await expect(phone).toHaveAccessibleDescription(
      new RegExp(messages.Errors.DRIVER_EXISTS),
    );
    await dialog.getByRole("button", { name: messages.Common.cancel }).click();

    // Bereket Tolosa drives B-07.
    await page
      .getByRole("table", { name: t.tableLabel })
      .getByRole("link", { name: "Bereket Tolosa" })
      .click();
    const bereket = await opened(page, "Bereket Tolosa");
    // Their routes, each linked.
    await expect(
      bereket.getByRole("link", { name: "B-07", exact: true }),
    ).toBeVisible();
    await chooseAction(page, bereket, t.deactivate);
    const confirm = page.getByRole("alertdialog", {
      name: fill(t.deactivateTitle, { name: "Bereket Tolosa" }),
    });
    await confirm.getByRole("button", { name: t.deactivate }).click();
    // The refusal names the route to change, and links to it.
    await expect(
      confirm.getByText(
        "They drive B-07, so they can't be deactivated. Give that route another driver, or none, first.",
      ),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await confirm.getByRole("link", { name: "Open B-07" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "B-07" }),
    ).toBeVisible();
  });

  test("an admin deletes a driver", async ({ page }) => {
    await signIn(page, "admin", "/sign-in?next=%2Fdrivers");
    const who = newDriver();
    await addDriver(page, who);
    const driver = await opened(page, who.name);

    await chooseAction(page, driver, t.delete, { keyboard: true });
    await page
      .getByRole("alertdialog", {
        name: fill(t.deleteTitle, { name: who.name }),
      })
      .getByRole("button", { name: t.delete })
      .click();
    await expect(page.getByText(t.deletedToast)).toBeVisible();
    await expect(
      page
        .getByRole("table", { name: t.tableLabel })
        .getByRole("link", { name: who.name }),
    ).toHaveCount(0);
  });

  test("staff see no Delete on a driver", async ({ page }) => {
    await signIn(
      page,
      "staff",
      "/drivers/00000000-0000-4000-9900-000000000003",
    );
    const fikru = page.getByRole("article", { name: "Fikru Hailu" });
    await expect(fikru.getByRole("button", { name: t.edit })).toBeVisible();
    expect(await actionItems(page, fikru)).not.toContain(t.delete);
  });
});

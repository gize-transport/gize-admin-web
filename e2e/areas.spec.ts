import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";

const t = messages.Areas;

/** A name no other test (or worker) uses: the stand-in's data is shared. */
function uniqueName() {
  return `E2e ${randomUUID().slice(0, 8)}`;
}

async function addArea(page: Page, name: string) {
  await page.getByRole("button", { name: t.add }).first().click();
  const dialog = page.getByRole("dialog", { name: t.addTitle });
  await dialog.getByLabel(t.nameLabel).fill(name);
  await dialog.getByRole("button", { name: t.save }).click();
  await expect(page.getByText(t.added.replace("{name}", name))).toBeVisible();
  await expect(dialog).toBeHidden();
}

async function search(page: Page, text: string) {
  await page.getByLabel(t.searchLabel).fill(text);
  // URLSearchParams writes a space as "+".
  const query = new URLSearchParams({ q: text }).toString();
  await expect(page).toHaveURL(
    new RegExp(`[?&]${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(&|$)`),
  );
}

test.describe("areas", () => {
  test("staff find areas by the start of their name, Amharic included", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fareas");
    await expect(page).toHaveURL(/\/areas$/);
    const table = page.getByRole("table", { name: t.tableLabel });
    await expect(table.getByText("ጦር ኃይሎች")).toBeVisible();

    await search(page, "me");

    await expect(table.getByText("Megenagna")).toBeVisible();
    await expect(table.getByText("Mexico")).toBeVisible();
    await expect(table.getByText("Piassa")).toBeHidden();
  });

  test("staff add and rename an area, and a taken name is explained", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fareas");
    const name = uniqueName();

    await addArea(page, name);
    await search(page, name);
    await page.getByRole("button", { name: `${name}, rename` }).click();
    const dialog = page.getByRole("dialog", {
      name: t.renameTitle.replace("{name}", name),
    });
    await dialog.getByLabel(t.nameLabel).fill(`${name} North`);
    await dialog.getByRole("button", { name: t.save }).click();
    await expect(
      page.getByText(t.renamed.replace("{name}", `${name} North`)),
    ).toBeVisible();

    await page.getByRole("button", { name: t.add }).first().click();
    const add = page.getByRole("dialog", { name: t.addTitle });
    await add.getByLabel(t.nameLabel).fill("bole");
    await add.getByRole("button", { name: t.save }).click();
    await expect(add.getByText(messages.Errors.AREA_NAME_TAKEN)).toBeVisible();
    await expect(add.getByLabel(t.nameLabel)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("staff don't see Delete", async ({ page }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fareas");
    await expect(page.getByText("Bole")).toBeVisible();

    await expect(page.getByRole("button", { name: /^Delete / })).toHaveCount(0);
  });

  test("an admin deletes an area, and one in use is refused with the reason", async ({
    page,
  }) => {
    await signIn(page, "admin", "/sign-in?next=%2Fareas");
    const name = uniqueName();
    await addArea(page, name);
    await search(page, name);

    await page.getByRole("button", { name: `Delete ${name}` }).click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("button", { name: t.delete }).click();
    await expect(
      page.getByText(t.deleted.replace("{name}", name)),
    ).toBeVisible();
    await expect(
      page.getByText(t.noMatchesTitle.replace("{q}", name)),
    ).toBeVisible();
    // Its Delete button is gone with the row, so focus goes to the page content.
    await expect(page.locator("main#content")).toBeFocused();

    await search(page, "Bole");
    await page.getByRole("button", { name: "Delete Bole" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.delete })
      .click();
    await expect(
      page.getByRole("alertdialog").getByText(t.inUse),
    ).toBeVisible();
  });
});

test.describe("area picker (dev gallery)", () => {
  test("picks an area with the keyboard alone", async ({ page }) => {
    await page.goto("/dev/components");
    const picker = page.getByRole("combobox", {
      name: messages.DevComponents.areaPickerLabel,
    });

    await picker.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.type("me");
    await expect(page.getByRole("option", { name: "Mexico" })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(picker).toHaveText("Mexico");
    await expect(picker).toBeFocused();
    await expect(
      page.getByText(
        messages.DevComponents.areaPickerChosen.replace("{name}", "Mexico"),
      ),
    ).toBeVisible();
  });
});

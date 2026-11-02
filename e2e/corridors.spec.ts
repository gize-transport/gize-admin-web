import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";

const t = messages.Corridors;

const fill = (text: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    text,
  );

/** What screen readers hear for a row's button: "Edit {origin} to {destination}" (no arrow). */
const editName = (values: { origin: string; destination: string }) =>
  fill(
    t.rowName
      .replace(/<arrow>.*?<\/arrow>/, "")
      .replace(/<\/?spoken>/g, "")
      .replace(/\s+/g, " "),
    values,
  );

/** Adds an area no other test (or worker) uses: the stand-in's data is shared. */
async function addUniqueArea(page: Page) {
  const name = `E2e ${randomUUID().slice(0, 8)}`;
  await page.goto("/areas");
  await page.getByRole("button", { name: messages.Areas.add }).first().click();
  const dialog = page.getByRole("dialog", { name: messages.Areas.addTitle });
  await dialog.getByLabel(messages.Areas.nameLabel).fill(name);
  await dialog.getByRole("button", { name: messages.Areas.save }).click();
  await expect(dialog).toBeHidden();
  return name;
}

/** Picks an area with the keyboard alone: focus the picker, Enter, type, Enter. */
async function pickWithKeyboard(page: Page, picker: Locator, name: string) {
  await picker.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type(name);
  await expect(page.getByRole("option", { name, exact: true })).toBeVisible();
  // While a search runs there are no options to pick, so Enter picks the match shown.
  await page.keyboard.press("Enter");
  await expect(picker).toHaveText(name);
  await expect(picker).toBeFocused();
}

async function openAdd(page: Page) {
  await page.getByRole("button", { name: t.add }).first().click();
  return page.getByRole("dialog", { name: t.addTitle });
}

test.describe("corridors", () => {
  test("staff filter corridors by origin, and the filter survives a reload", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fcorridors");
    const table = page.getByRole("table", { name: t.tableLabel });
    await expect(
      table.getByRole("button", {
        name: editName({ origin: "Bole", destination: "Piassa" }),
      }),
    ).toBeVisible();
    const filters = page.getByRole("group", { name: t.filtersLabel });

    await pickWithKeyboard(
      page,
      filters.getByRole("combobox", { name: t.originLabel }),
      "Piassa",
    );

    await expect(page).toHaveURL(/[?&]origin_area_id=[0-9a-f-]{36}/);
    await expect(
      table.getByRole("button", {
        name: editName({ origin: "Piassa", destination: "Bole" }),
      }),
    ).toBeVisible();
    await expect(
      table.getByRole("button", {
        name: editName({ origin: "Bole", destination: "Piassa" }),
      }),
    ).toBeHidden();

    await page.reload();
    await expect(
      filters.getByRole("combobox", { name: t.originLabel }),
    ).toHaveText("Piassa");
    await expect(
      table.getByRole("button", {
        name: editName({ origin: "Piassa", destination: "Bole" }),
      }),
    ).toBeVisible();
  });

  test("staff add a corridor with the keyboard, are told when it exists, and change it", async ({
    page,
  }) => {
    await signIn(page, "staff");
    const area = await addUniqueArea(page);
    await page.goto("/corridors");

    const dialog = await openAdd(page);
    await pickWithKeyboard(
      page,
      dialog.getByRole("combobox", { name: t.originLabel }),
      "CMC",
    );
    await pickWithKeyboard(
      page,
      dialog.getByRole("combobox", { name: t.destinationLabel }),
      area,
    );
    await page.keyboard.press("Tab"); // past the destination's Clear button
    await dialog.getByRole("button", { name: t.save }).click();
    const pair = { origin: "CMC", destination: area };
    await expect(page.getByText(fill(t.added, pair))).toBeVisible();
    await expect(dialog).toBeHidden();

    // The same pair again is refused, by name.
    const again = await openAdd(page);
    await pickWithKeyboard(
      page,
      again.getByRole("combobox", { name: t.originLabel }),
      "CMC",
    );
    await pickWithKeyboard(
      page,
      again.getByRole("combobox", { name: t.destinationLabel }),
      area,
    );
    await again.getByRole("button", { name: t.save }).click();
    await expect(again.getByText(fill(t.exists, pair))).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(again).toBeHidden();

    // The way back is another corridor; change this one's origin instead.
    await page.getByRole("button", { name: editName(pair) }).click();
    const edit = page.getByRole("dialog", { name: fill(t.editTitle, pair) });
    await pickWithKeyboard(
      page,
      edit.getByRole("combobox", { name: t.originLabel }),
      "Ayat",
    );
    await edit.getByRole("button", { name: t.save }).click();
    await expect(
      page.getByText(fill(t.changed, { origin: "Ayat", destination: area })),
    ).toBeVisible();
  });

  test("staff don't see Delete", async ({ page }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fcorridors");
    await expect(
      page.getByRole("button", {
        name: editName({ origin: "Bole", destination: "Piassa" }),
      }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: /^Delete / })).toHaveCount(0);
  });

  test("an admin deletes a corridor, and one a route runs on is refused with the reason", async ({
    page,
  }) => {
    await signIn(page, "admin");
    const area = await addUniqueArea(page);
    await page.goto("/corridors");
    const dialog = await openAdd(page);
    await pickWithKeyboard(
      page,
      dialog.getByRole("combobox", { name: t.originLabel }),
      area,
    );
    await pickWithKeyboard(
      page,
      dialog.getByRole("combobox", { name: t.destinationLabel }),
      "Mexico",
    );
    await dialog.getByRole("button", { name: t.save }).click();
    await expect(dialog).toBeHidden();
    const pair = { origin: area, destination: "Mexico" };

    await page.getByRole("button", { name: fill(t.deleteLabel, pair) }).click();
    await page
      .getByRole("alertdialog", { name: fill(t.deleteTitle, pair) })
      .getByRole("button", { name: t.delete })
      .click();
    await expect(page.getByText(fill(t.deleted, pair))).toBeVisible();
    await expect(page.locator("main#content")).toBeFocused();

    const inUse = { origin: "Bole", destination: "Piassa" };
    await page
      .getByRole("button", { name: fill(t.deleteLabel, inUse) })
      .click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("button", { name: t.delete }).click();
    await expect(confirm.getByText(t.inUseDelete)).toBeVisible();
  });
});

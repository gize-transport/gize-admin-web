import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";

const t = messages.Riders;

// Sample data in the stand-in (e2e/support/fake-services.mjs).
const ABEL = "00000000-0000-4000-9000-000000000001";

const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    text,
  );

const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1280;

/** Someone no other test (or worker) records: their own name and phone. */
function caller() {
  const id = randomUUID().slice(0, 6);
  const digits = String(parseInt(id, 16) % 100000000).padStart(8, "0");
  return { name: `E2E Rider ${id}`, phone: `09${digits}` };
}

/** Picks with the keyboard alone: focus the picker, Enter, type, Enter. */
async function pick(page: Page, picker: Locator, name: string) {
  await picker.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type(name);
  await expect(page.getByRole("option", { name, exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(picker).toHaveText(name);
  // Focus is back on the picker once its list has closed: the next pick can start.
  await expect(picker).toBeFocused();
}

/** The rider just opened: beside the list on wide screens, their page otherwise. */
async function opened(page: Page, name: string) {
  if (isWide(page)) return page.getByRole("region", { name });
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return page.getByRole("article", { name });
}

async function search(page: Page, text: string) {
  const box = page.getByLabel(t.searchLabel);
  await box.fill(text);
  await box.press("Tab");
}

test.describe("riders", () => {
  test("staff find a caller by phone, record a new one and correct their plan", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Friders");
    const table = page.getByRole("table", { name: t.tableLabel });
    await expect(
      table.getByRole("link", { name: "Kidus Alemu" }),
    ).toBeVisible();

    // A caller already riding: found by phone, the number never in the address.
    await search(page, "0911 00 04 12");
    await expect(page.getByText(t.phoneSearchNote)).toBeVisible();
    await expect(table.getByRole("link", { name: "Kidus Alemu" })).toHaveCount(
      0,
    );
    await table.getByRole("link", { name: "Abel Tesfaye" }).click();
    const abel = await opened(page, "Abel Tesfaye");
    await expect(abel.getByText("+251911000412")).toBeVisible();
    await expect(abel.getByText(t.seatRiding)).toBeVisible();
    expect(page.url()).not.toMatch(/0911|251911|Abel/);

    // A new caller: nobody has the number, so record them with it.
    await page.goto("/riders");
    const who = caller();
    await search(page, who.phone);
    await page.getByRole("button", { name: t.addWithPhone }).click();
    const dialog = page.getByRole("dialog", { name: t.addTitle });
    await expect(dialog.getByLabel(t.phoneLabel, { exact: true })).toHaveValue(
      `+2519${who.phone.slice(2)}`,
    );
    await dialog.getByLabel(t.nameLabel, { exact: true }).fill(who.name);
    await pick(
      page,
      dialog.getByRole("combobox", { name: t.homeLabel }),
      "Bole",
    );
    await pick(
      page,
      dialog.getByRole("combobox", { name: t.destinationLabel }),
      "Piassa",
    );
    await dialog.getByLabel(t.planRoundTripOption).check();
    await dialog.getByRole("button", { name: t.record }).click();

    await expect(page.getByText(t.recordedToast)).toBeVisible();
    const details = await opened(page, who.name);
    await expect(details.getByText(t.noSeatDetail)).toBeVisible();
    await expect(details.getByText(t.planRoundTrip)).toBeVisible();

    await details.getByRole("button", { name: t.edit }).click();
    const edit = page.getByRole("dialog", { name: t.editTitle });
    await edit.getByLabel(t.planMorningOption).check();
    await edit.getByLabel(t.saturdayLabel).check();
    await edit.getByRole("button", { name: t.save }).click();
    await expect(page.getByText(t.savedToast)).toBeVisible();
    await expect(
      details.getByText(fill(t.planWithSaturday, { plan: t.planMorning })),
    ).toBeVisible();
    expect(page.url()).not.toContain(who.name.replaceAll(" ", "+"));
  });

  test("a company rider: recorded once per company, the second time points to them", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Friders");
    const who = caller();
    for (const attempt of [1, 2]) {
      if (attempt === 2) await page.goto("/riders");
      await page.getByRole("button", { name: t.add }).first().click();
      const dialog = page.getByRole("dialog", { name: t.addTitle });
      await dialog.getByLabel(t.typeCompanyOption).check();
      await dialog.getByLabel(t.nameLabel, { exact: true }).fill(who.name);
      await dialog.getByLabel(t.phoneLabel, { exact: true }).fill(who.phone);
      await pick(
        page,
        dialog.getByRole("combobox", { name: t.companyLabel }),
        "Addis Brewery",
      );
      await pick(
        page,
        dialog.getByRole("combobox", { name: t.homeLabel }),
        "Bole",
      );
      await dialog.getByRole("button", { name: t.record }).click();
      if (attempt === 1) {
        const details = await opened(page, who.name);
        await expect(
          details.getByText(
            fill(t.typeCompanyAt, { company: "Addis Brewery" }),
          ),
        ).toBeVisible();
        continue;
      }
      await expect(dialog.getByText(t.existsCompany)).toBeVisible();
      await dialog
        .getByRole("link", { name: fill(t.existsLink, { name: who.name }) })
        .click();
    }
    await expect(
      page.getByRole("heading", { level: 1, name: who.name }),
    ).toBeVisible();
  });

  test("admins delete a rider without a seat; one riding is refused", async ({
    page,
  }, testInfo) => {
    await signIn(page, "admin", `/sign-in?next=%2Friders%2F${ABEL}`);
    const abel = page.getByRole("article", { name: "Abel Tesfaye" });
    await expect(
      abel.getByText(fill(t.deleteHasSeat, { code: "B-07" })),
    ).toBeVisible();
    await abel.getByRole("button", { name: t.deleteRider }).click();
    const refuse = page.getByRole("alertdialog", { name: t.deleteTitle });
    await refuse.getByRole("button", { name: t.deleteRider }).click();
    await expect(refuse.getByText(t.deleteRefusedSeat)).toBeVisible();
    await refuse.getByRole("button", { name: messages.Common.cancel }).click();

    // One sample rider per Playwright project, so the projects don't race for one.
    const name =
      testInfo.project.name === "mobile" ? "Selam Girmay" : "Selam Girma";
    await page.goto("/riders");
    await search(page, name);
    const table = page.getByRole("table", { name: t.tableLabel });
    await table.getByRole("link", { name, exact: true }).click();
    const details = await opened(page, name);
    await details.getByRole("button", { name: t.deleteRider }).click();
    const confirm = page.getByRole("alertdialog", { name: t.deleteTitle });
    await confirm.getByRole("button", { name: t.deleteRider }).click();
    await expect(page.getByText(t.deleted)).toBeVisible();
    await expect(page).toHaveURL(/\/riders$/);
    // The whole list again (on wide screens the search stays while the panel closes).
    await page.goto("/riders");
    await expect(
      table.getByRole("link", { name: "Kidus Alemu" }),
    ).toBeVisible();
    await expect(table.getByRole("link", { name, exact: true })).toHaveCount(0);
  });

  test("staff see no Delete", async ({ page }) => {
    await signIn(page, "staff", `/sign-in?next=%2Friders%2F${ABEL}`);
    const abel = page.getByRole("article", { name: "Abel Tesfaye" });
    await expect(abel.getByText("+251911000412")).toBeVisible();
    await expect(abel.getByRole("button", { name: t.edit })).toBeVisible();
    await expect(abel.getByRole("button", { name: t.deleteRider })).toHaveCount(
      0,
    );
  });
});

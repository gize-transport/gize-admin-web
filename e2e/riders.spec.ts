import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";
import { actionItems, chooseAction } from "./support/actions";
import { chooseFilter } from "./support/filters";

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
  test("staff sort riders by name, with a name search kept out of the address", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Friders");
    const table = page.getByRole("table", { name: t.tableLabel });
    const names = () =>
      table
        .locator("tbody tr > :first-child")
        .getByRole("link")
        .allTextContents();
    await expect(table).toBeVisible();

    await chooseFilter(
      page,
      messages.DataTable.sort,
      messages.DataTable.sortName,
    );
    await expect(page).toHaveURL(/[?&]sort=name/);
    await expect(
      page.getByRole("button", {
        name: `${messages.DataTable.sort}: ${messages.DataTable.sortName}`,
      }),
    ).toBeVisible();
    // Sample riders whose order no text rules dispute (the real API sorts by the database's
    // rules, which may treat spaces and punctuation differently); other tests add more.
    const sample = ["Abel Tesfaye", "Hirut Bekele", "Kidus Alemu"];
    // Abel first, and the others (unless riders added meanwhile pushed them to page 2) after,
    // in order.
    await expect
      .poll(async () => {
        const shown = (await names()).filter((name) => sample.includes(name));
        return (
          shown.length > 1 &&
          shown.join() === sample.slice(0, shown.length).join()
        );
      })
      .toBe(true);
    expect((await names())[0]).toBe("Abel Tesfaye");

    await search(page, "a");
    await expect.poll(names).toEqual(["Abel Tesfaye"]);
    await expect(page).toHaveURL(/[?&]sort=name/);
    expect(page.url()).not.toMatch(/[?&]q=/);
  });

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
    // Its random part, however the name might be encoded.
    expect(page.url()).not.toContain(who.name.slice(-6));
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
    await chooseAction(page, abel, t.deleteRider);
    const refuse = page.getByRole("alertdialog", { name: t.deleteTitle });
    // Said in the confirmation, before trying.
    await expect(
      refuse.getByText(fill(t.deleteHasSeat, { code: "B-07" })),
    ).toBeVisible();
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
    await chooseAction(page, details, t.deleteRider);
    const confirm = page.getByRole("alertdialog", { name: t.deleteTitle });
    await confirm.getByRole("button", { name: t.deleteRider }).click();
    await expect(page.getByText(t.deleted)).toBeVisible();
    // Back on the list (with the search still on beside a closed panel on wide screens).
    await expect(page).toHaveURL(/\/riders(\?searched=1)?$/);
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
    expect(await actionItems(page, abel)).not.toContain(t.deleteRider);
  });
});

/** Records an adult going Bole → Piassa (the trip of B-01 and B-07) and opens them. */
async function recordAdult(page: Page) {
  const who = caller();
  await page.getByRole("button", { name: t.add }).first().click();
  const dialog = page.getByRole("dialog", { name: t.addTitle });
  await dialog.getByLabel(t.nameLabel, { exact: true }).fill(who.name);
  await dialog.getByLabel(t.phoneLabel, { exact: true }).fill(who.phone);
  await pick(page, dialog.getByRole("combobox", { name: t.homeLabel }), "Bole");
  await pick(
    page,
    dialog.getByRole("combobox", { name: t.destinationLabel }),
    "Piassa",
  );
  await dialog.getByLabel(t.planRoundTripOption).check();
  await dialog.getByRole("button", { name: t.record }).click();
  await expect(page.getByText(t.recordedToast)).toBeVisible();
  return { who, details: await opened(page, who.name) };
}

test.describe("seats", () => {
  test("staff reserve a seat on a forming route; a full running route becomes a route request; the reservation ends", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Friders");
    const { who, details } = await recordAdult(page);

    await details.getByRole("button", { name: t.placeButton }).click();
    const place = page.getByRole("dialog", {
      name: fill(t.placeTitle, { name: who.name }),
    });
    await place.getByRole("radio", { name: /^B-01/ }).check();
    await place.getByRole("button", { name: t.placeSave }).click();
    await expect(page.getByText(t.placedToast)).toBeVisible();
    await expect(details.getByText(t.seatReserved)).toBeVisible();
    await expect(
      details.getByRole("link", {
        name: fill(t.seatRouteLink, { code: "B-01" }),
      }),
    ).toBeVisible();

    // B-07 is running, full, and has someone else's request: a reason first, then full.
    // By keyboard: on phones the "Seat saved" toast can sit over the button (and stays while the
    // pointer rests on it).
    await details.getByRole("button", { name: t.moveButton }).press("Enter");
    const move = page.getByRole("dialog", {
      name: fill(t.moveTitle, { name: who.name }),
    });
    await expect(move.getByRole("radio", { name: /^B-01/ })).toHaveCount(0);
    await move.getByRole("radio", { name: /^B-07/ }).check();
    await move.getByRole("button", { name: t.moveSave }).click();
    const reason = move.getByLabel(t.skipReasonLabel);
    await expect(reason).toBeFocused();
    await reason.fill("Works next to the B-07 stop");
    await move.getByRole("button", { name: t.moveSave }).click();
    await expect(
      move.getByText(fill(t.seatFullRequest, { code: "B-07" })),
    ).toBeVisible();
    await move
      .getByRole("button", {
        name: fill(t.seatRecordRequest, { code: "B-07" }),
      })
      .click();
    const request = page.getByRole("dialog", {
      name: messages.RouteRequests.addTitle,
    });
    await expect(
      request.getByLabel(messages.RouteRequests.riderNameLabel),
    ).toHaveValue(who.name);
    await request
      .getByRole("button", { name: messages.RouteRequests.record })
      .click();
    await expect(
      page.getByText(messages.RouteRequests.recordedToast),
    ).toBeVisible();

    // A reservation ends at once.
    await details.getByRole("button", { name: t.endButton }).click();
    const end = page.getByRole("dialog", {
      name: fill(t.endTitle, { code: "B-01" }),
    });
    await end.getByRole("button", { name: t.endSave }).click();
    await expect(page.getByText(t.endedToast)).toBeVisible();
    await expect(details.getByText(t.noSeatDetail)).toBeVisible();
  });

  test("a company rider rides their company's route from today; an end is undone with Keep", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Friders");
    const who = caller();
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
    const details = await opened(page, who.name);

    await details.getByRole("button", { name: t.placeButton }).click();
    const place = page.getByRole("dialog", {
      name: fill(t.placeTitle, { name: who.name }),
    });
    await place.getByRole("radio", { name: /^R-21/ }).check();
    await place.getByRole("button", { name: t.placeSave }).click();
    await expect(details.getByText(t.seatRiding)).toBeVisible();

    await details.getByRole("button", { name: t.endButton }).click();
    await page
      .getByRole("dialog", { name: fill(t.endTitle, { code: "R-21" }) })
      .getByRole("button", { name: t.endSave })
      .click();
    const keep = details.getByRole("button", {
      name: fill(t.keepButton, { code: "R-21" }),
    });
    await keep.click();
    await page
      .getByRole("alertdialog", { name: fill(t.keepTitle, { code: "R-21" }) })
      .getByRole("button", { name: fill(t.keepSave, { code: "R-21" }) })
      .click();
    await expect(page.getByText(t.keptToast)).toBeVisible();
    await expect(keep).toHaveCount(0);
    await expect(details.getByText(t.seatRiding)).toBeVisible();
  });
});

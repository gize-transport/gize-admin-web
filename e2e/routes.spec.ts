import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";

const t = messages.Routes;
const tField = messages.CorridorField;

// Sample routes in the stand-in (e2e/support/fake-services.mjs).
const B01 = "00000000-0000-4000-d000-000000000003";
const B02 = "00000000-0000-4000-d000-000000000005";

const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    text,
  );

const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1280;

/** Picks with the keyboard alone: focus the picker, Enter, type, Enter. */
async function pickWithKeyboard(page: Page, picker: Locator, name: string) {
  await picker.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type(name);
  await expect(page.getByRole("option", { name, exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(picker).toHaveText(name);
  // Focus comes back to the picker as its popup closes: wait, so it can't land after the next step.
  await expect(picker).toBeFocused();
}

/** Opens a route's details: the side panel on wide screens, its page otherwise. */
async function openRoute(page: Page, code: string) {
  await page.getByRole("link", { name: code, exact: true }).click();
  if (isWide(page)) {
    const panel = page.getByRole("region", { name: code });
    await expect(panel).toBeVisible();
    return panel;
  }
  await expect(
    page.getByRole("heading", { level: 1, name: code }),
  ).toBeVisible();
  return page.getByRole("article", { name: code });
}

async function fillTimes(dialog: Locator) {
  await dialog.getByLabel(t.leaveALabel).fill("06:30");
  await dialog.getByLabel(t.arriveBLabel).fill("07:15");
  await dialog.getByLabel(t.leaveBLabel).fill("17:30");
  await dialog.getByLabel(t.arriveALabel).fill("18:15");
}

/** Adds a route no other test (or worker) uses; corridor Ayat → CMC (sample data). */
async function addRoute(
  page: Page,
  type: "public" | "student" | "corporate",
  code = `E2E-${randomUUID().slice(0, 6)}`,
) {
  await page.getByRole("button", { name: t.add }).first().click();
  const dialog = page.getByRole("dialog", { name: t.addTitle });
  await dialog.getByLabel(t.codeLabel).fill(code.toLowerCase());
  await pickWithKeyboard(
    page,
    dialog.getByRole("combobox", { name: tField.originLabel }),
    "Ayat",
  );
  await pickWithKeyboard(
    page,
    dialog.getByRole("combobox", { name: tField.destinationLabel }),
    "CMC",
  );
  await expect(
    dialog.getByText(
      fill(tField.found, { origin: "Ayat", destination: "CMC" }),
    ),
  ).toBeVisible();
  const typeLabel = {
    public: t.typePublic,
    student: t.typeStudent,
    corporate: t.typeCorporate,
  }[type];
  await dialog.getByRole("radio", { name: typeLabel }).check();
  if (type === "student") {
    await dialog.getByLabel(t.schoolLabel).fill("Nazareth School");
  }
  if (type === "corporate") {
    await pickWithKeyboard(
      page,
      dialog.getByRole("combobox", { name: t.companyLabel }),
      "Abyssinia Textiles",
    );
  }
  await fillTimes(dialog);
  await dialog.getByLabel(t.seatsLabel).fill("14");
  if (type !== "corporate") {
    await dialog.getByLabel(t.launchMinimumLabel).fill("10");
  }
  await dialog.getByRole("button", { name: t.save }).click();
  return { code, dialog };
}

test.describe("routes", () => {
  test("staff filter routes by code, type, status, corridor and company", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Froutes");
    const table = page.getByRole("table", { name: t.tableLabel });
    const row = (code: string) =>
      table.getByRole("link", { name: code, exact: true });
    // Other tests add routes (newest first, 25 a page): the sample ones are found by searching.
    const search = page.getByLabel(t.searchLabel);

    await search.fill("b-");
    await expect(row("B-01")).toBeVisible();
    await expect(row("B-02")).toBeVisible();
    await expect(row("S-03")).toBeHidden();

    await search.fill("s-");
    await page.getByRole("button", { name: t.typeStudent }).click();
    await expect(page).toHaveURL(/[?&]route_type=student/);
    await expect(row("S-03")).toBeVisible();
    await search.fill("b-");
    await expect(table).toBeHidden(); // no student route's code starts with B-
    await search.fill("");
    await page
      .getByRole("group", { name: t.typeFilter })
      .getByRole("button", { name: messages.DataTable.all })
      .click();

    await page
      .getByRole("button", { name: messages.RouteStatus.formingNoMinimum })
      .click();
    await expect(row("B-01")).toBeVisible();
    await expect(row("S-03")).toBeHidden();
    await page
      .getByRole("group", { name: t.statusFilter })
      .getByRole("button", { name: messages.DataTable.all })
      .click();

    await pickWithKeyboard(
      page,
      page.getByRole("combobox", { name: tField.originLabel }),
      "Bole",
    );
    await pickWithKeyboard(
      page,
      page.getByRole("combobox", { name: tField.destinationLabel }),
      "Piassa",
    );
    await expect(page).toHaveURL(/[?&]corridor_id=[0-9a-f-]{36}/);
    await expect(row("R-21")).toBeVisible();
    await expect(row("S-03")).toBeHidden();

    await pickWithKeyboard(
      page,
      page.getByRole("combobox", { name: t.companyFilter }),
      "Addis Brewery",
    );
    await expect(page).toHaveURL(/[?&]company_id=[0-9a-f-]{36}/);
    await expect(row("R-21")).toBeVisible();
    await expect(row("B-01")).toBeHidden();
  });

  test("staff add a route of each type, and a taken code is explained", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Froutes");
    for (const type of ["public", "student", "corporate"] as const) {
      const { code, dialog } = await addRoute(page, type);
      await expect(
        page.getByText(fill(t.addedToast, { code: code.toUpperCase() })),
      ).toBeVisible();
      await expect(dialog).toBeHidden();
    }

    const { dialog } = await addRoute(page, "public", "B-01");
    await expect(dialog.getByText(t.codeTaken)).toBeVisible();
    await expect(dialog.getByLabel(t.codeLabel)).toBeFocused();
  });

  test("staff edit a route, and refusals are explained", async ({ page }) => {
    await signIn(page, "staff", "/sign-in?next=%2Froutes");
    const { code } = await addRoute(page, "public");
    await page.getByLabel(t.searchLabel).fill(code);
    const details = await openRoute(page, code.toUpperCase());
    await details.getByRole("button", { name: t.edit, exact: true }).click();
    const edit = page.getByRole("dialog", {
      name: fill(t.editTitle, { code: code.toUpperCase() }),
    });
    await edit.getByLabel(t.seatsLabel).fill("16");
    await edit.getByRole("button", { name: t.save }).click();
    await expect(
      page.getByText(fill(t.savedToast, { code: code.toUpperCase() })),
    ).toBeVisible();
    await expect(
      details.getByText(fill(t.seatsTotal, { seats: 16 })),
    ).toBeVisible();

    // S-03 has open route requests: its school is fixed.
    await page.goto("/routes/00000000-0000-4000-d000-000000000004");
    const student = page.getByRole("article", { name: "S-03" });
    await student.getByRole("button", { name: t.edit, exact: true }).click();
    const editStudent = page.getByRole("dialog", {
      name: fill(t.editTitle, { code: "S-03" }),
    });
    await editStudent.getByLabel(t.schoolLabel).fill("Another School");
    await editStudent.getByRole("button", { name: t.save }).click();
    await expect(editStudent.getByText(t.hasRequests)).toBeVisible();
  });

  test("details open beside the list on wide screens and as a page on phones", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Froutes");
    await page.getByLabel(t.searchLabel).fill("B-01");
    const details = await openRoute(page, "B-01");

    await expect(details.getByText("Megenagna")).toBeVisible();
    await expect(
      details.getByRole("meter", {
        name: fill(messages.LaunchProgress.needed, {
          reserved: 7,
          minimum: 10,
        }),
      }),
    ).toBeVisible();
    if (isWide(page)) {
      await expect(page).toHaveURL(new RegExp(`/routes\\?route=${B01}$`));
    } else {
      await expect(page).toHaveURL(new RegExp(`/routes/${B01}$`));
    }
  });

  test("a van copied from a deleted route says so, and a company's routes link to them", async ({
    page,
  }) => {
    await signIn(page, "staff");
    await page.goto(`/routes/${B02}`);
    await expect(
      page
        .getByRole("article", { name: "B-02" })
        .getByText(t.copiedFromDeleted),
    ).toBeVisible();

    await page.goto("/companies/00000000-0000-4000-c000-000000000001");
    await page
      .getByRole("article", { name: "Addis Brewery" })
      .getByRole("link", { name: "R-21" })
      .click();
    await expect(page).toHaveURL(
      /\/routes\/00000000-0000-4000-d000-000000000001$/,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "R-21" }),
    ).toBeVisible();
    await expect(
      page.getByRole("article", { name: "R-21" }).getByText(t.rateAgreed),
    ).toBeVisible();
  });
  test("an admin sets a route's prices; staff see them; corporate routes have none", async ({
    page,
  }) => {
    await signIn(page, "admin", "/sign-in?next=%2Froutes");
    const { code, dialog } = await addRoute(page, "public");
    await expect(dialog).toBeHidden();
    await page.getByLabel(t.searchLabel).fill(code);
    const details = await openRoute(page, code.toUpperCase());

    await details.getByRole("button", { name: t.setPrices }).click();
    const prices = page.getByRole("dialog", {
      name: fill(t.pricesTitle, { code: code.toUpperCase() }),
    });
    await prices.getByLabel(t.roundTripLabel).fill("2600");
    await prices.getByLabel(t.oneWayLabel).fill("1500");
    await prices.getByLabel(t.saturdayLabel).fill("350");
    await prices.getByRole("button", { name: t.save }).click();
    await expect(
      page.getByText(fill(t.pricesSaved, { code: code.toUpperCase() })),
    ).toBeVisible();
    const shown = details.getByRole("group", { name: t.prices });
    await expect(shown).toContainText("2,600 birr");
    await expect(shown).toContainText("350 birr");
    await expect(
      details.getByRole("button", { name: t.changePrices }),
    ).toBeVisible();

    // A student route has no Saturday add-on.
    await page.goto("/routes");
    const added = await addRoute(page, "student");
    await expect(added.dialog).toBeHidden();
    await page.getByLabel(t.searchLabel).fill(added.code);
    const student = await openRoute(page, added.code.toUpperCase());
    await student.getByRole("button", { name: t.setPrices }).click();
    const studentPrices = page.getByRole("dialog", {
      name: fill(t.pricesTitle, { code: added.code.toUpperCase() }),
    });
    await expect(studentPrices.getByLabel(t.roundTripLabel)).toBeVisible();
    await expect(studentPrices.getByLabel(t.saturdayLabel)).toHaveCount(0);
    await page.keyboard.press("Escape");

    // A corporate route: the agreed rate, no prices to set.
    await page.goto("/routes/00000000-0000-4000-d000-000000000001");
    const corporate = page.getByRole("article", { name: "R-21" });
    await expect(corporate.getByText(t.rateAgreed)).toBeVisible();
    await expect(
      corporate.getByRole("button", { name: t.setPrices }),
    ).toHaveCount(0);
  });

  test("staff see prices but can't set them", async ({ page }) => {
    await signIn(page, "staff");
    await page.goto(`/routes/${B01}`);
    const details = page.getByRole("article", { name: "B-01" });
    await expect(details.getByRole("group", { name: t.prices })).toContainText(
      "2,400 birr",
    );
    await expect(
      details.getByRole("button", { name: t.edit, exact: true }),
    ).toBeVisible();

    await expect(
      details.getByRole("button", { name: t.changePrices }),
    ).toHaveCount(0);
  });
  test("staff set a route's areas served with the keyboard, and clearing them frees the corridor", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Froutes");
    const { code, dialog } = await addRoute(page, "public");
    await expect(dialog).toBeHidden();
    const upper = code.toUpperCase();
    await page.getByLabel(t.searchLabel).fill(code);
    const details = await openRoute(page, upper);

    await details.getByRole("button", { name: t.editAreas }).click();
    const editor = page.getByRole("dialog", {
      name: fill(t.areasTitle, { code: upper }),
    });
    const picker = editor.getByRole("combobox", { name: t.addAreaLabel });
    const listed = editor
      .getByRole("list", {
        name: fill(t.areasListLabel, { origin: "Ayat", destination: "CMC" }),
      })
      .getByRole("listitem");
    for (const [index, area] of ["Megenagna", "Mexico", "Bole"].entries()) {
      // The add picker empties itself again: the area shows in the list instead.
      await picker.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.type(area);
      await expect(
        page.getByRole("option", { name: area, exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(listed).toHaveCount(index + 1);
      await expect(picker).toBeFocused();
    }
    // Move Bole to the front and drop Mexico, with the keyboard.
    const boleUp = editor.getByRole("button", {
      name: fill(t.moveUp, { name: "Bole" }),
    });
    await boleUp.focus();
    await page.keyboard.press("Enter");
    await expect(boleUp).toBeFocused();
    await page.keyboard.press("Enter");
    await editor
      .getByRole("button", { name: fill(t.removeArea, { name: "Mexico" }) })
      .focus();
    await page.keyboard.press("Enter");
    await editor.getByRole("button", { name: t.save }).click();
    await expect(
      page.getByText(fill(t.areasSaved, { code: upper })),
    ).toBeVisible();
    await expect(
      details
        .getByRole("list", { name: t.areasServedLabel })
        .getByRole("listitem"),
    ).toHaveText(["Ayat", "→Bole", "→Megenagna", "→CMC"]);

    // While it serves areas, its corridor can't change.
    const changeCorridor = async () => {
      await details.getByRole("button", { name: t.edit, exact: true }).click();
      const edit = page.getByRole("dialog", {
        name: fill(t.editTitle, { code: upper }),
      });
      await pickWithKeyboard(
        page,
        edit.getByRole("combobox", { name: tField.originLabel }),
        "Megenagna",
      );
      await pickWithKeyboard(
        page,
        edit.getByRole("combobox", { name: tField.destinationLabel }),
        "Mexico",
      );
      await expect(
        edit.getByText(
          fill(tField.found, { origin: "Megenagna", destination: "Mexico" }),
        ),
      ).toBeVisible();
      await edit.getByRole("button", { name: t.save }).click();
      return edit;
    };
    const refused = await changeCorridor();
    await expect(refused.getByText(t.corridorHasAreas)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(refused).toBeHidden();

    await details.getByRole("button", { name: t.editAreas }).click();
    for (const area of ["Bole", "Megenagna"]) {
      await editor
        .getByRole("button", { name: fill(t.removeArea, { name: area }) })
        .click();
    }
    await editor.getByRole("button", { name: t.save }).click();
    await expect(editor).toBeHidden();

    const accepted = await changeCorridor();
    await expect(accepted).toBeHidden();
    await expect(
      page.getByText(fill(t.savedToast, { code: upper })),
    ).toBeVisible();
  });
});

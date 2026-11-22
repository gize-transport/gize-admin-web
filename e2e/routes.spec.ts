import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { chooseFilter } from "./support/filters";
import { signIn } from "./support/auth";
import { expectNoSeriousA11yViolations } from "./support/axe";
import { actionItems, actionsButton, chooseAction } from "./support/actions";
import { openTab } from "./support/tabs";

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
  // A form's picker shows the name; a toolbar's, "From: Piassa".
  await expect(picker).toHaveText(
    new RegExp(`(^|: )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
  );
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
    await chooseFilter(page, t.typeFilter, t.typeStudent);
    await expect(page).toHaveURL(/[?&]route_type=student/);
    await expect(row("S-03")).toBeVisible();
    await search.fill("b-");
    await expect(table).toBeHidden(); // no student route's code starts with B-
    await search.fill("");
    await chooseFilter(page, t.typeFilter, messages.DataTable.all);

    await chooseFilter(
      page,
      t.statusFilter,
      messages.RouteStatus.formingNoMinimum,
    );
    await expect(row("B-01")).toBeVisible();
    await expect(row("S-03")).toBeHidden();
    // Ready to launch is the API's own filter (GZ-083): B-41 has 5 of 5 reserved, B-01 7 of 10.
    const readyRead = page.waitForResponse(
      (response) =>
        new URL(response.url()).searchParams.get("ready_to_launch") === "true",
    );
    await chooseFilter(page, t.statusFilter, t.statusReady);
    expect(new URL((await readyRead).url()).searchParams.has("status")).toBe(
      false,
    );
    await expect(page).toHaveURL(/[?&]status=ready/);
    await expect(row("B-41")).toBeVisible();
    await expect(row("B-01")).toBeHidden();
    await chooseFilter(page, t.statusFilter, messages.DataTable.all);

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

  test("staff sort routes by code, kept in the address, and back to newest first", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Froutes");
    const table = page.getByRole("table", { name: t.tableLabel });
    // Other tests add routes: the sample B- ones are found by searching.
    await page.getByLabel(t.searchLabel).fill("b-");
    await expect(table.getByRole("link", { name: "B-01" })).toBeVisible();
    // Each row's code, in the first column.
    const rowCodes = () =>
      table
        .locator("tbody tr > :first-child")
        .getByRole("link")
        .allTextContents();
    const codes = async () =>
      (await rowCodes()).filter((code) =>
        ["B-01", "B-02", "B-07"].includes(code),
      );

    await page
      .getByRole("button", { name: messages.DataTable.sort, exact: true })
      .click();
    await expect(
      page.getByRole("menu", { name: messages.DataTable.sort }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await page.keyboard.press("Escape");
    await chooseFilter(page, messages.DataTable.sort, t.sortCode);
    await expect(page).toHaveURL(/[?&]sort=code/);
    await expect.poll(codes).toEqual(["B-01", "B-02", "B-07"]);

    // A reload keeps the order; the search box starts empty again.
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: `${messages.DataTable.sort}: ${t.sortCode}`,
      }),
    ).toBeVisible();
    await expect.poll(codes).toEqual(["B-01", "B-02", "B-07"]);

    await chooseFilter(
      page,
      messages.DataTable.sort,
      messages.DataTable.sortNewest,
    );
    await expect(page).not.toHaveURL(/[?&]sort=/);
    await expect(
      page.getByRole("button", { name: messages.DataTable.sort, exact: true }),
    ).toBeVisible();
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
    // By keyboard: on phones the "Route added" toast can sit over the button (and stays while
    // the pointer rests on it).
    await details
      .getByRole("button", { name: t.edit, exact: true })
      .press("Enter");
    const edit = page.getByRole("dialog", {
      name: fill(t.editTitle, { code: code.toUpperCase() }),
    });
    await edit.getByLabel(t.seatsLabel).fill("16");
    await edit.getByRole("button", { name: t.save }).click();
    await expect(
      page.getByText(fill(t.savedToast, { code: code.toUpperCase() })),
    ).toBeVisible();
    // The seats tiles count against the new total.
    await expect(
      details
        .getByRole("group", { name: t.glanceLabel })
        .getByText(/ of 16 taken$/)
        .first(),
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
    // The search is written to the address after a pause in typing: wait for it, so the
    // address checked below doesn't depend on how fast the route was opened.
    await expect(page).toHaveURL(/[?&]q=B-01(&|$)/);
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
      // The panel joins the search in the address (Back closes it, keeping the search).
      await expect(page).toHaveURL(
        new RegExp(`/routes\\?q=B-01&route=${B01}$`),
      );
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
  test("a route starts forming only once priced, and goes back to draft", async ({
    page,
  }) => {
    await signIn(page, "admin", "/sign-in?next=%2Froutes");
    const { code, dialog } = await addRoute(page, "public");
    await expect(dialog).toBeHidden();
    const upper = code.toUpperCase();
    await page.getByLabel(t.searchLabel).fill(code);
    const details = await openRoute(page, upper);

    const startForming = details.getByRole("button", {
      name: t.moveStartForming,
    });
    await openTab(details, t.tabStatus);
    await expect(startForming).toHaveAttribute("aria-disabled", "true");
    await expect(details.getByText(t.blockedPrices)).toBeVisible();

    await openTab(details, t.tabDetails);
    await details.getByRole("button", { name: t.setPrices }).click();
    const prices = page.getByRole("dialog", {
      name: fill(t.pricesTitle, { code: upper }),
    });
    await prices.getByLabel(t.roundTripLabel).fill("2400");
    await prices.getByLabel(t.oneWayLabel).fill("1400");
    await prices.getByRole("button", { name: t.save }).click();
    await expect(prices).toBeHidden();

    await openTab(details, t.tabStatus);
    await expect(startForming).not.toHaveAttribute("aria-disabled");
    await startForming.click();
    const confirm = page.getByRole("alertdialog", {
      name: fill(t.confirmStartFormingTitle, { code: upper }),
    });
    await confirm.getByRole("button", { name: t.moveStartForming }).click();
    await expect(
      page.getByText(
        fill(t.statusChanged, {
          code: upper,
          status: messages.RouteStatus.formingNoMinimum,
        }),
      ),
    ).toBeVisible();
    // The pressed button is gone (Back to draft replaces it): focus goes to the moves.
    const moves = details.getByRole("group", { name: t.statusActionsLabel });
    await expect(moves).toBeFocused();

    await details.getByRole("button", { name: t.moveBackToDraft }).click();
    await page
      .getByRole("alertdialog", {
        name: fill(t.confirmBackToDraftTitle, { code: upper }),
      })
      .getByRole("button", { name: t.moveBackToDraft })
      .click();
    await expect(
      page.getByText(
        fill(t.statusChanged, {
          code: upper,
          status: messages.RouteStatus.draft,
        }),
      ),
    ).toBeVisible();
    await expect(startForming).toBeVisible();
    await expect(moves).toBeFocused();
  });

  test("staff launch a ready route for a chosen month, then pause and resume it", async ({
    page,
  }) => {
    // One ready route per project (the data is shared, and a launch can't be undone).
    const [id, code] = isWide(page)
      ? ["00000000-0000-4000-d000-000000000006", "B-04"]
      : ["00000000-0000-4000-d000-000000000007", "B-05"];
    await signIn(page, "staff");
    // Straight to the route's status tab, from the address.
    await page.goto(`/routes/${id}?tab=status`);
    const details = page.getByRole("article", { name: code });

    // A launch can't be undone: on a retry (CI) the route is already active, so go on to pause.
    if (test.info().retry === 0) {
      await details.getByRole("button", { name: t.moveLaunch }).click();
      const launch = page.getByRole("dialog", {
        name: fill(t.launchTitle, { code }),
      });
      const months = launch.getByRole("radiogroup", {
        name: t.launchMonthsLabel,
      });
      await expect(months.getByRole("radio").first()).toBeChecked();
      await months.getByRole("radio").nth(1).check();
      await expect(launch.getByText(/becomes active now/)).toBeVisible();
      await launch.getByRole("button", { name: t.moveLaunch }).click();
      await expect(
        page.getByText(new RegExp(`^${code} launched`)),
      ).toBeVisible();
      await expect(launch).toBeHidden();
      // Its riders are texted after the launch: the page follows them until they're sent.
      const texts = details.getByRole("list", {
        name: messages.LaunchMessages.listLabel,
      });
      await expect(texts.getByRole("listitem")).toHaveCount(6);
      await expect(
        texts.getByText(messages.LaunchMessages.status.sent, { exact: true }),
      ).toHaveCount(6, { timeout: 15_000 });
    }

    await details.getByRole("button", { name: t.movePause }).click();
    await page
      .getByRole("alertdialog", { name: fill(t.confirmPauseTitle, { code }) })
      .getByRole("button", { name: t.movePause })
      .click();
    await expect(
      page.getByText(
        fill(t.statusChanged, { code, status: messages.RouteStatus.paused }),
      ),
    ).toBeVisible();

    await details.getByRole("button", { name: t.moveResume }).click();
    await page
      .getByRole("alertdialog", { name: fill(t.confirmResumeTitle, { code }) })
      .getByRole("button", { name: t.moveResume })
      .click();
    await expect(
      page.getByText(
        fill(t.statusChanged, { code, status: messages.RouteStatus.active }),
      ),
    ).toBeVisible();
  });

  test("an admin deletes a route; one with riders or requests is refused", async ({
    page,
  }) => {
    await signIn(page, "admin", "/sign-in?next=%2Froutes");
    const { code, dialog } = await addRoute(page, "public");
    await expect(dialog).toBeHidden();
    const upper = code.toUpperCase();
    await page.getByLabel(t.searchLabel).fill(code);
    const details = await openRoute(page, upper);
    await chooseAction(page, details, t.deleteRoute);
    await page
      .getByRole("alertdialog", { name: fill(t.deleteTitle, { code: upper }) })
      .getByRole("button", { name: t.deleteRoute })
      .click();
    await expect(
      page.getByText(fill(t.deleted, { code: upper })),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/routes(\?q=[^&]*)?$/);

    for (const [id, codeOf, reason] of [
      [B01, "B-01", t.deleteHasRiders],
      ["00000000-0000-4000-d000-000000000004", "S-03", t.deleteHasRequests],
    ] as const) {
      await page.goto(`/routes/${id}`);
      await chooseAction(
        page,
        page.getByRole("article", { name: codeOf }),
        t.deleteRoute,
      );
      const confirm = page.getByRole("alertdialog");
      await confirm.getByRole("button", { name: t.deleteRoute }).click();
      await expect(confirm.getByText(reason)).toBeVisible();
      await page.keyboard.press("Escape");
    }
  });
  test("a route's details, status and seat offers sit in tabs kept in the address", async ({
    page,
  }) => {
    await signIn(page, "staff");
    await page.goto(`/routes/${B01}`);
    const details = page.getByRole("article", { name: "B-01" });
    const tabs = details.getByRole("tablist", {
      name: fill(t.tabsLabel, { code: "B-01" }),
    });
    await expect(tabs.getByRole("tab")).toHaveText([
      t.tabDetails,
      t.tabStatus,
      t.tabOffers,
    ]);
    // At a glance, above the tabs: seats, riders to launch, the driver.
    const glance = details.getByRole("group", { name: t.glanceLabel });
    await expect(glance).toContainText(t.tileThisMonth);
    await expect(
      glance.getByRole("button", { name: t.chooseDriver }),
    ).toBeVisible();
    await expect(details.getByRole("group", { name: t.prices })).toBeVisible();

    await openTab(details, t.tabStatus);
    await expect(page).toHaveURL(new RegExp(`/routes/${B01}\\?tab=status$`));
    await expect(
      details.getByRole("button", { name: t.moveLaunch }),
    ).toBeVisible();
    await expect(details.getByRole("group", { name: t.prices })).toBeHidden();

    // Arrow keys move between tabs; a reload keeps the one shown.
    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: t.tabOffers })).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`/routes/${B01}\\?tab=offers$`));
    await page.reload();
    await expect(
      details.getByRole("tab", { name: t.tabOffers }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      details.getByRole("button", { name: messages.Offers.offer }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
  test("a route's name and buttons stay in view while its details scroll", async ({
    page,
  }) => {
    // A short window, so the details are longer than it at both widths.
    const width = page.viewportSize()?.width ?? 1440;
    await page.setViewportSize({ width, height: 420 });
    await signIn(page, "staff");
    await page.goto(`/routes/${B01}`);
    const details = page.getByRole("article", { name: "B-01" });
    const row = details.locator("[data-slot='detail-header-row']");
    await expect(row).not.toHaveAttribute("data-stuck");

    // To the end of the route's details.
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );

    await expect(row).toHaveAttribute("data-stuck", "");
    // The page has scrolled (the link back is gone), the row hasn't.
    await expect(
      details.getByRole("link", { name: t.backToList }),
    ).not.toBeInViewport();
    await expect(
      details.getByRole("group", { name: t.prices }),
    ).toBeInViewport();
    await expect(
      details.getByRole("heading", { level: 1, name: "B-01" }),
    ).toBeInViewport();
    await expect(
      details.getByRole("button", { name: t.edit, exact: true }),
    ).toBeInViewport();
    await expect(actionsButton(details)).toBeInViewport();
    expect(await actionItems(page, details)).toEqual([
      t.addVan,
      messages.Detail.copyLink,
    ]);

    // Beside the list (wide screens), the panel scrolls inside itself, under the same row.
    if (isWide(page)) {
      await page.goto(`/routes?route=${B01}`);
      const panel = page.getByRole("region", { name: "B-01" });
      const panelRow = panel.locator("[data-slot='detail-header-row']");
      await expect(panelRow).not.toHaveAttribute("data-stuck");
      await panel.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect(panelRow).toHaveAttribute("data-stuck", "");
      await expect(
        panel.getByRole("group", { name: t.prices }),
      ).toBeInViewport();
      await expect(
        panel.getByRole("button", { name: t.closeDetail }),
      ).toBeInViewport();
      await expect(actionsButton(panel)).toBeInViewport();
    }
  });
  test("Launch opens when only the earliest month lacks riders, offering the ready ones", async ({
    page,
  }) => {
    await signIn(page, "staff");
    await page.goto(`/routes/${B01}?tab=status`);
    const details = page.getByRole("article", { name: "B-01" });
    const launchButton = details.getByRole("button", { name: t.moveLaunch });
    // The reason stays shown, and the button can still be used.
    await expect(launchButton).not.toHaveAttribute("aria-disabled");
    await expect(
      details.getByText(/7 of 10 riders reserved for/),
    ).toBeVisible();

    await launchButton.click();
    const launch = page.getByRole("dialog", {
      name: fill(t.launchTitle, { code: "B-01" }),
    });
    const months = launch.getByRole("radio");
    await expect(months.first()).toBeDisabled();
    await expect(months.nth(1)).toBeChecked();
    // Not launched here: B-01 is shared sample data.
    await launch.getByRole("button", { name: messages.Common.cancel }).click();
    await expect(launch).toBeHidden();
  });
  test("staff add a van: it copies the route, starts as the API says, and opens", async ({
    page,
  }) => {
    await signIn(page, "staff");
    // From B-01 (public, priced, two areas served): the van starts forming.
    await page.goto(`/routes/${B01}`);
    await chooseAction(
      page,
      page.getByRole("article", { name: "B-01" }),
      t.addVan,
    );
    const dialog = page.getByRole("dialog", {
      name: fill(t.vanTitle, { code: "B-01" }),
    });
    await expect(dialog.getByLabel(t.seatsLabel)).toHaveValue("14");
    const code = `VAN-${randomUUID().slice(0, 6)}`.toUpperCase();
    await dialog.getByLabel(t.codeLabel).fill(code.toLowerCase());
    await dialog.getByRole("button", { name: t.addVan }).click();
    await expect(
      page.getByText(fill(t.vanAdded, { code, start: t.vanStartsForming })),
    ).toBeVisible();

    // The new van's page, its name focused: copied from B-01, same corridor, areas and prices.
    await expect(
      page.getByRole("heading", { level: 1, name: code }),
    ).toBeFocused();
    const van = page.getByRole("article", { name: code });
    await expect(van.getByRole("link", { name: "B-01" })).toBeVisible();
    await expect(
      van.getByRole("list", { name: t.areasServedLabel }).getByRole("listitem"),
    ).toHaveText(["Bole", "→Megenagna", "→Mexico", "→Piassa"]);
    await expect(van.getByRole("group", { name: t.prices })).toContainText(
      "2,400 birr",
    );

    // A code already used is refused on the code field.
    await chooseAction(page, van, t.addVan);
    const again = page.getByRole("dialog", {
      name: fill(t.vanTitle, { code }),
    });
    await again.getByLabel(t.codeLabel).fill("B-02");
    await again.getByRole("button", { name: t.addVan }).click();
    await expect(again.getByText(t.codeTaken)).toBeVisible();
    await expect(again.getByLabel(t.codeLabel)).toBeFocused();
  });

  test("a van from a corporate route has no launch minimum, starts as a draft, and opens in its place", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Froutes");
    await page.getByLabel(t.searchLabel).fill("R-21");
    const details = await openRoute(page, "R-21");
    await chooseAction(page, details, t.addVan);
    const dialog = page.getByRole("dialog", {
      name: fill(t.vanTitle, { code: "R-21" }),
    });
    await expect(
      dialog.getByText(/the company \(Addis Brewery\)/),
    ).toBeVisible();
    await expect(dialog.getByLabel(t.launchMinimumLabel)).toHaveCount(0);
    const code = `VAN-${randomUUID().slice(0, 6)}`.toUpperCase();
    await dialog.getByLabel(t.codeLabel).fill(code);
    await dialog.getByRole("button", { name: t.addVan }).click();
    await expect(
      page.getByText(fill(t.vanAdded, { code, start: t.vanStartsDraft })),
    ).toBeVisible();
    // The van replaces R-21 beside the list (its own page on phones), and has focus.
    if (isWide(page)) {
      await expect(page.getByRole("region", { name: code })).toBeFocused();
      await expect(page).toHaveURL(/\/routes\?.*route=/);
      await expect(page.getByRole("region", { name: "R-21" })).toHaveCount(0);
    } else {
      await expect(
        page.getByRole("heading", { level: 1, name: code }),
      ).toBeFocused();
    }
  });
});

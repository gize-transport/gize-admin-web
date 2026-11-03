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
    await expect(row("S-03")).toBeVisible();

    await page.getByLabel(t.searchLabel).fill("b-");
    await expect(row("B-01")).toBeVisible();
    await expect(row("B-02")).toBeVisible();
    await expect(row("S-03")).toBeHidden();
    await page.getByLabel(t.searchLabel).fill("");

    await page.getByRole("button", { name: t.typeStudent }).click();
    await expect(page).toHaveURL(/[?&]route_type=student/);
    await expect(row("S-03")).toBeVisible();
    await expect(row("B-01")).toBeHidden();
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
    await details.getByRole("button", { name: t.edit }).click();
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
    await student.getByRole("button", { name: t.edit }).click();
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
});

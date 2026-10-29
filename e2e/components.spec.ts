import { expect, test, type Page } from "@playwright/test";
import messages from "../messages/en.json";

// Flows for the shared components, run on the dev-only gallery (/dev/components).
const t = messages.DevComponents;
const dt = messages.DataTable;

function routesTable(page: Page) {
  return page.getByRole("table", { name: t.routesLabel });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/dev/components");
  // The gallery renders on the client; wait for it so layout checks see the full page.
  await expect(routesTable(page)).toBeVisible();
});

test.describe("brand", () => {
  test("uses the brand fonts and the neutral canvas background", async ({
    page,
  }) => {
    const h1 = page.getByRole("heading", { level: 1, name: t.title });
    await expect(h1).toHaveCSS("font-family", /Sora/);
    await expect(page.getByText(t.description)).toHaveCSS(
      "font-family",
      /Noto Sans/,
    );
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(246, 248, 251)",
    );
  });

  test("page fits the viewport without horizontal scrolling", async ({
    page,
  }) => {
    // Compare with the configured width: mobile emulation widens window.innerWidth to fit content.
    const viewportWidth = page.viewportSize()?.width ?? 0;
    const pageWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(pageWidth).toBeLessThanOrEqual(viewportWidth);
  });
});

test.describe("data table", () => {
  test("filters through the URL and resets to the first page", async ({
    page,
  }) => {
    const table = routesTable(page);
    await expect(table.getByRole("row")).toHaveCount(6); // header + 5

    await page.getByRole("link", { name: dt.nextPage }).click();
    await expect(page).toHaveURL(/cursor=/);

    await page
      .getByRole("group", { name: t.routeTypeFilter })
      .getByRole("button", { name: t.typeStudent })
      .click();

    await expect(page).toHaveURL(/\?type=student$/);
    await expect(
      page.getByRole("button", { name: t.typeStudent }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(table.getByRole("cell", { name: t.typePublic })).toHaveCount(
      0,
    );
    await expect(
      table.getByRole("cell", { name: t.typeStudent }),
    ).not.toHaveCount(0);
  });

  test("pages forward with Next, back with the browser and to the start with First page", async ({
    page,
  }) => {
    const table = routesTable(page);
    const firstRoute = table.getByRole("row").nth(1);
    const page1First = await firstRoute.getByRole("button").innerText();

    await page.getByRole("link", { name: dt.nextPage }).click();
    await expect(page).toHaveURL(/cursor=5/);
    await expect(firstRoute.getByRole("button")).not.toHaveText(page1First);

    await page.goBack();
    await expect(page).not.toHaveURL(/cursor=/);
    await expect(firstRoute.getByRole("button")).toHaveText(page1First);

    await page.getByRole("link", { name: dt.nextPage }).click();
    await page.getByRole("link", { name: dt.nextPage }).click();
    await expect(page).toHaveURL(/cursor=10/);
    await expect(page.getByRole("link", { name: dt.nextPage })).toHaveCount(0);

    await page.getByRole("link", { name: dt.firstPage }).click();
    await expect(page).toHaveURL(/\/dev\/components$/);
    await expect(firstRoute.getByRole("button")).toHaveText(page1First);
  });

  test("opens a row by clicking a cell or with the keyboard", async ({
    page,
  }) => {
    const table = routesTable(page);
    const secondRow = table.getByRole("row").nth(2);
    const routeCode = await secondRow.getByRole("button").innerText();

    await secondRow.getByRole("cell").nth(2).click();
    await expect(page.getByText(`Selected: ${routeCode}`)).toBeVisible();
    await expect(secondRow).toHaveAttribute("data-state", "selected");

    const thirdRowAction = table.getByRole("row").nth(3).getByRole("button");
    const thirdCode = await thirdRowAction.innerText();
    await thirdRowAction.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(`Selected: ${thirdCode}`)).toBeVisible();
    await expect(thirdRowAction).toHaveAttribute("aria-current", "true");
  });

  test("on a phone, scrolls sideways with the first column pinned", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile",
      "The table only overflows at 375 px.",
    );
    const region = page.getByRole("region", { name: t.routesLabel });
    const firstCell = routesTable(page)
      .getByRole("row")
      .nth(1)
      .getByRole("cell")
      .first();
    const before = await firstCell.boundingBox();

    const scrolled = await region.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
      return el.scrollLeft;
    });

    expect(scrolled).toBeGreaterThan(0);
    const after = await firstCell.boundingBox();
    expect(after?.x).toBe(before?.x);
  });
});

test.describe("confirm dialog and toast", () => {
  test("keyboard: opens on Cancel, Escape closes and focus returns", async ({
    page,
  }) => {
    const opener = page.getByRole("button", { name: t.openRoute });
    await opener.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("alertdialog", { name: t.confirmTitle });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: messages.Common.cancel }),
    ).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("confirming shows the pending state, closes and confirms with a toast", async ({
    page,
  }) => {
    await page.getByRole("button", { name: t.openRoute }).click();
    const dialog = page.getByRole("alertdialog", { name: t.confirmTitle });
    const confirm = dialog.getByRole("button", { name: t.confirmAction });

    await confirm.click();

    await expect(confirm).toHaveAttribute("aria-busy", "true");
    await expect(dialog).toBeHidden();
    await expect(page.getByText(t.routeOpened)).toBeVisible();
  });
});

test.describe("problem alert", () => {
  test("copies the request ID for support", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const alert = page.getByRole("alert").filter({ hasText: t.problemMessage });

    await alert
      .getByRole("button", { name: messages.ProblemAlert.copy })
      .click();

    await expect(alert.getByRole("status")).toHaveText(
      messages.ProblemAlert.copied,
    );
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/^req_/);
  });
});

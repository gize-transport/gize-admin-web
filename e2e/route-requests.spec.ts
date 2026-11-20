import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";
import { actionItems, chooseAction } from "./support/actions";

const t = messages.RouteRequests;
const tStatus = messages.RequestStatus;

// Sample data in the stand-in (e2e/support/fake-services.mjs).
const B07 = "00000000-0000-4000-d000-000000000008";
const SELAM = "00000000-0000-4000-e000-000000000001";

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
  await expect(picker).toBeFocused();
}

async function openForm(page: Page) {
  await page.getByRole("button", { name: t.add }).first().click();
  return page.getByRole("dialog", { name: t.addTitle });
}

async function fillWho(dialog: Locator, who: ReturnType<typeof caller>) {
  await dialog.getByLabel(t.riderNameLabel).fill(who.name);
  await dialog.getByLabel(t.contactNameLabel).fill(who.name);
  await dialog.getByLabel(t.contactPhoneLabel).fill(who.phone);
}

/** The request just recorded: beside the list (focused) on wide screens, its page otherwise. */
async function recorded(page: Page, name: string) {
  await expect(page.getByText(t.recordedToast)).toBeVisible();
  if (isWide(page)) {
    const panel = page.getByRole("region", { name });
    await expect(panel).toBeFocused();
    return panel;
  }
  await expect(page.getByRole("heading", { level: 1, name })).toBeFocused();
  return page.getByRole("article", { name });
}

test.describe("route requests", () => {
  test("staff record a new-areas request, match it to a route, then mark it fulfilled", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Froute-requests");
    const who = caller();
    const dialog = await openForm(page);
    await pick(
      page,
      dialog.getByRole("combobox", {
        name: fill(t.endAreaLabel, { end: t.fromLegend }),
      }),
      "Ayat",
    );
    const to = dialog.getByRole("group", { name: t.toLegend });
    await to.getByLabel(t.endNamed).check();
    await to
      .getByLabel(fill(t.endNameLabel, { end: t.toLegend }))
      .fill("Lebu Mebrat");
    await fillWho(dialog, who);
    await dialog.getByLabel(t.morningLabel).fill("07:00");
    await dialog.getByRole("button", { name: t.record }).click();

    const details = await recorded(page, who.name);
    await expect(details.getByText("Lebu Mebrat (not listed)")).toBeVisible();
    await expect(details.getByText(tStatus.new, { exact: true })).toBeVisible();
    // The phone as the API stores it.
    await expect(details.getByText(`+2519${who.phone.slice(2)}`)).toBeVisible();

    await details.getByRole("button", { name: t.match }).click();
    const match = page.getByRole("dialog", { name: t.matchTitle });
    await pick(
      page,
      match.getByRole("combobox", { name: t.matchRouteLabel }),
      "B-07",
    );
    await match.getByRole("button", { name: t.matchSave }).click();
    await expect(
      page.getByText(fill(t.matched, { code: "B-07" })),
    ).toBeVisible();
    await expect(
      details.getByText(fill(tStatus.matched, { code: "B-07" })),
    ).toBeVisible();
    await expect(
      details.getByRole("group", { name: t.nextSteps }),
    ).toBeFocused();

    await details.getByRole("button", { name: t.fulfil }).click();
    const confirm = page.getByRole("alertdialog", { name: t.fulfilTitle });
    await confirm.getByRole("button", { name: t.fulfil }).click();
    await expect(details.getByText(t.closedFulfilled)).toBeVisible();
    await expect(
      details.getByRole("group", { name: t.nextSteps }),
    ).toBeFocused();
  });

  test("a seat on a running route: the same request again points to that route's open requests", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Froute-requests");
    const who = caller();
    for (const attempt of [1, 2]) {
      if (attempt === 2) await page.goto("/route-requests");
      const dialog = await openForm(page);
      await dialog.getByLabel(t.kindRouteOption).check();
      await pick(
        page,
        dialog.getByRole("combobox", { name: t.routeLabel }),
        "B-07",
      );
      await fillWho(dialog, who);
      await dialog.getByRole("button", { name: t.record }).click();
      if (attempt === 1) {
        const details = await recorded(page, who.name);
        await expect(
          details.getByRole("link", { name: /Route B-07/ }),
        ).toHaveAttribute("href", `/routes/${B07}`);
        continue;
      }
      await expect(
        dialog.getByText(fill(t.existsRoute, { code: "B-07" })),
      ).toBeVisible();
      await dialog
        .getByRole("link", { name: fill(t.existsRouteLink, { code: "B-07" }) })
        .click();
    }
    await expect(page).toHaveURL(
      new RegExp(`/route-requests\\?route_id=${B07}&open=true$`),
    );
    await expect(
      page
        .getByRole("table", { name: t.tableLabel })
        .getByRole("link", { name: who.name }),
    ).toBeVisible();
  });

  test("a student's request for a route takes the route's school", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Froute-requests");
    const who = caller();
    const dialog = await openForm(page);
    await dialog.getByLabel(t.kindRouteOption).check();
    await dialog.getByLabel(t.riderStudentOption).check();
    await pick(
      page,
      dialog.getByRole("combobox", { name: t.routeLabel }),
      "S-06",
    );
    await expect(
      dialog.getByText(
        fill(t.schoolFromRoute, { school: "Lycée Guebre-Mariam" }),
      ),
    ).toBeVisible();
    await fillWho(dialog, who);
    await dialog.getByRole("button", { name: t.record }).click();

    const details = await recorded(page, who.name);
    await expect(
      details.getByText(
        fill(t.riderStudentAt, { school: "Lycée Guebre-Mariam" }),
      ),
    ).toBeVisible();
  });

  test("decline with a reason; admins delete a request, staff can't", async ({
    page,
  }) => {
    await signIn(page, "admin", "/sign-in?next=%2Froute-requests");
    const who = caller();
    const dialog = await openForm(page);
    for (const [legend, name] of [
      [t.fromLegend, "Summit"],
      [t.toLegend, "Lebu"],
    ] as const) {
      const end = dialog.getByRole("group", { name: legend });
      await end.getByLabel(t.endNamed).check();
      await end.getByLabel(fill(t.endNameLabel, { end: legend })).fill(name);
    }
    await fillWho(dialog, who);
    await dialog.getByRole("button", { name: t.record }).click();
    const details = await recorded(page, who.name);

    await details.getByRole("button", { name: t.decline }).click();
    const decline = page.getByRole("dialog", { name: t.declineTitle });
    await decline
      .getByLabel(t.declineReasonLabel)
      .fill("No corridor near Summit yet");
    await decline.getByRole("button", { name: t.decline }).click();
    await expect(
      details.getByText("No corridor near Summit yet"),
    ).toBeVisible();
    await expect(details.getByText(t.closedDeclined)).toBeVisible();

    await chooseAction(page, details, t.deleteRequest);
    const confirm = page.getByRole("alertdialog", { name: t.deleteTitle });
    await confirm.getByRole("button", { name: t.deleteRequest }).click();
    await expect(page.getByText(t.deleted)).toBeVisible();
    await expect(page).toHaveURL(/\/route-requests$/);
    // The list has loaded (a sample request shows) before the deleted one is looked for.
    const table = page.getByRole("table", { name: t.tableLabel });
    await expect(
      table.getByRole("link", { name: "Dawit Alemu" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("table", { name: t.tableLabel })
        .getByRole("link", { name: who.name }),
    ).toHaveCount(0);
  });

  test("staff see no Delete, and personal data stays out of the address", async ({
    page,
  }) => {
    await signIn(page, "staff", `/sign-in?next=%2Froute-requests%2F${SELAM}`);
    const details = page.getByRole("article", { name: "Selam Bekele" });
    await expect(details.getByText("+251911000101")).toBeVisible();
    expect(await actionItems(page, details)).not.toContain(t.deleteRequest);
    expect(page.url()).not.toContain("Selam");
    expect(page.url()).not.toContain("251911");
  });
});

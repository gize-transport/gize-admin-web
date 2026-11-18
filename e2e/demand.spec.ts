import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";
import { expectNoSeriousA11yViolations } from "./support/axe";

const t = messages.Demand;
const tRequests = messages.RouteRequests;

/** A card in one of the two lists, by its heading. */
function card(page: Page, list: string, heading: RegExp | string) {
  return page
    .getByRole("list", { name: list })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 3, name: heading }) });
}

test.describe("demand", () => {
  test("from an area pair, staff start the corridor or route it needs (prefilled)", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fdemand");

    // A name not listed yet: add the area (prefilled), or open exactly its requests.
    const lebu = card(page, t.pairsLabel, /Ayat.*Lebu \(not listed\)/);
    // "Lebu" and "lebu" (typed by two callers) count as one pair.
    await expect(lebu).toContainText("2 open requests");
    await expect(lebu.getByRole("button")).toHaveCount(1);
    await expect(
      lebu.getByRole("button", { name: /^Add area Lebu/ }),
    ).toBeVisible();

    // Both listed, no corridor yet: Add route says so; Add corridor is prefilled.
    const cmc = card(page, t.pairsLabel, /CMC.*Mexico/);
    const addRoute = cmc.getByRole("button", { name: t.addRoute });
    await addRoute.click();
    await expect(cmc.getByText(t.noCorridor)).toBeVisible();
    await cmc.getByRole("button", { name: t.addCorridor }).click();
    const corridor = page.getByRole("dialog", {
      name: messages.Corridors.addTitle,
    });
    await expect(
      corridor.getByRole("combobox", { name: messages.Corridors.originLabel }),
    ).toHaveText("CMC");
    await expect(
      corridor.getByRole("combobox", {
        name: messages.Corridors.destinationLabel,
      }),
    ).toHaveText("Mexico");
    await corridor
      .getByRole("button", { name: messages.Common.cancel })
      .click();
    await expect(corridor).toBeHidden();

    // Both listed, with a corridor: the route form starts on it.
    await card(page, t.pairsLabel, /Ayat.*CMC/)
      .getByRole("button", { name: t.addRoute })
      .click();
    const routeForm = page.getByRole("dialog", {
      name: messages.Routes.addTitle,
    });
    await expect(
      routeForm.getByRole("combobox", {
        name: messages.CorridorField.originLabel,
      }),
    ).toHaveText("Ayat");
    await expect(
      routeForm.getByRole("combobox", {
        name: messages.CorridorField.destinationLabel,
      }),
    ).toHaveText("CMC");
  });

  test("a pair's card opens exactly the requests it counts", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fdemand");
    await card(page, t.pairsLabel, /Ayat.*Lebu \(not listed\)/)
      .getByRole("link", { name: /^See these requests/ })
      .click();

    await expect(page).toHaveURL(/to_area_name=Lebu/);
    const pair = page.getByRole("group", { name: tRequests.areasFilter });
    await expect(pair).toContainText("From Ayat to Lebu (not listed)");
    const table = page.getByRole("table", { name: tRequests.tableLabel });
    // Two callers typed it ("Lebu", "lebu"); nothing else is listed.
    await expect(table.getByRole("row")).toHaveCount(3);
    await expect(table).not.toContainText("Mexico");
    await expectNoSeriousA11yViolations(page);

    await pair.getByRole("button", { name: tRequests.clearAreas }).click();
    await expect(page).not.toHaveURL(/area_name/);
    await expect(pair).toBeHidden();
  });

  test("a place callers typed becomes an area from its card, and the card can start a corridor", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Froute-requests");
    // A place no other test (or worker) types.
    const place = `E2E Place ${randomUUID().slice(0, 6)}`;
    await page.getByRole("button", { name: tRequests.add }).first().click();
    const form = page.getByRole("dialog", { name: tRequests.addTitle });
    const from = form.getByRole("combobox", {
      name: tRequests.endAreaLabel.replace("{end}", tRequests.fromLegend),
    });
    await from.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.type("Ayat");
    await page.getByRole("option", { name: "Ayat", exact: true }).click();
    const to = form.getByRole("group", { name: tRequests.toLegend });
    await to.getByLabel(tRequests.endNamed).check();
    await to
      .getByLabel(tRequests.endNameLabel.replace("{end}", tRequests.toLegend))
      .fill(place);
    const who = `E2E Rider ${randomUUID().slice(0, 6)}`;
    await form.getByLabel(tRequests.riderNameLabel).fill(who);
    await form.getByLabel(tRequests.contactNameLabel).fill(who);
    await form
      .getByLabel(tRequests.contactPhoneLabel)
      .fill(`09${String(Date.now()).slice(-8)}`);
    await form.getByRole("button", { name: tRequests.record }).click();
    await expect(page.getByText(tRequests.recordedToast)).toBeVisible();

    await page.goto("/demand");
    const typed = card(
      page,
      t.pairsLabel,
      `from Ayat to ${place} (not listed)`,
    );
    await typed
      .getByRole("button", { name: new RegExp(`^Add area ${place}`) })
      .click();
    const dialog = page.getByRole("dialog", { name: messages.Areas.addTitle });
    await expect(dialog.getByLabel(messages.Areas.nameLabel)).toHaveValue(
      place,
    );
    await dialog.getByRole("button", { name: messages.Areas.save }).click();
    await expect(dialog).toBeHidden();

    // The request now names the area: its card offers the corridor, and takes focus.
    const listed = card(
      page,
      t.pairsLabel,
      new RegExp(`^from Ayat to ${place}$`),
    );
    await expect(listed.getByRole("heading", { level: 3 })).toBeFocused();
    await expect(
      listed.getByRole("button", { name: new RegExp(`^${t.addCorridor}`) }),
    ).toBeVisible();
    await expect(typed).toHaveCount(0);
  });

  test("from a busy route, staff add a van and land on it", async ({
    page,
  }) => {
    await signIn(page, "staff", "/sign-in?next=%2Fdemand");
    const b07 = card(page, t.routesLabel, "B-07");
    await expect(b07).toContainText(/open requests?/);
    await expect(b07).toContainText(/seats? free next month/);

    await b07.getByRole("button", { name: t.addVan }).click();
    const dialog = page.getByRole("dialog", {
      name: messages.Routes.vanTitle.replace("{code}", "B-07"),
    });
    const code = `VAN-${randomUUID().slice(0, 6)}`.toUpperCase();
    await dialog.getByLabel(messages.Routes.codeLabel).fill(code);
    await dialog.getByRole("button", { name: messages.Routes.addVan }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: code }),
    ).toBeFocused();
  });
});

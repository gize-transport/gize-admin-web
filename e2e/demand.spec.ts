import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";

const t = messages.Demand;

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

    // A name not listed yet: nothing to add here (question 8), only its requests.
    const lebu = card(page, t.pairsLabel, /Ayat.*Lebu \(not listed\)/);
    // "Lebu" and "lebu" (typed by two callers) count as one pair.
    await expect(lebu).toContainText("2 open requests");
    await expect(lebu.getByRole("button")).toHaveCount(0);
    await expect(
      lebu.getByRole("link", { name: /^See these requests/ }),
    ).toHaveAttribute("href", "/route-requests?kind=new_areas&status=new");

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

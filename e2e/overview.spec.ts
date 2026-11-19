import { expect, test, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import type { components } from "../src/lib/api/schema";
import { signIn } from "./support/auth";
import { expectNoSeriousA11yViolations } from "./support/axe";

const t = messages.Overview;

/**
 * Opens the overview and returns the counts the page was last given: other tests change the
 * shared data, so read them, never assume. (The page may already have read them once, while
 * signing in landed on it: that answer is gone after the navigation.)
 */
async function openOverview(page: Page) {
  let counts: components["schemas"]["Overview"] | null = null;
  await page.route("**/v1/overview", async (route) => {
    const response = await route.fetch();
    counts = (await response.json()) as components["schemas"]["Overview"];
    await route.fulfill({ response });
  });
  await page.goto("/");
  await expect(page.getByRole("list", { name: t.routesLabel })).toBeVisible();
  return () => {
    if (counts === null) throw new Error("the overview wasn't read");
    return counts;
  };
}

const tile = (page: Page, listLabel: string, label: string) =>
  page
    .getByRole("list", { name: listLabel })
    .getByRole("listitem")
    .filter({ hasText: label });

test.describe("overview", () => {
  test("staff see the API's counts and open the list behind them", async ({
    page,
  }) => {
    await signIn(page, "staff");
    const read = await openOverview(page);
    const counts = read();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.title);
    await expect(
      tile(page, t.ridersLabel, t.riding).getByText(
        String(counts.riders.riding),
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      tile(page, t.ridersLabel, t.starting).getByText(
        String(counts.riders.starting),
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      tile(page, t.moreLabel, t.openOffers).getByText(
        String(counts.seat_offers.open),
        { exact: true },
      ),
    ).toBeVisible();
    // The routes bar says in words what it draws: the latest counts the page was given (the
    // sidebar reads them again too, and other tests change them).
    await expect(async () => {
      const { active, forming, paused, draft } = read().routes;
      const total = active + forming + paused + draft;
      expect(total).toBeGreaterThan(0);
      await expect(
        page.getByRole("img", {
          name: `All ${total} routes: ${active} active, ${forming} forming, ${paused} paused, ${draft} draft`,
        }),
      ).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expectNoSeriousA11yViolations(page);

    // The sample data always has open route requests: Needs action opens them.
    expect(counts.route_requests.open).toBeGreaterThan(0);
    const actions = page.getByRole("list", { name: t.actionLabel });
    await actions.getByRole("link", { name: t.seeOpenRequests }).click();
    await expect(page).toHaveURL(/\/route-requests\?open=true$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.RouteRequests.title,
    );

    // Back on the overview, a count is a link to its list.
    await page.goBack();
    await tile(page, t.moreLabel, t.activeDrivers).getByRole("link").click();
    await expect(page).toHaveURL(/\/drivers\?is_active=true$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.Drivers.title,
    );
  });

  test("the counts are read again when the page is opened again", async ({
    page,
  }) => {
    await signIn(page, "staff");
    await openOverview(page);
    await page
      .getByRole("list", { name: t.routesLabel })
      .getByRole("link", {
        name: new RegExp(`^${messages.RouteStatus.draft} `),
      })
      .click();
    await expect(page).toHaveURL(/\/routes\?status=draft$/);

    const again = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/v1/overview",
    );
    await page.goBack();
    expect((await again).ok()).toBe(true);
  });
});

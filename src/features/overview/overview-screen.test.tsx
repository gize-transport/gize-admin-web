import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { problemResponse } from "../routes/test-support";
import { OverviewScreen } from "./overview-screen";

vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/";
  return mockNavigation(state);
});
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));

const t = messages.Overview;

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)(, number)?\}/g, (_, key: string) => {
    const value = values[key];
    return typeof value === "number"
      ? value.toLocaleString("en-US")
      : String(value);
  });

startMswServer();

const counts: Schemas["Overview"] = {
  as_of: "2026-11-19",
  routes: {
    draft: 1,
    forming: 6,
    active: 12,
    paused: 2,
    ready_to_launch: 2,
    active_without_driver: 1,
  },
  riders: { total: 1180, riding: 140, reserved: 24, starting: 10 },
  route_requests: { open: 9 },
  seat_offers: { open: 3 },
  drivers: { active: 13 },
};

function serveOverview(body: Schemas["Overview"] = counts, seen?: URL[]) {
  server.use(
    http.get(apiUrl("/v1/overview"), ({ request }) => {
      seen?.push(new URL(request.url));
      return HttpResponse.json(body);
    }),
  );
}

/** A tile in a section's list, by its label. */
function tile(listLabel: string, label: string) {
  const list = screen.getByRole("list", { name: listLabel });
  const item = within(list)
    .getAllByRole("listitem")
    .find((li) => li.textContent?.startsWith(label));
  if (!item) throw new Error(`no tile ${label}`);
  return item;
}

describe("OverviewScreen", () => {
  it("dates the counts with the API's day and asks for nothing else", async () => {
    const seen: URL[] = [];
    serveOverview(counts, seen);
    renderWithProviders(<OverviewScreen />);

    expect(
      await screen.findByText(
        "Thursday, November 19 · today's counts, Addis Ababa time",
      ),
    ).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      t.title,
    );
    // It takes no parameters (any is a 422).
    expect(seen.map((url) => url.search)).toEqual([""]);
  });

  it("lists what needs action, each with the list that holds it", async () => {
    serveOverview();
    renderWithProviders(<OverviewScreen />);

    const actions = await screen.findByRole("list", { name: t.actionLabel });
    const cards = within(actions).getAllByRole("listitem");
    expect(
      cards.map((card) => within(card).getByRole("heading").textContent),
    ).toEqual([
      "2 routes are ready to launch",
      "1 active route has no driver",
      "9 open route requests",
    ]);
    expect(
      within(cards[0]!).getByRole("link", { name: t.seeForming }),
    ).toHaveAttribute("href", "/routes?status=forming");
    expect(
      within(cards[1]!).getByRole("link", { name: t.seeActive }),
    ).toHaveAttribute("href", "/routes?status=active");
    expect(
      within(cards[2]!).getByRole("link", { name: t.seeOpenRequests }),
    ).toHaveAttribute("href", "/route-requests?open=true");
    expect(
      within(cards[2]!).getByRole("link", { name: t.seeDemand }),
    ).toHaveAttribute("href", "/demand");
    // Rows in one card, each with an icon for sight only.
    for (const card of cards) {
      expect(card.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("shows only the items above 0, in the singular for one", async () => {
    serveOverview({
      ...counts,
      routes: {
        ...counts.routes,
        ready_to_launch: 1,
        active_without_driver: 0,
      },
      route_requests: { open: 1 },
    });
    renderWithProviders(<OverviewScreen />);

    const actions = await screen.findByRole("list", { name: t.actionLabel });
    expect(
      within(actions)
        .getAllByRole("heading")
        .map((heading) => heading.textContent),
    ).toEqual(["1 route is ready to launch", "1 open route request"]);
  });

  it("says so when nothing needs action", async () => {
    serveOverview({
      ...counts,
      routes: {
        ...counts.routes,
        ready_to_launch: 0,
        active_without_driver: 0,
      },
      route_requests: { open: 0 },
    });
    renderWithProviders(<OverviewScreen />);

    expect(await screen.findByText(t.nothingNeeded)).toBeVisible();
    expect(screen.queryByRole("list", { name: t.actionLabel })).toBeNull();
  });

  it("shows routes as the stages a route moves through, each opening its routes", async () => {
    serveOverview();
    renderWithProviders(<OverviewScreen />);

    const stages = await screen.findByRole("list", { name: t.routesLabel });
    const links = within(stages).getAllByRole("link");
    // Draft → Forming → Active, in that order.
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/routes?status=draft",
      "/routes?status=forming",
      "/routes?status=active",
    ]);
    // Read out with the count named, so it isn't run into the tag's number.
    expect(links[0]).toHaveAccessibleName(
      `${messages.RouteStatus.draft} 1 route, ${t.stageDraftHint}`,
    );
    expect(links[1]).toHaveAccessibleName(
      `${messages.RouteStatus.formingNoMinimum} 6 routes, ${fill(t.tagReady, { count: 2 })}`,
    );
    expect(links[2]).toHaveAccessibleName(
      `${messages.RouteStatus.active} 12 routes, ${fill(t.tagNoDriver, { count: 1 })}`,
    );
    // Paused sits apart, small.
    expect(
      screen.getByRole("link", { name: `${messages.RouteStatus.paused} 2` }),
    ).toHaveAttribute("href", "/routes?status=paused");
    // All of them, beside the heading.
    const card = screen.getByRole("region", { name: t.routesTitle });
    expect(card).toHaveTextContent(fill(t.inAll, { total: 21 }));
    expect(
      within(card).getByRole("link", { name: t.seeAllRoutes }),
    ).toHaveAttribute("href", "/routes");
  });

  it("tags a stage with what needs doing there, only above 0", async () => {
    serveOverview();
    const { unmount } = renderWithProviders(<OverviewScreen />);

    const stages = await screen.findByRole("list", { name: t.routesLabel });
    const [, forming, active] = within(stages).getAllByRole("link");
    expect(forming).toHaveTextContent(fill(t.tagReady, { count: 2 }));
    expect(forming).not.toHaveTextContent(t.stageFormingHint);
    expect(active).toHaveTextContent(fill(t.tagNoDriver, { count: 1 }));
    unmount();

    serveOverview({
      ...counts,
      routes: {
        ...counts.routes,
        ready_to_launch: 0,
        active_without_driver: 0,
      },
    });
    renderWithProviders(<OverviewScreen />);
    const quiet = await screen.findByRole("list", { name: t.routesLabel });
    const [, calmForming, calmActive] = within(quiet).getAllByRole("link");
    expect(calmForming).toHaveTextContent(t.stageFormingHint);
    expect(calmActive).toHaveTextContent(t.stageActiveHint);
    expect(quiet).not.toHaveTextContent(/ready to launch|without a driver/);
  });

  it("draws the routes by stage as one bar, described in words", async () => {
    serveOverview();
    renderWithProviders(<OverviewScreen />);

    const bar = await screen.findByRole("img", {
      name: "All 21 routes: 1 draft, 6 forming, 12 active, 2 paused",
    });
    const parts = Array.from(bar.querySelectorAll("rect[data-part]"));
    expect(parts.map((rect) => rect.getAttribute("data-part"))).toEqual([
      "draft",
      "forming",
      "active",
      "paused",
    ]);
    [1, 6, 12, 2].forEach((count, index) =>
      expect(Number(parts[index]!.getAttribute("width"))).toBeCloseTo(
        (count / 21) * 100,
        1,
      ),
    );
  });

  it("leaves out a stage at 0 and keeps a tiny share visible", async () => {
    serveOverview({
      ...counts,
      routes: {
        ...counts.routes,
        draft: 1,
        forming: 0,
        active: 299,
        paused: 0,
      },
    });
    renderWithProviders(<OverviewScreen />);

    const bar = await screen.findByRole("img", {
      name: "All 300 routes: 1 draft, 0 forming, 299 active, 0 paused",
    });
    const parts = Array.from(bar.querySelectorAll("rect[data-part]"));
    expect(parts.map((rect) => rect.getAttribute("data-part"))).toEqual([
      "draft",
      "active",
    ]);
    // 1 of 300 is drawn 1% wide; the bar still ends at 100%.
    expect(Number(parts[0]!.getAttribute("width"))).toBeGreaterThanOrEqual(
      0.99,
    );
    const last = parts[1]!;
    expect(
      Number(last.getAttribute("x")) + Number(last.getAttribute("width")),
    ).toBeCloseTo(100, 5);
  });

  it("draws an empty bar when there are no routes yet", async () => {
    serveOverview({
      ...counts,
      routes: {
        draft: 0,
        forming: 0,
        active: 0,
        paused: 0,
        ready_to_launch: 0,
        active_without_driver: 0,
      },
    });
    renderWithProviders(<OverviewScreen />);

    const bar = await screen.findByRole("img", { name: t.noRoutes });
    expect(bar.querySelectorAll("rect[data-part]")).toHaveLength(0);
  });

  it("groups large counts for reading", async () => {
    serveOverview({
      ...counts,
      routes: { ...counts.routes, active: 1200 },
    });
    renderWithProviders(<OverviewScreen />);

    const stages = await screen.findByRole("list", { name: t.routesLabel });
    expect(within(stages).getAllByRole("link")[2]).toHaveAccessibleName(
      `${messages.RouteStatus.active} 1,200 routes, ${fill(t.tagNoDriver, { count: 1 })}`,
    );
    expect(
      screen.getByRole("img", {
        name: "All 1,209 routes: 1 draft, 6 forming, 1,200 active, 2 paused",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: t.routesTitle }),
    ).toHaveTextContent(fill(t.inAll, { total: 1209 }));
  });

  it("compares the riders by seat, each bar out of all riders", async () => {
    serveOverview();
    renderWithProviders(<OverviewScreen />);

    const rows = await screen.findByRole("list", { name: t.ridersLabel });
    const row = (label: string) => tile(t.ridersLabel, label);
    expect(within(rows).getAllByRole("listitem")).toHaveLength(3);
    expect(row(t.riding)).toHaveTextContent("140");
    expect(row(t.riding)).toHaveTextContent(t.ridingHint);
    expect(row(t.starting)).toHaveTextContent("10");
    expect(row(t.reserved)).toHaveTextContent("24");
    // The bars are for sight only: the count is written beside each.
    const width = (label: string) =>
      Number(
        row(label)
          .querySelector("svg[aria-hidden='true'] rect[data-part]")
          ?.getAttribute("width"),
      );
    expect(width(t.riding)).toBeCloseTo((140 / 1180) * 100, 1);
    expect(width(t.reserved)).toBeCloseTo((24 / 1180) * 100, 1);

    const card = screen.getByRole("region", { name: t.ridersTitle });
    expect(card).toHaveTextContent(fill(t.inAll, { total: 1180 }));
    expect(card).toHaveTextContent(fill(t.ridersBarsHint, { total: 1180 }));
    expect(
      within(card).getByRole("link", { name: t.allRiders }),
    ).toHaveAttribute("href", "/riders");
  });

  it("opens reserved riders; riding today and starting soon open together, as the list holds them", async () => {
    serveOverview();
    renderWithProviders(<OverviewScreen />);

    await screen.findByRole("list", { name: t.ridersLabel });
    expect(
      within(tile(t.ridersLabel, t.riding)).queryByRole("link"),
    ).toBeNull();
    expect(
      within(tile(t.ridersLabel, t.starting)).queryByRole("link"),
    ).toBeNull();
    expect(
      within(tile(t.ridersLabel, t.reserved)).getByRole("link"),
    ).toHaveAttribute("href", "/riders?seat=reserved");
    expect(screen.getByRole("link", { name: t.seeWithSeat })).toHaveAttribute(
      "href",
      "/riders?seat=active",
    );
  });

  it("draws no bars without riders, and never past the whole", async () => {
    serveOverview({
      ...counts,
      riders: { total: 0, riding: 0, reserved: 0, starting: 0 },
    });
    const { unmount } = renderWithProviders(<OverviewScreen />);
    const list = await screen.findByRole("list", { name: t.ridersLabel });
    // No bars out of nothing, and nothing said about them.
    expect(list.querySelectorAll("svg")).toHaveLength(0);
    expect(
      screen.getByRole("region", { name: t.ridersTitle }),
    ).not.toHaveTextContent(fill(t.ridersBarsHint, { total: 0 }));
    expect(tile(t.ridersLabel, t.riding)).toHaveTextContent("0");
    unmount();

    // Counts that overlap could exceed the total: a bar stops at 100%.
    serveOverview({
      ...counts,
      riders: { total: 10, riding: 12, reserved: 0, starting: 0 },
    });
    renderWithProviders(<OverviewScreen />);
    await screen.findByRole("list", { name: t.ridersLabel });
    const riding = tile(t.ridersLabel, t.riding).querySelector(
      "rect[data-part]",
    );
    expect(Number(riding?.getAttribute("width"))).toBe(100);
  });

  it("counts open seat offers (no list across routes) and active drivers", async () => {
    serveOverview();
    renderWithProviders(<OverviewScreen />);

    await screen.findByRole("list", { name: t.moreLabel });
    const offers = tile(t.moreLabel, t.openOffers);
    expect(offers).toHaveTextContent("3");
    expect(offers).toHaveTextContent(t.openOffersHint);
    expect(within(offers).queryByRole("link")).toBeNull();
    const drivers = tile(t.moreLabel, t.activeDrivers);
    expect(drivers).toHaveTextContent("13");
    expect(within(drivers).getByRole("link")).toHaveAttribute(
      "href",
      "/drivers?is_active=true",
    );
  });

  it("says it's loading until the counts come", async () => {
    serveOverview();
    renderWithProviders(<OverviewScreen />);

    expect(screen.getByRole("status")).toHaveTextContent(t.loading);
    await screen.findByRole("list", { name: t.routesLabel });
    expect(screen.queryByText(t.loading)).toBeNull();
  });

  it("shows a failed load with its reference, and loads again on Try again", async () => {
    server.use(
      http.get(
        apiUrl("/v1/overview"),
        () => problemResponse(500, "INTERNAL_ERROR", "req-500"),
        { once: true },
      ),
    );
    renderWithProviders(<OverviewScreen />);

    expect(
      await screen.findByText(messages.Errors.INTERNAL_ERROR),
    ).toBeVisible();
    expect(screen.getByText("req-500")).toBeVisible();

    serveOverview();
    await userEvent.click(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    );
    expect(
      await screen.findByRole("list", { name: t.routesLabel }),
    ).toBeVisible();
  });

  it("shows NoPermission when the API says this role can't see it", async () => {
    server.use(
      http.get(apiUrl("/v1/overview"), () => problemResponse(403, "FORBIDDEN")),
    );
    renderWithProviders(<OverviewScreen />);

    expect(await screen.findByText(messages.NoPermission.title)).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      t.title,
    );
    expect(screen.queryByText(t.actionTitle)).toBeNull();
  });
});

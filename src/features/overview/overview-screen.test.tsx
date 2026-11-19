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

  it("counts routes by status, each opening the routes list filtered to it", async () => {
    serveOverview();
    renderWithProviders(<OverviewScreen />);

    await screen.findByRole("list", { name: t.routesLabel });
    const expected = [
      [messages.RouteStatus.active, "12", "active"],
      [messages.RouteStatus.formingNoMinimum, "6", "forming"],
      [messages.RouteStatus.paused, "2", "paused"],
      [messages.RouteStatus.draft, "1", "draft"],
    ] as const;
    for (const [label, count, status] of expected) {
      expect(
        within(tile(t.routesLabel, label)).getByRole("link", {
          name: `${label} ${count}`,
        }),
      ).toHaveAttribute("href", `/routes?status=${status}`);
    }
  });

  it("draws the routes by status as one bar, described in words", async () => {
    serveOverview();
    renderWithProviders(<OverviewScreen />);

    const bar = await screen.findByRole("img", {
      name: "All 21 routes: 12 active, 6 forming, 2 paused, 1 draft",
    });
    // One part per status, as wide as its share (in % of the bar).
    const parts = Array.from(bar.querySelectorAll("rect[data-part]"));
    expect(parts.map((rect) => rect.getAttribute("data-part"))).toEqual([
      "active",
      "forming",
      "paused",
      "draft",
    ]);
    const widths = parts.map((rect) => Number(rect.getAttribute("width")));
    const starts = parts.map((rect) => Number(rect.getAttribute("x")));
    [12, 6, 2, 1].forEach((count, index) =>
      expect(widths[index]).toBeCloseTo((count / 21) * 100, 1),
    );
    // Side by side, filling the bar.
    expect(starts[0]).toBe(0);
    for (let i = 1; i < 4; i++) {
      expect(starts[i]).toBeCloseTo(starts[i - 1]! + widths[i - 1]!, 5);
    }
    expect(starts[3]! + widths[3]!).toBeCloseTo(100, 5);
    expect(screen.getByRole("link", { name: t.seeAllRoutes })).toHaveAttribute(
      "href",
      "/routes",
    );
  });

  it("leaves out a status at 0 and keeps a tiny share visible", async () => {
    serveOverview({
      ...counts,
      routes: {
        ...counts.routes,
        active: 299,
        forming: 0,
        paused: 0,
        draft: 1,
      },
    });
    renderWithProviders(<OverviewScreen />);

    const bar = await screen.findByRole("img", {
      name: "All 300 routes: 299 active, 0 forming, 0 paused, 1 draft",
    });
    const parts = Array.from(bar.querySelectorAll("rect[data-part]"));
    expect(parts.map((rect) => rect.getAttribute("data-part"))).toEqual([
      "active",
      "draft",
    ]);
    // 1 of 300 is drawn 1% wide, the bar still ends at 100%.
    const draft = parts[1]!;
    expect(Number(draft.getAttribute("width"))).toBeGreaterThanOrEqual(0.99);
    expect(
      Number(draft.getAttribute("x")) + Number(draft.getAttribute("width")),
    ).toBeCloseTo(100, 5);
  });

  it("says large counts in the bar's words as the tiles show them", async () => {
    serveOverview({
      ...counts,
      routes: {
        ...counts.routes,
        active: 1200,
        forming: 0,
        paused: 0,
        draft: 0,
      },
    });
    renderWithProviders(<OverviewScreen />);

    expect(
      await screen.findByRole("img", {
        name: "All 1,200 routes: 1,200 active, 0 forming, 0 paused, 0 draft",
      }),
    ).toBeVisible();
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

  it("shows each rider count's share of all riders, for sight only", async () => {
    serveOverview();
    renderWithProviders(<OverviewScreen />);

    await screen.findByRole("list", { name: t.ridersLabel });
    const share = (label: string) =>
      tile(t.ridersLabel, label).querySelector(
        "svg[aria-hidden='true'] rect[data-part]",
      );
    expect(Number(share(t.riding)?.getAttribute("width"))).toBeCloseTo(
      (140 / 1180) * 100,
      1,
    );
    expect(Number(share(t.reserved)?.getAttribute("width"))).toBeCloseTo(
      (24 / 1180) * 100,
      1,
    );
    expect(share(t.allRiders)).toBeNull();
  });

  it("draws no share bars without riders, and never past the whole", async () => {
    serveOverview({
      ...counts,
      riders: { total: 0, riding: 0, reserved: 0, starting: 0 },
    });
    const { unmount } = renderWithProviders(<OverviewScreen />);
    const list = await screen.findByRole("list", { name: t.ridersLabel });
    expect(list.querySelectorAll("svg")).toHaveLength(0);
    unmount();

    // Counts that overlap could exceed the total: a share stops at 100%.
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

  it("counts riders by seat; riding today and starting soon open together, as the list holds them", async () => {
    serveOverview();
    renderWithProviders(<OverviewScreen />);

    await screen.findByRole("list", { name: t.ridersLabel });
    const riding = tile(t.ridersLabel, t.riding);
    expect(riding).toHaveTextContent("140");
    expect(riding).toHaveTextContent(t.ridingHint);
    expect(within(riding).queryByRole("link")).toBeNull();
    const starting = tile(t.ridersLabel, t.starting);
    expect(starting).toHaveTextContent("10");
    expect(starting).toHaveTextContent(t.startingHint);
    expect(within(starting).queryByRole("link")).toBeNull();
    expect(screen.getByRole("link", { name: t.seeWithSeat })).toHaveAttribute(
      "href",
      "/riders?seat=active",
    );

    expect(
      within(tile(t.ridersLabel, t.reserved)).getByRole("link"),
    ).toHaveAttribute("href", "/riders?seat=reserved");
    const all = tile(t.ridersLabel, t.allRiders);
    // Grouped for reading.
    expect(all).toHaveTextContent("1,180");
    expect(within(all).getByRole("link")).toHaveAttribute("href", "/riders");
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

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { currentStaffQueryKey } from "@/lib/auth/use-current-staff";
import { focusDetailWhenOpened } from "@/components/detail/detail-frame";
import { RouteDetail } from "./route-detail";
import {
  corporate,
  fill,
  forming,
  route,
  servePlaces,
  serveRole,
  serveRoute,
  student,
} from "./test-support";

vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/routes";
  return mockNavigation(state);
});
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.Routes;

startMswServer();

beforeEach(() => {
  serveRole("staff");
  servePlaces();
});

function fact(label: string) {
  const facts = screen.getByRole("group", { name: t.detailLabel });
  return within(facts).getByText(label, { selector: "dt" }).nextElementSibling;
}

describe("RouteDetail", () => {
  it("shows a forming route's corridor, times, seats and launch progress", async () => {
    serveRoute(forming);
    renderWithProviders(<RouteDetail routeId={forming.id} variant="page" />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "B-01" }),
    ).toBeVisible();
    expect(fact(t.corridor)).toHaveTextContent(/Bole.*Piassa/);
    expect(fact(t.type)).toHaveTextContent(t.typePublic);
    expect(fact(t.morningRun)).toHaveTextContent(
      fill(t.run, {
        from: "Bole",
        leave: "06:30",
        to: "Piassa",
        arrive: "07:15",
      }),
    );
    expect(fact(t.eveningRun)).toHaveTextContent(
      fill(t.run, {
        from: "Piassa",
        leave: "17:30",
        to: "Bole",
        arrive: "18:15",
      }),
    );
    expect(fact(t.seats)).toHaveTextContent(fill(t.seatsTotal, { seats: 14 }));
    expect(fact(t.driver)).toHaveTextContent(t.driverNone);
    expect(fact(t.launchMinimum)).toHaveTextContent(
      fill(t.launchMinimumValue, { minimum: 10 }),
    );
    expect(
      screen.getByRole("meter", {
        name: fill(messages.LaunchProgress.needed, {
          reserved: 7,
          minimum: 10,
        }),
      }),
    ).toHaveAttribute("value", "7");
  });

  it("shows the areas served as a path, and the prices", async () => {
    serveRoute(forming);
    renderWithProviders(<RouteDetail routeId={forming.id} variant="page" />);

    const path = await screen.findByRole("list", { name: t.areasServedLabel });
    expect(
      within(path)
        .getAllByRole("listitem")
        // The arrows between them are decoration (aria-hidden).
        .map((item) => item.textContent?.replace("→", "")),
    ).toEqual(["Bole", "CMC", "Mexico", "Piassa"]);
    const prices = screen.getByRole("group", { name: t.prices });
    expect(prices).toHaveTextContent(`${t.priceRoundTrip}2,400 birr`);
    expect(prices).toHaveTextContent(`${t.priceOneWay}1,400 birr`);
    expect(prices).toHaveTextContent(`${t.priceSaturday}300 birr`);
  });

  it("shows a student route's school, unset arrival times and prices", async () => {
    serveRoute(student);
    renderWithProviders(<RouteDetail routeId={student.id} variant="page" />);

    await screen.findByRole("heading", { name: "S-03" });
    expect(fact(t.school)).toHaveTextContent("Lycée Guebre-Mariam");
    expect(fact(t.morningRun)).toHaveTextContent(
      fill(t.run, {
        from: "Mexico",
        leave: "06:30",
        to: "Bole",
        arrive: t.notSet,
      }),
    );
    expect(
      screen.getByText(
        fill(t.areasServedNone, { origin: "Mexico", destination: "Bole" }),
      ),
    ).toBeVisible();
    const prices = screen.getByRole("group", { name: t.prices });
    expect(within(prices).getAllByText(t.notSet)).toHaveLength(2);
    // Saturday is for public routes only.
    expect(within(prices).queryByText(t.priceSaturday)).toBeNull();
  });

  it("shows a corporate route's company and its agreed rate", async () => {
    serveRoute(corporate);
    renderWithProviders(<RouteDetail routeId={corporate.id} variant="page" />);

    await screen.findByRole("heading", { name: "R-21" });
    expect(
      within(fact(t.company) as HTMLElement).getByRole("link", {
        name: "Addis Brewery",
      }),
    ).toHaveAttribute(
      "href",
      "/companies/00000000-0000-4000-c000-000000000001",
    );
    expect(screen.getByText(t.rateAgreed)).toBeVisible();
    expect(screen.queryByText(t.launchMinimum)).toBeNull();
    // Seat offers are for public routes only.
    expect(
      screen.queryByRole("heading", { name: messages.Offers.title }),
    ).toBeNull();
  });

  it("shows a public route's seat offers", async () => {
    serveRoute(forming);
    server.use(
      http.get(apiUrl("/v1/routes/{route_id}/offers"), () =>
        HttpResponse.json({ items: [], next_cursor: null }),
      ),
    );
    renderWithProviders(<RouteDetail routeId={forming.id} variant="page" />);

    expect(
      await screen.findByRole("heading", { name: messages.Offers.title }),
    ).toBeVisible();
    expect(await screen.findByText(messages.Offers.none)).toBeVisible();
  });

  it("links to the route it was copied from, or says it was deleted", async () => {
    const copy = route("B-01A", 7, { copied_from_route_id: forming.id });
    serveRoute(copy, forming);
    const { unmount } = renderWithProviders(
      <RouteDetail routeId={copy.id} variant="page" />,
    );
    await screen.findByRole("heading", { name: "B-01A" });
    expect(
      await within(fact(t.copiedFrom) as HTMLElement).findByRole("link", {
        name: "B-01",
      }),
    ).toHaveAttribute("href", `/routes/${forming.id}`);
    unmount();

    const orphan = route("B-02", 8, {
      copied_from_route_id: "00000000-0000-4000-d000-000000000999",
    });
    serveRoute(orphan);
    renderWithProviders(<RouteDetail routeId={orphan.id} variant="page" />);
    await screen.findByRole("heading", { name: "B-02" });
    expect(
      await within(fact(t.copiedFrom) as HTMLElement).findByText(
        t.copiedFromDeleted,
      ),
    ).toBeVisible();
  });

  it("explains a route that no longer exists", async () => {
    serveRoute();
    renderWithProviders(<RouteDetail routeId={forming.id} variant="page" />);

    expect(await screen.findByText(t.notFoundTitle)).toBeVisible();
    expect(screen.getByRole("link", { name: t.backToList })).toHaveAttribute(
      "href",
      "/routes",
    );
  });

  it("opens the edit form filled in", async () => {
    serveRoute(forming);
    const user = userEvent.setup();
    renderWithProviders(<RouteDetail routeId={forming.id} variant="page" />);

    await user.click(await screen.findByRole("button", { name: t.edit }));

    const dialog = await screen.findByRole("dialog", {
      name: fill(t.editTitle, { code: "B-01" }),
    });
    expect(within(dialog).getByLabelText(t.codeLabel)).toHaveValue("B-01");
    expect(within(dialog).getByLabelText(t.seatsLabel)).toHaveValue(14);
  });
  it("lets admins set or change prices, not staff, and not on corporate routes", async () => {
    serveRole("admin");
    serveRoute(forming, corporate);
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(
      <RouteDetail routeId={forming.id} variant="page" />,
    );
    await user.click(
      await screen.findByRole("button", { name: t.changePrices }),
    );
    expect(
      await screen.findByRole("dialog", {
        name: fill(t.pricesTitle, { code: "B-01" }),
      }),
    ).toBeVisible();
    unmount();

    renderWithProviders(<RouteDetail routeId={corporate.id} variant="page" />);
    await screen.findByText(t.rateAgreed);
    expect(screen.queryByRole("button", { name: t.setPrices })).toBeNull();
    expect(screen.queryByRole("button", { name: t.changePrices })).toBeNull();
  });

  it("shows prices read-only to staff", async () => {
    serveRoute(forming);
    const { queryClient } = renderWithProviders(
      <RouteDetail routeId={forming.id} variant="page" />,
    );
    await screen.findByRole("group", { name: t.prices });
    await waitFor(() =>
      expect(queryClient.getQueryState(currentStaffQueryKey)?.status).toBe(
        "success",
      ),
    );

    expect(screen.queryByRole("button", { name: t.changePrices })).toBeNull();
  });
  it("lets staff edit the areas served", async () => {
    serveRoute(forming);
    const user = userEvent.setup();
    renderWithProviders(<RouteDetail routeId={forming.id} variant="page" />);

    await user.click(await screen.findByRole("button", { name: t.editAreas }));

    expect(
      await screen.findByRole("dialog", {
        name: fill(t.areasTitle, { code: "B-01" }),
      }),
    ).toBeVisible();
  });
  it("lets an admin delete a route, then hands back to the list", async () => {
    serveRole("admin");
    const draft = route("B-03", 6);
    serveRoute(draft);
    let deleted: string | undefined;
    server.use(
      http.delete(apiUrl("/v1/routes/{route_id}"), ({ params }) => {
        deleted = String(params.route_id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <RouteDetail routeId={draft.id} variant="page" onDeleted={onDeleted} />,
    );

    await user.click(
      await screen.findByRole("button", { name: t.deleteRoute }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: fill(t.deleteTitle, { code: "B-03" }),
    });
    await user.click(
      within(dialog).getByRole("button", { name: t.deleteRoute }),
    );

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleted).toBe(draft.id);
  });

  it("explains why a route with riders or requests can't be deleted", async () => {
    serveRole("admin");
    const answers: [Schemas["ErrorCode"], string][] = [
      ["ROUTE_HAS_RIDERS", t.deleteHasRiders],
      ["ROUTE_HAS_REQUESTS", t.deleteHasRequests],
    ];
    for (const [code, text] of answers) {
      serveRoute(forming);
      server.use(
        http.delete(apiUrl("/v1/routes/{route_id}"), () =>
          HttpResponse.json(
            {
              type: "about:blank",
              title: code,
              status: 409,
              code,
              request_id: `req-${code}`,
            },
            {
              status: 409,
              headers: { "Content-Type": "application/problem+json" },
            },
          ),
        ),
      );
      const user = userEvent.setup();
      const { unmount } = renderWithProviders(
        <RouteDetail routeId={forming.id} variant="page" />,
      );
      await user.click(
        await screen.findByRole("button", { name: t.deleteRoute }),
      );
      const dialog = await screen.findByRole("alertdialog");
      await user.click(
        within(dialog).getByRole("button", { name: t.deleteRoute }),
      );
      expect(await within(dialog).findByText(text)).toBeVisible();
      expect(within(dialog).getByText(`req-${code}`)).toBeVisible();
      unmount();
    }
  });

  it("offers Delete to admins only", async () => {
    serveRoute(forming);
    const { queryClient } = renderWithProviders(
      <RouteDetail routeId={forming.id} variant="page" />,
    );
    await screen.findByRole("heading", { name: "B-01" });
    await waitFor(() =>
      expect(queryClient.getQueryState(currentStaffQueryKey)?.status).toBe(
        "success",
      ),
    );

    expect(screen.queryByRole("button", { name: t.deleteRoute })).toBeNull();
  });
  it("keeps the launch a launch while the route updates, and confirms it", async () => {
    // A move's answer updates the route (its status), and the lists refetch: the open dialog must
    // stay the launch, and its confirmation must still show.
    const readyRoute = route("B-04", 9, {
      status: "forming",
      launch_minimum: 5,
      reserved: 6,
      prices: { round_trip: 2000, one_way: 1200, saturday: null },
      status_changes: [
        {
          to: "active",
          ready: true,
          blocked_by: [],
          launch_date: "2026-12-01",
        },
      ],
    });
    let current = readyRoute;
    server.use(
      http.get(apiUrl("/v1/routes/{route_id}"), () =>
        HttpResponse.json<Schemas["RouteRead"]>(current),
      ),
      http.get(apiUrl("/v1/routes/{route_id}/launch-months"), () =>
        HttpResponse.json<Schemas["RouteLaunchMonths"]>({
          status: "forming",
          launch_minimum: 5,
          months: [{ launch_date: "2026-12-01", reserved: 6, ready: true }],
        }),
      ),
      http.put(apiUrl("/v1/routes/{route_id}/status"), () => {
        current = {
          ...readyRoute,
          status: "active",
          updated_at: "2026-11-03T10:00:00Z",
          status_changes: [
            { to: "paused", ready: true, blocked_by: [], launch_date: null },
          ],
        };
        return HttpResponse.json<Schemas["RouteRead"]>(current);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <RouteDetail routeId={readyRoute.id} variant="panel" />,
    );

    await user.click(await screen.findByRole("button", { name: t.moveLaunch }));
    const dialog = await screen.findByRole("dialog", {
      name: fill(t.launchTitle, { code: "B-04" }),
    });
    await within(dialog).findByRole("radio", { name: /December 2026/ });
    await user.click(
      within(dialog).getByRole("button", { name: t.moveLaunch }),
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        fill(t.launched, { code: "B-04", date: "December 1, 2026" }),
      ),
    );
    expect(screen.queryByRole("alertdialog", { name: /Resume/ })).toBeNull();
    // The moves now start from active: focus goes to them.
    await waitFor(() =>
      expect(
        screen.getByRole("group", { name: t.statusActionsLabel }),
      ).toHaveFocus(),
    );
  });

  it("keeps Delete disabled until Retry-After has passed after a 429", async () => {
    serveRole("admin");
    serveRoute(forming);
    server.use(
      http.delete(apiUrl("/v1/routes/{route_id}"), () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "RATE_LIMITED",
            status: 429,
            code: "RATE_LIMITED",
            request_id: "req-429",
          },
          {
            status: 429,
            headers: {
              "Content-Type": "application/problem+json",
              "Retry-After": "1",
            },
          },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteDetail routeId={forming.id} variant="page" />);

    await user.click(
      await screen.findByRole("button", { name: t.deleteRoute }),
    );
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: t.deleteRoute });
    await user.click(confirm);

    expect(
      await within(dialog).findByText(messages.Errors.RATE_LIMITED),
    ).toBeVisible();
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    await waitFor(() => expect(confirm).not.toHaveAttribute("aria-disabled"), {
      timeout: 2500,
    });
  });
  it("adds a van and hands the new route over to be opened", async () => {
    serveRoute(forming);
    const van = route("B-01A", 9, { copied_from_route_id: forming.id });
    server.use(
      http.post(apiUrl("/v1/routes/{route_id}/copies"), () =>
        HttpResponse.json<Schemas["RouteRead"]>(van, { status: 201 }),
      ),
    );
    const onOpenRoute = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <RouteDetail
        routeId={forming.id}
        variant="page"
        onOpenRoute={onOpenRoute}
      />,
    );

    await user.click(await screen.findByRole("button", { name: t.addVan }));
    const dialog = await screen.findByRole("dialog", {
      name: fill(t.vanTitle, { code: "B-01" }),
    });
    await user.type(within(dialog).getByLabelText(t.codeLabel), "B-01A");
    await user.click(within(dialog).getByRole("button", { name: t.addVan }));

    await waitFor(() => expect(onOpenRoute).toHaveBeenCalledWith(van.id));
    // The dialog doesn't take focus back to this route: the new one takes it.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: t.addVan })).not.toHaveFocus();
  });

  it("focuses the name of a route opened from another once it's shown", async () => {
    serveRoute(forming);
    focusDetailWhenOpened(forming.id);
    renderWithProviders(<RouteDetail routeId={forming.id} variant="page" />);

    expect(
      await screen.findByRole("heading", { level: 1, name: /B-01/ }),
    ).toHaveFocus();
  });
});

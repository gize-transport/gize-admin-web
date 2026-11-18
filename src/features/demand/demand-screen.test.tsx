import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import {
  areas,
  bolePiassa,
  problemResponse,
  route,
  servePlaces,
  serveRole,
  serveRoute,
} from "../routes/test-support";
import { DemandScreen } from "./demand-screen";

vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/demand";
  return mockNavigation(state);
});
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
vi.mock("@/components/toast", () => ({ showSuccessToast: vi.fn() }));

const t = messages.Demand;

startMswServer();

const full = route("B-07", 7, { status: "active" });

const summary: Schemas["RouteRequestSummary"] = {
  area_pairs: [
    {
      from_area: areas.bole,
      from_area_name: null,
      to_area: null,
      to_area_name: "Lebu",
      open: 2,
    },
    {
      from_area: areas.bole,
      from_area_name: null,
      to_area: areas.piassa,
      to_area_name: null,
      open: 1,
    },
    {
      from_area: areas.cmc,
      from_area_name: null,
      to_area: areas.mexico,
      to_area_name: null,
      open: 1,
    },
  ],
  area_pairs_truncated: false,
  routes: [
    {
      route: { id: full.id, code: "B-07" },
      status: "active",
      open: 6,
      seats_free_next_month: 0,
    },
  ],
  routes_truncated: true,
};

function serveSummary(body: Schemas["RouteRequestSummary"] = summary) {
  server.use(
    http.get(apiUrl("/v1/route-requests/summary"), () =>
      HttpResponse.json(body),
    ),
  );
}

beforeEach(() => {
  serveRole("staff");
  servePlaces([bolePiassa]);
});

function cardOf(listLabel: string, heading: RegExp | string) {
  const list = screen.getByRole("list", { name: listLabel });
  const card = within(list)
    .getByRole("heading", { level: 3, name: heading })
    .closest("li");
  if (!card) throw new Error("no card");
  return card;
}

describe("DemandScreen", () => {
  it("shows open requests per area pair and per route, in the order the API sends (busiest first)", async () => {
    serveSummary();
    renderWithProviders(<DemandScreen />);

    const pairs = await screen.findByRole("list", { name: t.pairsLabel });
    const headings = within(pairs).getAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "from Bole → to Lebu (not listed)",
      "from Bole → to Piassa",
      "from CMC → to Mexico",
    ]);
    expect(cardOf(t.pairsLabel, /Lebu/)).toHaveTextContent("2 open requests");

    const routeCard = cardOf(t.routesLabel, "B-07");
    expect(routeCard).toHaveTextContent("6 open requests");
    expect(routeCard).toHaveTextContent("0 seats free next month");
    expect(
      within(routeCard).getByText(messages.RouteStatus.active),
    ).toBeVisible();
    expect(
      within(routeCard).getByRole("link", { name: "Open B-07" }),
    ).toHaveAttribute("href", `/routes/${full.id}`);
    expect(
      within(routeCard).getByRole("link", { name: "Requests for B-07" }),
    ).toHaveAttribute("href", `/route-requests?route_id=${full.id}&open=true`);
    // Buttons name their card to screen readers.
    expect(
      within(routeCard).getByRole("button", { name: "Add a van, B-07" }),
    ).toBeVisible();
    // Only the routes list was cut.
    expect(screen.getAllByText(t.truncated)).toHaveLength(1);
  });

  it("offers the corridor or route for two listed areas, and the area for a name not listed", async () => {
    serveSummary();
    renderWithProviders(<DemandScreen />);

    const lebu = await screen.findByRole("heading", { level: 3, name: /Lebu/ });
    const unlisted = lebu.closest("li") as HTMLElement;
    expect(within(unlisted).getAllByRole("button")).toHaveLength(1);
    expect(
      within(unlisted).getByRole("button", {
        name: "Add area Lebu, from Bole to Lebu (not listed)",
      }),
    ).toBeVisible();
    // Exactly the requests the card counts: a listed end by id, a typed one by its name.
    expect(
      within(unlisted).getByRole("link", { name: /^See these requests/ }),
    ).toHaveAttribute(
      "href",
      `/route-requests?kind=new_areas&status=new&from_area_id=${areas.bole.id}&to_area_name=Lebu`,
    );

    const listed = cardOf(t.pairsLabel, /Piassa/);
    expect(
      within(listed).getByRole("button", {
        name: "Add corridor, from Bole to Piassa",
      }),
    ).toBeVisible();
    expect(
      within(listed).getByRole("button", {
        name: "Add route, from Bole to Piassa",
      }),
    ).toBeVisible();
    expect(
      within(listed).getByRole("link", { name: /^See these requests/ }),
    ).toHaveAttribute(
      "href",
      `/route-requests?kind=new_areas&status=new&from_area_id=${areas.bole.id}&to_area_id=${areas.piassa.id}`,
    );
  });

  it("adds a name not listed as an area, then offers the corridor on its card, focused", async () => {
    const lebuArea = {
      id: "00000000-0000-4000-8000-0000000000aa",
      name: "Lebu",
      created_at: "2026-11-18T09:00:00Z",
      updated_at: "2026-11-18T09:00:00Z",
    };
    let added: unknown = null;
    server.use(
      http.get(apiUrl("/v1/route-requests/summary"), () =>
        HttpResponse.json(
          added === null
            ? summary
            : {
                ...summary,
                // The API linked the requests that typed it.
                area_pairs: [
                  {
                    from_area: areas.bole,
                    from_area_name: null,
                    to_area: { id: lebuArea.id, name: "Lebu" },
                    to_area_name: null,
                    open: 2,
                  },
                  ...summary.area_pairs.slice(1),
                ],
              },
        ),
      ),
      http.post(apiUrl("/v1/areas"), async ({ request }) => {
        added = await request.json();
        return HttpResponse.json(lebuArea, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<DemandScreen />);

    await user.click(
      await screen.findByRole("button", { name: /^Add area Lebu/ }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: messages.Areas.addTitle,
    });
    expect(within(dialog).getByLabelText(messages.Areas.nameLabel)).toHaveValue(
      "Lebu",
    );
    await user.click(
      within(dialog).getByRole("button", { name: messages.Areas.save }),
    );
    await vi.waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(added).toEqual({ name: "Lebu" });

    const card = cardOf(t.pairsLabel, "from Bole to Lebu");
    expect(
      within(card).getByRole("button", { name: /^Add corridor/ }),
    ).toBeVisible();
    await vi.waitFor(() =>
      expect(within(card).getByRole("heading", { level: 3 })).toHaveFocus(),
    );
  });

  it("opens the corridor form with the two areas", async () => {
    serveSummary();
    const user = userEvent.setup();
    renderWithProviders(<DemandScreen />);

    await screen.findByRole("list", { name: t.pairsLabel });
    await user.click(
      within(cardOf(t.pairsLabel, /Mexico/)).getByRole("button", {
        name: /^Add corridor/,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: messages.Corridors.addTitle,
    });
    expect(
      within(dialog).getByRole("combobox", {
        name: messages.Corridors.originLabel,
      }),
    ).toHaveTextContent("CMC");
    expect(
      within(dialog).getByRole("combobox", {
        name: messages.Corridors.destinationLabel,
      }),
    ).toHaveTextContent("Mexico");
  });

  it("opens the route form on the pair's corridor, or says there's none yet", async () => {
    serveSummary();
    const user = userEvent.setup();
    renderWithProviders(<DemandScreen />);

    await screen.findByRole("list", { name: t.pairsLabel });
    const noCorridor = cardOf(t.pairsLabel, /Mexico/);
    const addRoute = within(noCorridor).getByRole("button", {
      name: /^Add route/,
    });
    await user.click(addRoute);
    expect(await within(noCorridor).findByText(t.noCorridor)).toBeVisible();
    expect(addRoute).toHaveAccessibleDescription(t.noCorridor);
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(
      within(cardOf(t.pairsLabel, /Piassa/)).getByRole("button", {
        name: /^Add route/,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: messages.Routes.addTitle,
    });
    expect(
      within(dialog).getByRole("combobox", {
        name: messages.CorridorField.originLabel,
      }),
    ).toHaveTextContent("Bole");
    expect(
      within(dialog).getByRole("combobox", {
        name: messages.CorridorField.destinationLabel,
      }),
    ).toHaveTextContent("Piassa");
  });

  it("opens Add a van with the route, and explains a route that couldn't load", async () => {
    serveSummary();
    serveRoute(full);
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<DemandScreen />);

    await user.click(
      within(
        await screen
          .findByRole("list", { name: t.routesLabel })
          .then(() => cardOf(t.routesLabel, "B-07")),
      ).getByRole("button", { name: /^Add a van/ }),
    );
    expect(
      await screen.findByRole("dialog", {
        name: messages.Routes.vanTitle.replace("{code}", "B-07"),
      }),
    ).toBeVisible();
    unmount();

    server.use(
      http.get(apiUrl("/v1/routes/{route_id}"), () =>
        problemResponse(503, "SERVICE_UNAVAILABLE", "req-503"),
      ),
    );
    renderWithProviders(<DemandScreen />);
    await screen.findByRole("list", { name: t.routesLabel });
    const card = cardOf(t.routesLabel, "B-07");
    await user.click(within(card).getByRole("button", { name: /^Add a van/ }));
    expect(
      await within(card).findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeVisible();
    expect(within(card).getByText("req-503")).toBeVisible();
  });

  it("waits out a 429 on finding the corridor, then offers a retry", async () => {
    serveSummary();
    let fail = true;
    server.use(
      http.get(apiUrl("/v1/corridors"), () => {
        if (fail) {
          fail = false;
          return problemResponse(429, "RATE_LIMITED", "req-429", {
            "Retry-After": "1",
          });
        }
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<DemandScreen />);

    await screen.findByRole("list", { name: t.pairsLabel });
    const card = cardOf(t.pairsLabel, /Mexico/);
    const addRoute = within(card).getByRole("button", { name: /^Add route/ });
    await user.click(addRoute);
    expect(
      await within(card).findByText(messages.Errors.RATE_LIMITED),
    ).toBeVisible();
    expect(addRoute).toHaveAttribute("aria-disabled", "true");

    await user.click(
      await within(card).findByRole(
        "button",
        { name: messages.ProblemAlert.retry },
        { timeout: 2500 },
      ),
    );
    // The retried lookup answers after the 1 s wait: give a busy CI runner time to show it.
    expect(
      await within(card).findByText(t.noCorridor, {}, { timeout: 3000 }),
    ).toBeVisible();
  });

  it("clears the no-corridor note when the corridor is added from the card", async () => {
    serveSummary();
    const user = userEvent.setup();
    renderWithProviders(<DemandScreen />);

    await screen.findByRole("list", { name: t.pairsLabel });
    const card = cardOf(t.pairsLabel, /Mexico/);
    await user.click(within(card).getByRole("button", { name: /^Add route/ }));
    await within(card).findByText(t.noCorridor);
    await user.click(
      within(card).getByRole("button", { name: /^Add corridor/ }),
    );

    expect(within(card).queryByText(t.noCorridor)).toBeNull();
  });

  it("says when nothing is waiting", async () => {
    serveSummary({
      area_pairs: [],
      area_pairs_truncated: false,
      routes: [],
      routes_truncated: false,
    });
    renderWithProviders(<DemandScreen />);

    expect(await screen.findByText(t.pairsEmpty)).toBeVisible();
    expect(screen.getByText(t.routesEmpty)).toBeVisible();
  });

  it("shows an error with its reference and a retry", async () => {
    let fail = true;
    server.use(
      http.get(apiUrl("/v1/route-requests/summary"), () => {
        if (fail) {
          fail = false;
          return problemResponse(503, "SERVICE_UNAVAILABLE", "req-503");
        }
        return HttpResponse.json(summary);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<DemandScreen />);

    expect(await screen.findByText("req-503")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    );
    expect(
      await screen.findByRole("list", { name: t.pairsLabel }),
    ).toBeVisible();
  });

  it("says when the person may not see demand", async () => {
    server.use(
      http.get(apiUrl("/v1/route-requests/summary"), () =>
        problemResponse(403, "FORBIDDEN"),
      ),
    );
    renderWithProviders(<DemandScreen />);

    expect(await screen.findByText(messages.NoPermission.title)).toBeVisible();
  });
});

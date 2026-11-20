import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { chooseFilter, filterButton } from "../../../tests/utils/filters";
import { renderWithProviders } from "../../../tests/utils/render";
import { RoutesScreen } from "./routes-screen";
import {
  bolePiassa,
  brewery,
  corporate,
  fill,
  forming,
  problemResponse,
  route,
  servePlaces,
  serveRole,
  serveRoute,
  serveRoutes,
  student,
} from "./test-support";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/routes";
  nav.state = state;
  return mockNavigation(state);
});
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
vi.mock("@/components/toast", () => ({ showSuccessToast: vi.fn() }));

type Nav = ReturnType<
  typeof import("../../../tests/utils/navigation").createNavigationState
>;
const navigation = () => nav.state as Nav;
const t = messages.Routes;
const tField = messages.CorridorField;

startMswServer();

function wideScreen() {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("min-width: 1280px"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

async function pickArea(user: UserEvent, label: string, name: string) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.type(
    await screen.findByRole("combobox", {
      name: messages.AreaPicker.searchLabel,
    }),
    name.slice(0, 3),
  );
  await user.click(await screen.findByRole("option", { name }));
}

beforeEach(() => {
  navigation().search = "";
  navigation().push.mockClear();
  navigation().replace.mockClear();
  serveRole("staff");
  servePlaces();
});

afterEach(() => vi.unstubAllGlobals());

describe("RoutesScreen", () => {
  it("lists routes with corridor, type, times, seats, driver and status", async () => {
    serveRoutes([
      forming,
      student,
      {
        ...corporate,
        driver: {
          id: "00000000-0000-4000-9900-000000000001",
          full_name: "Bereket Tolosa",
          plate: "AA 3-B12341",
        },
      },
    ]);
    renderWithProviders(<RoutesScreen />);

    const table = await screen.findByRole("table", { name: t.tableLabel });
    const row = (
      await within(table).findByRole("link", { name: "B-01" })
    ).closest("tr");
    if (!row) throw new Error("no row");
    expect(row).toHaveTextContent(/Bole.*Piassa/);
    expect(within(row).getByText(t.typePublic)).toBeVisible();
    expect(within(row).getByText("06:30–07:15 · 17:30–18:15")).toBeVisible();
    expect(
      within(row).getByText(fill(t.seatsThisMonth, { taken: 9, free: 5 })),
    ).toBeVisible();
    expect(
      within(row).getByText(fill(t.seatsNextMonth, { taken: 4, free: 10 })),
    ).toBeVisible();
    expect(
      within(row).getByText(messages.RouteStatus.formingNoMinimum),
    ).toBeVisible();
    expect(
      within(row).getByRole("meter", {
        name: fill(messages.LaunchProgress.needed, {
          reserved: 7,
          minimum: 10,
        }),
      }),
    ).toBeVisible();

    const studentRow = within(table)
      .getByRole("link", { name: "S-03" })
      .closest("tr");
    if (!studentRow) throw new Error("no student row");
    expect(
      within(studentRow).getByText(
        fill(t.typeWithSchool, { school: "Lycée Guebre-Mariam" }),
      ),
    ).toBeVisible();
    // Made before arrival times existed.
    expect(
      within(studentRow).getByText(
        fill(t.timesShort, {
          leaveA: "06:30",
          arriveB: t.notSet,
          leaveB: "17:30",
          arriveA: t.notSet,
        }),
      ),
    ).toBeVisible();
    expect(
      within(table).getByText(
        fill(t.typeWithCompany, { company: "Addis Brewery" }),
      ),
    ).toBeVisible();
    expect(within(row).getByText(t.notAssigned)).toBeVisible();
    const corporateRow = within(table)
      .getByRole("link", { name: "R-21" })
      .closest("tr");
    if (!corporateRow) throw new Error("no corporate row");
    expect(within(corporateRow).getByText("Bereket Tolosa")).toBeVisible();
  });

  it("sends every filter from the URL and names the corridor and company", async () => {
    navigation().search = `?q=b-&route_type=public&status=forming&corridor_id=${bolePiassa.id}&company_id=${brewery.id}`;
    const seen: URL[] = [];
    serveRoutes([forming], seen);
    renderWithProviders(<RoutesScreen />);

    await screen.findByRole("link", { name: "B-01" });
    const params = seen[0]?.searchParams;
    expect(params?.get("q")).toBe("b-");
    expect(params?.get("route_type")).toBe("public");
    expect(params?.get("status")).toBe("forming");
    expect(params?.get("corridor_id")).toBe(bolePiassa.id);
    expect(params?.get("company_id")).toBe(brewery.id);
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: tField.originLabel }),
      ).toHaveTextContent("Bole"),
    );
    expect(
      screen.getByRole("combobox", { name: tField.destinationLabel }),
    ).toHaveTextContent("Piassa");
    expect(
      await screen.findByRole("combobox", { name: t.companyFilter }),
    ).toHaveTextContent("Addis Brewery");
    expect(filterButton(t.typeFilter, t.typePublic)).toBeVisible();
    expect(
      filterButton(t.statusFilter, messages.RouteStatus.formingNoMinimum),
    ).toBeVisible();
  });

  it("ignores a type or status in the URL it doesn't know", async () => {
    navigation().search = "?route_type=bus&status=gone";
    const seen: URL[] = [];
    serveRoutes([forming], seen);
    renderWithProviders(<RoutesScreen />);

    await screen.findByRole("link", { name: "B-01" });
    expect(seen[0]?.searchParams.has("route_type")).toBe(false);
    expect(seen[0]?.searchParams.has("status")).toBe(false);
  });

  it("filters by a corridor picked as its two areas", async () => {
    serveRoutes([forming]);
    const user = userEvent.setup();
    renderWithProviders(<RoutesScreen />);
    await screen.findByRole("link", { name: "B-01" });

    await pickArea(user, tField.originLabel, "Bole");
    await pickArea(user, tField.destinationLabel, "Piassa");

    await waitFor(() =>
      expect(navigation().push).toHaveBeenLastCalledWith(
        `/routes?corridor_id=${bolePiassa.id}`,
        { scroll: false },
      ),
    );
  });

  it("says when two areas have no corridor between them", async () => {
    serveRoutes([forming]);
    const user = userEvent.setup();
    renderWithProviders(<RoutesScreen />);
    await screen.findByRole("link", { name: "B-01" });

    await pickArea(user, tField.originLabel, "CMC");
    await pickArea(user, tField.destinationLabel, "Mexico");

    expect(
      await screen.findByText(
        fill(tField.none, { origin: "CMC", destination: "Mexico" }),
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: tField.addCorridor }),
    ).toHaveAttribute("href", "/corridors");
    expect(navigation().push).not.toHaveBeenCalled();
    // Both ends shown, but nothing filters the list: not marked as on.
    const from = screen.getByRole("combobox", { name: tField.originLabel });
    expect(from).toHaveTextContent(`${tField.originShort}: CMC`);
    expect(from).not.toHaveAttribute("data-active");
  });

  it("filters by type and status from their menus", async () => {
    serveRoutes([forming]);
    const user = userEvent.setup();
    renderWithProviders(<RoutesScreen />);
    await screen.findByRole("link", { name: "B-01" });

    await chooseFilter(user, t.typeFilter, t.typeStudent);
    expect(navigation().push).toHaveBeenLastCalledWith(
      "/routes?route_type=student",
      { scroll: false },
    );
    // Clicked before the URL caught up: builds on the type just chosen, doesn't drop it.
    await chooseFilter(user, t.statusFilter, messages.RouteStatus.paused);
    expect(navigation().push).toHaveBeenLastCalledWith(
      "/routes?route_type=student&status=paused",
      { scroll: false },
    );
  });

  it("sends the order from the URL, and leaves out one it doesn't take", async () => {
    navigation().search = "?sort=morning_time&status=active";
    const seen: URL[] = [];
    serveRoutes([forming], seen);
    const { unmount } = renderWithProviders(<RoutesScreen />);

    await screen.findByRole("link", { name: "B-01" });
    expect(seen[0]?.searchParams.get("sort")).toBe("morning_time");
    expect(
      screen.getByRole("button", { name: `Sort: ${t.sortMorning}` }),
    ).toBeVisible();
    unmount();

    navigation().search = "?sort=name";
    renderWithProviders(<RoutesScreen />);
    await waitFor(() => expect(seen).toHaveLength(2));
    expect(seen[1]?.searchParams.has("sort")).toBe(false);
    expect(
      screen.getByRole("button", { name: messages.DataTable.sort }),
    ).toBeVisible();
  });

  it("sorts by code or morning departure from its menu, from the first page", async () => {
    navigation().search = "?status=active&cursor=page-2";
    serveRoutes([forming]);
    const user = userEvent.setup();
    renderWithProviders(<RoutesScreen />);
    await screen.findByRole("link", { name: "B-01" });

    await user.click(
      screen.getByRole("button", { name: messages.DataTable.sort }),
    );
    const menu = await screen.findByRole("menu", {
      name: messages.DataTable.sort,
    });
    expect(
      within(menu)
        .getAllByRole("menuitemradio")
        .map((item) => item.textContent),
    ).toEqual([messages.DataTable.sortNewest, t.sortCode, t.sortMorning]);
    await user.click(
      within(menu).getByRole("menuitemradio", { name: t.sortCode }),
    );

    expect(navigation().push).toHaveBeenLastCalledWith(
      "/routes?status=active&sort=code",
      { scroll: false },
    );
  });

  it("keeps the order when the filters are cleared", async () => {
    navigation().search = "?status=paused&sort=code";
    serveRoutes([]);
    const user = userEvent.setup();
    renderWithProviders(<RoutesScreen />);

    expect(await screen.findByText(t.noMatchesTitle)).toBeVisible();
    await user.click(screen.getByRole("button", { name: t.clearFilters }));
    expect(navigation().push).toHaveBeenLastCalledWith("/routes?sort=code", {
      scroll: false,
    });
  });

  it("offers to clear every filter when nothing matches", async () => {
    navigation().search = `?q=zz&status=paused&company_id=${brewery.id}`;
    serveRoutes([]);
    const user = userEvent.setup();
    renderWithProviders(<RoutesScreen />);

    expect(await screen.findByText(t.noMatchesTitle)).toBeVisible();
    await user.click(screen.getByRole("button", { name: t.clearFilters }));
    expect(navigation().push).toHaveBeenLastCalledWith("/routes", {
      scroll: false,
    });
  });

  it("invites adding the first route when there are none", async () => {
    serveRoutes([]);
    renderWithProviders(<RoutesScreen />);

    expect(await screen.findByText(t.emptyTitle)).toBeVisible();
  });

  it("pages with the API's cursor", async () => {
    serveRoutes([forming], undefined, "page-2");
    renderWithProviders(<RoutesScreen />);

    expect(
      await screen.findByRole("link", { name: messages.DataTable.nextPage }),
    ).toHaveAttribute("href", "/routes?cursor=page-2");
  });

  it("shows a failed load with its reference, and NoPermission on a 403", async () => {
    server.use(
      http.get(apiUrl("/v1/routes"), () =>
        problemResponse(500, "INTERNAL_ERROR", "req-500"),
      ),
    );
    const { unmount } = renderWithProviders(<RoutesScreen />);
    expect(await screen.findByText("req-500")).toBeVisible();
    unmount();

    server.use(
      http.get(apiUrl("/v1/routes"), () => problemResponse(403, "FORBIDDEN")),
    );
    renderWithProviders(<RoutesScreen />);
    expect(await screen.findByText(messages.NoPermission.title)).toBeVisible();
    expect(screen.queryByRole("button", { name: t.add })).toBeNull();
  });

  it("links a route to its page, and opens it beside the list on wide screens", async () => {
    serveRoutes([forming]);
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<RoutesScreen />);
    expect(await screen.findByRole("link", { name: "B-01" })).toHaveAttribute(
      "href",
      `/routes/${forming.id}`,
    );
    unmount();

    wideScreen();
    renderWithProviders(<RoutesScreen />);
    await user.click(await screen.findByRole("link", { name: "B-01" }));
    expect(navigation().push).toHaveBeenLastCalledWith(
      `/routes?route=${forming.id}`,
      { scroll: false },
    );
  });

  it("on wide screens, shows the open route in a side panel", async () => {
    wideScreen();
    navigation().search = `?route=${forming.id}`;
    serveRoutes([forming]);
    serveRoute(forming);
    renderWithProviders(<RoutesScreen />);

    const panel = await screen.findByRole("region", { name: "B-01" });
    expect(
      await within(panel).findByRole("heading", { level: 2, name: "B-01" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "B-01" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("forgets the panel's tab when the panel closes", async () => {
    wideScreen();
    navigation().search = `?route=${forming.id}&tab=status`;
    serveRoutes([forming]);
    serveRoute(forming);
    const user = userEvent.setup();
    renderWithProviders(<RoutesScreen />);

    const panel = await screen.findByRole("region", { name: "B-01" });
    expect(
      await within(panel).findByRole("tab", { name: t.tabStatus }),
    ).toHaveAttribute("aria-selected", "true");
    await user.click(
      within(panel).getByRole("button", { name: t.closeDetail }),
    );

    expect(navigation().push).toHaveBeenLastCalledWith("/routes", {
      scroll: false,
    });
  });

  it("keeps the panel's tab when another route opens in it", async () => {
    wideScreen();
    const other = route("B-02", 4, { status: "active" });
    navigation().search = `?route=${forming.id}&tab=offers`;
    serveRoutes([forming, other]);
    serveRoute(forming);
    const user = userEvent.setup();
    renderWithProviders(<RoutesScreen />);
    await screen.findByRole("region", { name: "B-01" });

    await user.click(screen.getByRole("link", { name: "B-02" }));

    expect(navigation().push).toHaveBeenLastCalledWith(
      `/routes?route=${other.id}&tab=offers`,
      { scroll: false },
    );
  });

  it("on narrower screens, a shared panel link opens the route's page on its tab", async () => {
    navigation().search = `?route=${forming.id}&tab=offers&type=public`;
    serveRoutes([forming]);
    renderWithProviders(<RoutesScreen />);

    // The tab goes along; the list's filter doesn't.
    await waitFor(() =>
      expect(navigation().replace).toHaveBeenCalledWith(
        `/routes/${forming.id}?tab=offers`,
      ),
    );
  });

  it("filters by a company, inactive ones included", async () => {
    const seen: URL[] = [];
    server.use(
      http.get(apiUrl("/v1/companies"), ({ request }) => {
        seen.push(new URL(request.url));
        return problemResponse(503, "SERVICE_UNAVAILABLE");
      }),
    );
    serveRoutes([corporate]);
    const user = userEvent.setup();
    renderWithProviders(<RoutesScreen />);
    await screen.findByRole("link", { name: "R-21" });

    await user.click(screen.getByRole("combobox", { name: t.companyFilter }));

    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen.every((url) => !url.searchParams.has("is_active"))).toBe(true);
  });
  it("treats a filter the API can't read as no matches, with a way out", async () => {
    navigation().search = "?corridor_id=not-an-id";
    server.use(
      http.get(apiUrl("/v1/routes"), () =>
        HttpResponse.json<Schemas["ValidationProblem"]>(
          {
            type: "about:blank",
            title: "VALIDATION_FAILED",
            status: 422,
            code: "VALIDATION_FAILED",
            request_id: "req-422",
            errors: [
              {
                location: "query",
                field: "/corridor_id",
                reason: "invalid_format",
              },
            ],
            errors_truncated: false,
          },
          {
            status: 422,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      ),
    );
    renderWithProviders(<RoutesScreen />);

    expect(await screen.findByText(t.noMatchesTitle)).toBeVisible();
    expect(screen.getByRole("button", { name: t.clearFilters })).toBeVisible();
    expect(screen.queryByText(messages.Errors.VALIDATION_FAILED)).toBeNull();
  });

  it("changing one end of an active corridor filter clears it without a history entry", async () => {
    navigation().search = `?corridor_id=${bolePiassa.id}`;
    serveRoutes([forming]);
    const user = userEvent.setup();
    renderWithProviders(<RoutesScreen />);
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: tField.originLabel }),
      ).toHaveTextContent("Bole"),
    );

    await pickArea(user, tField.destinationLabel, "Mexico");

    await waitFor(() =>
      expect(navigation().replace).toHaveBeenLastCalledWith("/routes", {
        scroll: false,
      }),
    );
    expect(
      await screen.findByText(
        fill(tField.none, { origin: "Bole", destination: "Mexico" }),
      ),
    ).toBeVisible();
    // The areas stay as picked while the URL catches up.
    expect(
      screen.getByRole("combobox", { name: tField.originLabel }),
    ).toHaveTextContent("Bole");
  });
});

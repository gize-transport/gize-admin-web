import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import {
  areas,
  fill,
  problemResponse,
  serveRole,
  serveRoute,
} from "../routes/test-support";
import { RouteRequestsScreen } from "./route-requests-screen";
import {
  declined,
  forRoute,
  matchedStudent,
  newAreas,
  running,
  serveRequest,
  serveRequests,
} from "./test-support";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/route-requests";
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
const t = messages.RouteRequests;
const tStatus = messages.RequestStatus;

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

beforeEach(() => {
  navigation().search = "";
  navigation().push.mockClear();
  navigation().replace.mockClear();
  serveRole("staff");
});

afterEach(() => vi.unstubAllGlobals());

function rowOf(name: string) {
  const row = screen.getByRole("link", { name }).closest("tr");
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

describe("RouteRequestsScreen", () => {
  it("lists requests with the rider, what's asked and the status, but no contact details", async () => {
    serveRequests([newAreas, forRoute, matchedStudent, declined]);
    renderWithProviders(<RouteRequestsScreen />);

    const table = await screen.findByRole("table", { name: t.tableLabel });
    await within(table).findByRole("link", { name: "Dawit Alemu" });

    const first = rowOf("Selam Bekele");
    expect(first).toHaveTextContent(/Bole.*Lebu \(not listed\)/);
    expect(first).toHaveTextContent(t.kindNewAreas);
    expect(first).toHaveTextContent(t.riderAdult);
    expect(within(first).getByText(tStatus.new)).toBeVisible();

    expect(rowOf("Dawit Alemu")).toHaveTextContent(
      fill(t.askedRoute, { code: "B-07" }),
    );
    const student = rowOf("Liya Girma");
    expect(student).toHaveTextContent(
      fill(t.riderStudentAt, { school: "Lycée Guebre-Mariam" }),
    );
    expect(
      within(student).getByText(fill(tStatus.matched, { code: "S-06" })),
    ).toBeVisible();
    // Personal contact details only show on the detail.
    expect(table).not.toHaveTextContent("+2519");
    expect(table).not.toHaveTextContent("Meron Girma");
  });

  it("sends every filter from the URL and names the route", async () => {
    navigation().search = `?status=new&kind=route&open=true&route_id=${running.id}`;
    const seen: URL[] = [];
    serveRequests([forRoute], seen);
    serveRoute(running);
    renderWithProviders(<RouteRequestsScreen />);

    await screen.findByRole("link", { name: "Dawit Alemu" });
    const params = seen[0]?.searchParams;
    expect(params?.get("status")).toBe("new");
    expect(params?.get("kind")).toBe("route");
    expect(params?.get("open")).toBe("true");
    expect(params?.get("route_id")).toBe(running.id);
    expect(
      await screen.findByRole("combobox", { name: t.routeFilter }),
    ).toHaveTextContent("B-07");
    expect(
      within(screen.getByRole("group", { name: t.openFilter })).getByRole(
        "button",
        { name: t.filterOpen },
      ),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("sends a Demand card's area pair, names its ends and shows all areas again", async () => {
    navigation().search = `?kind=new_areas&status=new&from_area_id=${areas.bole.id}&to_area_name=Lebu`;
    const seen: URL[] = [];
    serveRequests([newAreas], seen);
    server.use(
      http.get(apiUrl("/v1/areas/{area_id}"), () =>
        HttpResponse.json({
          ...areas.bole,
          created_at: "2026-11-01T09:00:00Z",
          updated_at: "2026-11-01T09:00:00Z",
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteRequestsScreen />);

    await screen.findByRole("link", { name: "Selam Bekele" });
    const params = seen[0]?.searchParams;
    expect(params?.get("from_area_id")).toBe(areas.bole.id);
    expect(params?.get("to_area_name")).toBe("Lebu");
    expect(params?.has("from_area_name")).toBe(false);
    expect(params?.has("to_area_id")).toBe(false);
    const pair = screen.getByRole("group", { name: t.areasFilter });
    expect(
      await within(pair).findByText("From Bole to Lebu (not listed)"),
    ).toBeVisible();

    await user.click(within(pair).getByRole("button", { name: t.clearAreas }));
    expect(navigation().push).toHaveBeenLastCalledWith(
      "/route-requests?kind=new_areas&status=new",
      { scroll: false },
    );
  });

  it("says when an area of the pair no longer exists", async () => {
    navigation().search = `?from_area_id=${areas.bole.id}`;
    serveRequests([]);
    server.use(
      http.get(apiUrl("/v1/areas/{area_id}"), () =>
        problemResponse(404, "NOT_FOUND"),
      ),
    );
    renderWithProviders(<RouteRequestsScreen />);

    expect(
      await screen.findByText("From an area that no longer exists to any area"),
    ).toBeVisible();
    expect(screen.getByText(t.noMatchesTitle)).toBeVisible();
  });

  it("ignores filters in the URL it doesn't know", async () => {
    navigation().search = "?status=lost&kind=bus&open=maybe";
    const seen: URL[] = [];
    serveRequests([newAreas], seen);
    renderWithProviders(<RouteRequestsScreen />);

    await screen.findByRole("link", { name: "Selam Bekele" });
    const params = seen[0]?.searchParams;
    expect(params?.has("status")).toBe(false);
    expect(params?.has("kind")).toBe(false);
    expect(params?.has("open")).toBe(false);
  });

  it("says when the route filtered by no longer exists", async () => {
    navigation().search = `?route_id=${running.id}`;
    serveRequests([]);
    serveRoute();
    renderWithProviders(<RouteRequestsScreen />);

    expect(await screen.findByText(t.unknownRoute)).toBeVisible();
    expect(screen.getByText(t.noMatchesTitle)).toBeVisible();
  });

  it("filters with a chip and clears every filter from the empty state", async () => {
    navigation().search = "?kind=route";
    serveRequests([]);
    const user = userEvent.setup();
    renderWithProviders(<RouteRequestsScreen />);

    await user.click(
      within(
        await screen.findByRole("group", { name: t.statusFilter }),
      ).getByRole("button", { name: tStatus.matchedAny }),
    );
    expect(navigation().push).toHaveBeenLastCalledWith(
      "/route-requests?kind=route&status=matched",
      { scroll: false },
    );
    await user.click(
      await screen.findByRole("button", { name: t.clearFilters }),
    );
    expect(navigation().push).toHaveBeenLastCalledWith("/route-requests", {
      scroll: false,
    });
  });

  it("offers to record the first request when there are none", async () => {
    serveRequests([]);
    renderWithProviders(<RouteRequestsScreen />);

    expect(await screen.findByText(t.emptyTitle)).toBeVisible();
    expect(screen.getAllByRole("button", { name: t.add })).toHaveLength(2);
  });

  it("shows an error with its reference and a retry", async () => {
    let fail = true;
    server.use(
      http.get(apiUrl("/v1/route-requests"), () => {
        if (fail) {
          fail = false;
          return problemResponse(503, "SERVICE_UNAVAILABLE", "req-503");
        }
        return HttpResponse.json({ items: [newAreas], next_cursor: null });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteRequestsScreen />);

    expect(
      await screen.findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeVisible();
    expect(screen.getByText("req-503")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    );
    expect(
      await screen.findByRole("link", { name: "Selam Bekele" }),
    ).toBeVisible();
  });

  it("says when the person may not see requests", async () => {
    server.use(
      http.get(apiUrl("/v1/route-requests"), () =>
        problemResponse(403, "FORBIDDEN"),
      ),
    );
    renderWithProviders(<RouteRequestsScreen />);

    expect(await screen.findByText(messages.NoPermission.title)).toBeVisible();
  });

  it("opens a request beside the list on wide screens", async () => {
    wideScreen();
    navigation().search = `?request=${forRoute.id}`;
    serveRequests([newAreas, forRoute]);
    serveRequest(forRoute);
    renderWithProviders(<RouteRequestsScreen />);

    const panel = await screen.findByRole("region", { name: "Dawit Alemu" });
    expect(panel).toHaveFocus();
    expect(within(panel).getByText("+251911000102")).toBeVisible();
    expect(screen.getByRole("link", { name: "Dawit Alemu" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("opens a request just recorded beside the list on wide screens", async () => {
    wideScreen();
    serveRequests([newAreas]);
    const added = { ...newAreas, id: "00000000-0000-4000-e000-000000000099" };
    server.use(
      http.post(apiUrl("/v1/route-requests"), () =>
        HttpResponse.json(added, { status: 201 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteRequestsScreen />);

    await user.click(
      (await screen.findAllByRole("button", { name: t.add }))[0]!,
    );
    const dialog = await screen.findByRole("dialog", { name: t.addTitle });
    for (const [legend, name] of [
      [t.fromLegend, "Lebu"],
      [t.toLegend, "Summit"],
    ] as const) {
      const end = within(dialog).getByRole("group", { name: legend });
      await user.click(within(end).getByLabelText(t.endNamed));
      await user.type(
        within(end).getByLabelText(fill(t.endNameLabel, { end: legend })),
        name,
      );
    }
    await user.type(within(dialog).getByLabelText(t.riderNameLabel), "Abebe");
    await user.type(within(dialog).getByLabelText(t.contactNameLabel), "Abebe");
    await user.type(
      within(dialog).getByLabelText(t.contactPhoneLabel),
      "0911000111",
    );
    await user.click(within(dialog).getByRole("button", { name: t.record }));

    await waitFor(() =>
      expect(navigation().push).toHaveBeenLastCalledWith(
        `/route-requests?request=${added.id}`,
        { scroll: false },
      ),
    );
  });
});

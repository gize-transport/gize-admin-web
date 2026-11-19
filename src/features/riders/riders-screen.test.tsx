import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import {
  fill,
  problemResponse,
  route,
  serveRole,
  serveRoute,
} from "../routes/test-support";
import { readSearch, RidersScreen } from "./riders-screen";
import {
  companyRider,
  moving,
  noSeat,
  reservedSat,
  riding,
  serveLookup,
  serveRider,
  serveRiders,
} from "./test-support";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/riders";
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
const t = messages.Riders;

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

/** Every address the screen navigated to. */
const addresses = () =>
  [...navigation().push.mock.calls, ...navigation().replace.mock.calls].map(
    ([href]) => href,
  );

describe("readSearch", () => {
  it("tells a name from a phone number", () => {
    expect(readSearch("  ")).toEqual({ kind: "none" });
    expect(readSearch("Abe")).toEqual({ kind: "name", name: "Abe" });
    expect(readSearch("አበበ")).toEqual({ kind: "name", name: "አበበ" });
    expect(readSearch("0911 23 45 67")).toEqual({
      kind: "phone",
      phone: "+251911234567",
    });
    expect(readSearch("+251 (911) 23-45-67")).toEqual({
      kind: "phone",
      phone: "+251911234567",
    });
    expect(readSearch("0911")).toEqual({ kind: "partial-phone" });
    expect(readSearch("R2 0911")).toEqual({ kind: "name", name: "R2 0911" });
  });
});

describe("RidersScreen", () => {
  it("lists riders with their seat, plan and where they board, the phone masked", async () => {
    serveRiders([riding, reservedSat, companyRider, moving, noSeat]);
    renderWithProviders(<RidersScreen />);

    const table = await screen.findByRole("table", { name: t.tableLabel });
    await within(table).findByRole("link", { name: "Abel Tesfaye" });

    const abel = rowOf("Abel Tesfaye");
    expect(abel).toHaveTextContent("+2519****0412");
    expect(abel).toHaveTextContent(t.typeAdult);
    expect(abel).toHaveTextContent("R-03");
    expect(within(abel).getByText(t.seatRiding)).toBeVisible();
    expect(abel).toHaveTextContent(t.planRoundTrip);
    expect(abel).toHaveTextContent("CMC");

    const kidus = rowOf("Kidus Alemu");
    expect(within(kidus).getByText(t.seatReserved)).toBeVisible();
    expect(kidus).toHaveTextContent(fill(t.seatFrom, { date: "Dec 1, 2099" }));
    expect(kidus).toHaveTextContent(
      fill(t.planWithSaturday, { plan: t.planMorning }),
    );

    const hirut = rowOf("Hirut Bekele");
    expect(hirut).toHaveTextContent(t.typeCompany);
    expect(hirut).toHaveTextContent("Addis Brewery");
    expect(hirut).toHaveTextContent(t.planCompany);

    const mahlet = rowOf("Mahlet Bekele");
    expect(mahlet).toHaveTextContent(
      fill(t.seatUntil, { date: "Nov 30, 2099" }),
    );
    expect(mahlet).toHaveTextContent(
      fill(t.movingTo, { code: "R-07", date: "Dec 1, 2099" }),
    );
    expect(rowOf("Selam Girma")).toHaveTextContent(t.noSeat);
    // Full phone numbers only show on the detail.
    expect(table).not.toHaveTextContent("+251911000412");
  });

  it("sends every filter from the URL and names the route", async () => {
    navigation().search = `?type=corporate&seat=active&route_id=${riding.seat?.route_id}`;
    const seen: URL[] = [];
    serveRiders([companyRider], seen);
    serveRoute(route("R-03", 3));
    renderWithProviders(<RidersScreen />);

    await screen.findByRole("link", { name: "Hirut Bekele" });
    const params = seen[0]?.searchParams;
    expect(params?.get("rider_type")).toBe("corporate");
    expect(params?.get("seat")).toBe("active");
    expect(params?.get("route_id")).toBe(riding.seat?.route_id);
    expect(params?.has("q")).toBe(false);
    expect(
      await screen.findByRole("combobox", { name: t.routeFilter }),
    ).toHaveTextContent("R-03");
  });

  it("ignores filters in the URL it doesn't know", async () => {
    navigation().search = "?type=driver&seat=maybe";
    const seen: URL[] = [];
    serveRiders([riding], seen);
    renderWithProviders(<RidersScreen />);

    await screen.findByRole("link", { name: "Abel Tesfaye" });
    expect(seen[0]?.searchParams.has("rider_type")).toBe(false);
    expect(seen[0]?.searchParams.has("seat")).toBe(false);
  });

  it("searches by name without putting it in the address, from the first page", async () => {
    navigation().search = "?type=adult&cursor=page-2";
    const seen: URL[] = [];
    serveRiders([riding], seen);
    const user = userEvent.setup();
    renderWithProviders(<RidersScreen />);

    await screen.findByRole("link", { name: "Abel Tesfaye" });
    await user.type(screen.getByLabelText(t.searchLabel), "Abe");

    await waitFor(() => expect(seen.at(-1)?.searchParams.get("q")).toBe("Abe"));
    expect(seen.at(-1)?.searchParams.get("rider_type")).toBe("adult");
    // The address still holds the old page (the mock never moves on): it isn't sent with the name.
    for (const url of seen.filter((u) => u.searchParams.has("q"))) {
      expect(url.searchParams.has("cursor")).toBe(false);
    }
    // The address only says a search is on; the name never reaches it.
    expect(navigation().replace).toHaveBeenCalledWith(
      "/riders?type=adult&searched=1",
      { scroll: false },
    );
    expect(addresses().join(" ")).not.toContain("Abe");
  });

  it("drops a searched page once the search is gone (Back, reload)", async () => {
    navigation().search = "?searched=1&cursor=page-2";
    const seen: URL[] = [];
    serveRiders([riding], seen);
    renderWithProviders(<RidersScreen />);

    await screen.findByRole("link", { name: "Abel Tesfaye" });
    expect(seen.every((url) => !url.searchParams.has("cursor"))).toBe(true);
    await waitFor(() =>
      expect(navigation().replace).toHaveBeenCalledWith("/riders", {
        scroll: false,
      }),
    );
  });

  it("finds a caller by phone with a POST, never in a URL", async () => {
    const seenList: URL[] = [];
    const seenLookups: Schemas["RiderLookup"][] = [];
    serveRiders([riding, reservedSat], seenList);
    serveLookup([riding, reservedSat], seenLookups);
    const user = userEvent.setup();
    renderWithProviders(<RidersScreen />);

    await screen.findByRole("link", { name: "Kidus Alemu" });
    await user.type(screen.getByLabelText(t.searchLabel), "0911 00 04 12");

    await waitFor(() =>
      expect(seenLookups.at(-1)).toEqual({ phone: "+251911000412" }),
    );
    expect(
      await screen.findByRole("link", { name: "Abel Tesfaye" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Kidus Alemu" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(t.phoneSearchNote)).toBeVisible();
    for (const url of seenList) {
      expect(url.toString()).not.toMatch(/0911|251911/);
    }
    expect(addresses().join(" ")).not.toMatch(/0911|251911/);
  });

  it("asks for the whole number while a phone is only partly typed", async () => {
    const seenLookups: Schemas["RiderLookup"][] = [];
    serveRiders([riding]);
    serveLookup([riding], seenLookups);
    const user = userEvent.setup();
    renderWithProviders(<RidersScreen />);

    await screen.findByRole("link", { name: "Abel Tesfaye" });
    const box = screen.getByLabelText(t.searchLabel);
    await user.type(box, "0911");

    expect(await screen.findByText(t.partialPhoneTitle)).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(seenLookups).toEqual([]);
    // The box (in the table's card) stays, still being typed in.
    expect(box).toHaveFocus();
    await user.type(box, "000201");
    expect(box).toHaveValue("0911000201");
  });

  it("offers no next page while a phone is only partly typed", async () => {
    serveRiders([riding], undefined, "cursor-2");
    serveLookup([riding]);
    const user = userEvent.setup();
    renderWithProviders(<RidersScreen />);
    expect(
      await screen.findByRole("link", { name: messages.DataTable.nextPage }),
    ).toBeVisible();

    await user.type(screen.getByLabelText(t.searchLabel), "0911");

    expect(await screen.findByText(t.partialPhoneTitle)).toBeVisible();
    expect(
      screen.queryByRole("link", { name: messages.DataTable.nextPage }),
    ).toBeNull();
  });

  it("offers to record a caller nobody has, with their number filled in", async () => {
    serveRiders([riding]);
    serveLookup([]);
    const user = userEvent.setup();
    renderWithProviders(<RidersScreen />);

    await screen.findByRole("link", { name: "Abel Tesfaye" });
    await user.type(screen.getByLabelText(t.searchLabel), "0922334455");
    await user.click(
      await screen.findByRole("button", { name: t.addWithPhone }),
    );

    const dialog = await screen.findByRole("dialog", { name: t.addTitle });
    expect(within(dialog).getByLabelText(t.phoneLabel)).toHaveValue(
      "+251922334455",
    );
  });

  it("filters with a chip and clears every filter from the empty state", async () => {
    navigation().search = "?type=student";
    serveRiders([]);
    const user = userEvent.setup();
    renderWithProviders(<RidersScreen />);

    await user.click(
      within(
        await screen.findByRole("group", { name: t.seatFilter }),
      ).getByRole("button", { name: t.noSeat }),
    );
    expect(navigation().push).toHaveBeenLastCalledWith(
      "/riders?type=student&seat=none",
      { scroll: false },
    );
    await user.click(
      await screen.findByRole("button", { name: t.clearFilters }),
    );
    expect(navigation().push).toHaveBeenLastCalledWith("/riders", {
      scroll: false,
    });
  });

  it("offers to record the first rider when there are none", async () => {
    serveRiders([]);
    renderWithProviders(<RidersScreen />);

    expect(await screen.findByText(t.emptyTitle)).toBeVisible();
    expect(screen.getAllByRole("button", { name: t.add })).toHaveLength(2);
  });

  it("shows an error with its reference and a retry", async () => {
    let fail = true;
    server.use(
      http.get(apiUrl("/v1/riders"), () => {
        if (fail) {
          fail = false;
          return problemResponse(503, "SERVICE_UNAVAILABLE", "req-503");
        }
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<RidersScreen />);

    expect(
      await screen.findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeVisible();
    expect(screen.getByText("req-503")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    );
    expect(await screen.findByText(t.emptyTitle)).toBeVisible();
  });

  it("says when the person may not see riders", async () => {
    server.use(
      http.get(apiUrl("/v1/riders"), () => problemResponse(403, "FORBIDDEN")),
    );
    renderWithProviders(<RidersScreen />);

    expect(await screen.findByText(messages.NoPermission.title)).toBeVisible();
  });

  it("opens a rider beside the list on wide screens, with the phone in full", async () => {
    wideScreen();
    navigation().search = `?rider=${riding.id}`;
    serveRiders([riding, reservedSat]);
    serveRider(riding);
    renderWithProviders(<RidersScreen />);

    const panel = await screen.findByRole("region", { name: "Abel Tesfaye" });
    expect(panel).toHaveFocus();
    expect(within(panel).getByText("+251911000412")).toBeVisible();
    expect(screen.getByRole("link", { name: "Abel Tesfaye" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});

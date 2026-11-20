import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { chooseFilter, filterButton } from "../../../tests/utils/filters";
import { renderWithProviders } from "../../../tests/utils/render";
import { DriversScreen } from "./drivers-screen";
import {
  bereket,
  problemResponse,
  sara,
  serveDriver,
  serveDrivers,
  serveRole,
} from "./test-support";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/drivers";
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
const t = messages.Drivers;

/** Every address the screen moved to (pushed or replaced). */
const addresses = () =>
  [...navigation().push.mock.calls, ...navigation().replace.mock.calls].map(
    ([href]) => String(href),
  );

startMswServer();

/** Pretends the screen is at least 1280 px wide (the side panel's breakpoint). */
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DriversScreen", () => {
  it("lists drivers with their plate, phone, status and date added", async () => {
    serveDrivers([bereket, sara]);
    renderWithProviders(<DriversScreen />);

    const table = await screen.findByRole("table", { name: t.tableLabel });
    const row = (
      await within(table).findByRole("link", { name: "Bereket Tolosa" })
    ).closest("tr");
    if (!row) throw new Error("no row");
    expect(within(row).getByText("AA 3-B12341")).toBeVisible();
    expect(within(row).getByText("+251911000201")).toBeVisible();
    expect(within(row).getByText(t.active)).toBeVisible();
    expect(within(row).getByText("Nov 5, 2026")).toBeVisible();
    expect(within(table).getByText(t.inactive)).toBeVisible();
    // Initials beside the name, for sight only: the link is still just the name.
    expect(within(row).getByText("BT")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the search and status filter in the table's card", async () => {
    serveDrivers([bereket]);
    renderWithProviders(<DriversScreen />);

    const table = await screen.findByRole("table", { name: t.tableLabel });
    const card = table.closest("[data-slot='table-card']");
    expect(card).not.toBeNull();
    expect(card).toContainElement(screen.getByLabelText(t.searchLabel));
    expect(card).toContainElement(filterButton(t.statusFilter));
  });

  it("sends the status from the URL, and ignores one it doesn't know", async () => {
    navigation().search = "?is_active=false";
    const seen: URL[] = [];
    serveDrivers([sara], seen);
    const { unmount } = renderWithProviders(<DriversScreen />);

    await screen.findByRole("link", { name: "Sara Mohammed" });
    expect(seen[0]?.searchParams.get("is_active")).toBe("false");
    expect(filterButton(t.statusFilter, t.filterInactive)).toBeVisible();
    unmount();

    navigation().search = "?is_active=maybe";
    renderWithProviders(<DriversScreen />);
    await screen.findByRole("link", { name: "Sara Mohammed" });
    expect(seen.at(-1)?.searchParams.has("is_active")).toBe(false);
  });

  it("sends the order from the URL with a search, from the first page", async () => {
    navigation().search = "?sort=name";
    const seen: URL[] = [];
    serveDrivers([sara], seen);
    const user = userEvent.setup();
    renderWithProviders(<DriversScreen />);

    await screen.findByRole("link", { name: "Sara Mohammed" });
    expect(seen[0]?.searchParams.get("sort")).toBe("name");
    expect(
      screen.getByRole("button", {
        name: `${messages.DataTable.sort}: ${messages.DataTable.sortName}`,
      }),
    ).toBeVisible();
    await user.type(screen.getByLabelText(t.searchLabel), "Sar");
    await waitFor(() => expect(seen.at(-1)?.searchParams.get("q")).toBe("Sar"));
    expect(seen.at(-1)?.searchParams.get("sort")).toBe("name");
  });

  it("filters by status from its menu", async () => {
    serveDrivers([bereket]);
    const user = userEvent.setup();
    renderWithProviders(<DriversScreen />);
    await screen.findByRole("link", { name: "Bereket Tolosa" });

    await chooseFilter(user, t.statusFilter, t.filterActive);

    expect(navigation().push).toHaveBeenLastCalledWith(
      "/drivers?is_active=true",
      { scroll: false },
    );
  });

  it("searches by name or plate without putting it in the address, from the first page", async () => {
    navigation().search = "?is_active=true&cursor=page-2";
    const seen: URL[] = [];
    serveDrivers([bereket], seen);
    const user = userEvent.setup();
    renderWithProviders(<DriversScreen />);

    await screen.findByRole("link", { name: "Bereket Tolosa" });
    await user.type(screen.getByLabelText(t.searchLabel), "Bere");

    await waitFor(() =>
      expect(seen.at(-1)?.searchParams.get("q")).toBe("Bere"),
    );
    expect(seen.at(-1)?.searchParams.get("is_active")).toBe("true");
    for (const url of seen.filter((u) => u.searchParams.has("q"))) {
      expect(url.searchParams.has("cursor")).toBe(false);
    }
    // The address only says a search is on; the name never reaches it.
    expect(navigation().replace).toHaveBeenCalledWith(
      "/drivers?is_active=true&searched=1",
      { scroll: false },
    );
    expect(addresses().join(" ")).not.toContain("Bere");
  });

  it("drops a searched page once the search is gone (Back, reload)", async () => {
    navigation().search = "?searched=1&cursor=page-2";
    const seen: URL[] = [];
    serveDrivers([bereket], seen);
    renderWithProviders(<DriversScreen />);

    await screen.findByRole("link", { name: "Bereket Tolosa" });
    expect(seen.every((url) => !url.searchParams.has("cursor"))).toBe(true);
    await waitFor(() =>
      expect(navigation().replace).toHaveBeenCalledWith("/drivers", {
        scroll: false,
      }),
    );
  });

  it("says when a search finds nobody", async () => {
    serveDrivers([]);
    const user = userEvent.setup();
    renderWithProviders(<DriversScreen />);

    await user.type(await screen.findByLabelText(t.searchLabel), "zz");
    expect(await screen.findByText(t.noMatchesSearchDescription)).toBeVisible();
  });

  it("offers to clear the status filter when nobody has it", async () => {
    navigation().search = "?is_active=false";
    serveDrivers([]);
    const user = userEvent.setup();
    renderWithProviders(<DriversScreen />);

    expect(await screen.findByText(t.noMatchesDescription)).toBeVisible();
    await user.click(screen.getByRole("button", { name: t.clearFilters }));
    expect(navigation().push).toHaveBeenLastCalledWith("/drivers", {
      scroll: false,
    });
  });

  it("invites adding the first driver when there are none", async () => {
    serveDrivers([]);
    renderWithProviders(<DriversScreen />);

    expect(await screen.findByText(t.emptyTitle)).toBeVisible();
    expect(screen.getAllByRole("button", { name: t.add })).toHaveLength(2);
  });

  it("pages with the API's cursor", async () => {
    serveDrivers([bereket], undefined, "page-2");
    renderWithProviders(<DriversScreen />);

    expect(
      await screen.findByRole("link", { name: messages.DataTable.nextPage }),
    ).toHaveAttribute("href", "/drivers?cursor=page-2");
  });

  it("shows a failed load with its reference and a retry", async () => {
    server.use(
      http.get(apiUrl("/v1/drivers"), () =>
        problemResponse(500, "INTERNAL_ERROR", "req-500"),
      ),
    );
    renderWithProviders(<DriversScreen />);

    expect(
      await screen.findByText(messages.Errors.INTERNAL_ERROR),
    ).toBeVisible();
    expect(screen.getByText("req-500")).toBeVisible();
    expect(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    ).toBeVisible();
  });

  it("shows NoPermission when the API says this role can't list drivers", async () => {
    server.use(
      http.get(apiUrl("/v1/drivers"), () => problemResponse(403, "FORBIDDEN")),
    );
    renderWithProviders(<DriversScreen />);

    expect(await screen.findByText(messages.NoPermission.title)).toBeVisible();
    expect(screen.queryByRole("button", { name: t.add })).toBeNull();
  });

  it("on narrower screens, a driver's row links to their own page", async () => {
    serveDrivers([bereket]);
    renderWithProviders(<DriversScreen />);

    expect(
      await screen.findByRole("link", { name: "Bereket Tolosa" }),
    ).toHaveAttribute("href", `/drivers/${bereket.id}`);
  });

  it("on wide screens, a driver's row opens their details beside the list", async () => {
    wideScreen();
    serveDrivers([bereket]);
    serveDriver(bereket);
    const user = userEvent.setup();
    renderWithProviders(<DriversScreen />);

    await user.click(
      await screen.findByRole("link", { name: "Bereket Tolosa" }),
    );
    expect(navigation().push).toHaveBeenCalledWith(
      `/drivers?driver=${bereket.id}`,
      { scroll: false },
    );
  });

  it("opens the add form", async () => {
    serveDrivers([bereket]);
    const user = userEvent.setup();
    renderWithProviders(<DriversScreen />);

    await user.click(await screen.findByRole("button", { name: t.add }));
    expect(
      await screen.findByRole("dialog", { name: t.addTitle }),
    ).toBeVisible();
  });
});

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { chooseFilter, filterButton } from "../../../tests/utils/filters";
import { renderWithProviders } from "../../../tests/utils/render";
import { CompaniesScreen } from "./companies-screen";
import {
  brewery,
  ceramics,
  problemResponse,
  serveCompanies,
  serveCompany,
  serveRole,
} from "./test-support";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/companies";
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
const t = messages.Companies;

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

describe("CompaniesScreen", () => {
  it("lists companies with their contact person, status and date added", async () => {
    serveCompanies([brewery, ceramics]);
    renderWithProviders(<CompaniesScreen />);

    const table = await screen.findByRole("table", { name: t.tableLabel });
    const row = (
      await within(table).findByRole("link", {
        name: "Addis Brewery",
      })
    ).closest("tr");
    if (!row) throw new Error("no row");
    expect(within(row).getByText("Hana Bekele")).toBeVisible();
    expect(within(row).getByText(t.active)).toBeVisible();
    expect(within(row).getByText("Nov 1, 2026")).toBeVisible();
    expect(within(table).getByText(t.inactive)).toBeVisible();
    // Phones and emails stay on the detail.
    expect(within(table).queryByText("+251911234567")).toBeNull();
  });

  it("sends the search and status from the URL", async () => {
    navigation().search = "?q=add&is_active=false";
    const seen: URL[] = [];
    serveCompanies([ceramics], seen);
    renderWithProviders(<CompaniesScreen />);

    await screen.findByRole("link", { name: "Ethio Ceramics" });
    expect(seen[0]?.searchParams.get("q")).toBe("add");
    expect(seen[0]?.searchParams.get("is_active")).toBe("false");
    expect(filterButton(t.statusFilter, t.filterInactive)).toBeVisible();

    // One press clears the search and the filter.
    await userEvent.click(
      screen.getByRole("button", { name: messages.DataTable.clearFilters }),
    );
    expect(navigation().push).toHaveBeenLastCalledWith("/companies", {
      scroll: false,
    });
  });

  it("ignores a status in the URL it doesn't know", async () => {
    navigation().search = "?is_active=maybe";
    const seen: URL[] = [];
    serveCompanies([brewery], seen);
    renderWithProviders(<CompaniesScreen />);

    await screen.findByRole("link", { name: "Addis Brewery" });
    expect(seen[0]?.searchParams.has("is_active")).toBe(false);
  });

  it("filters by status from its menu", async () => {
    serveCompanies([brewery]);
    const user = userEvent.setup();
    renderWithProviders(<CompaniesScreen />);
    await screen.findByRole("link", { name: "Addis Brewery" });

    await chooseFilter(user, t.statusFilter, t.filterActive);

    expect(navigation().push).toHaveBeenLastCalledWith(
      "/companies?is_active=true",
      { scroll: false },
    );
  });

  it("offers to clear the search and filter when nothing matches", async () => {
    navigation().search = "?q=zz&is_active=true";
    serveCompanies([]);
    const user = userEvent.setup();
    renderWithProviders(<CompaniesScreen />);

    expect(await screen.findByText(t.noMatchesTitle)).toBeVisible();
    await user.click(screen.getByRole("button", { name: t.clearFilters }));

    expect(navigation().push).toHaveBeenLastCalledWith("/companies", {
      scroll: false,
    });
  });

  it("invites adding the first company when there are none", async () => {
    serveCompanies([]);
    renderWithProviders(<CompaniesScreen />);

    expect(await screen.findByText(t.emptyTitle)).toBeVisible();
  });

  it("pages with the API's cursor", async () => {
    serveCompanies([brewery], undefined, "page-2");
    renderWithProviders(<CompaniesScreen />);

    expect(
      await screen.findByRole("link", { name: messages.DataTable.nextPage }),
    ).toHaveAttribute("href", "/companies?cursor=page-2");
  });

  it("shows a failed load with its reference and a retry", async () => {
    server.use(
      http.get(apiUrl("/v1/companies"), () =>
        problemResponse(500, "INTERNAL_ERROR", "req-500"),
      ),
    );
    renderWithProviders(<CompaniesScreen />);

    expect(
      await screen.findByText(messages.Errors.INTERNAL_ERROR),
    ).toBeVisible();
    expect(screen.getByText("req-500")).toBeVisible();
  });

  it("shows NoPermission when the API says this role can't list companies", async () => {
    server.use(
      http.get(apiUrl("/v1/companies"), () =>
        problemResponse(403, "FORBIDDEN"),
      ),
    );
    renderWithProviders(<CompaniesScreen />);

    expect(await screen.findByText(messages.NoPermission.title)).toBeVisible();
    expect(screen.queryByRole("button", { name: t.add })).toBeNull();
  });

  it("on narrower screens, a company's row links to its own page", async () => {
    serveCompanies([brewery]);
    const user = userEvent.setup();
    renderWithProviders(<CompaniesScreen />);

    const link = await screen.findByRole("link", { name: "Addis Brewery" });
    expect(link).toHaveAttribute("href", `/companies/${brewery.id}`);
    await user.click(link);
    expect(navigation().push).not.toHaveBeenCalledWith(
      expect.stringContaining("company="),
      expect.anything(),
    );
  });

  it("on wide screens, a company's row opens its details beside the list", async () => {
    wideScreen();
    serveCompanies([brewery]);
    const user = userEvent.setup();
    renderWithProviders(<CompaniesScreen />);

    const link = await screen.findByRole("link", { name: "Addis Brewery" });
    // Still a real link (a new tab opens the full page).
    expect(link).toHaveAttribute("href", `/companies/${brewery.id}`);
    await user.click(link);

    expect(navigation().push).toHaveBeenLastCalledWith(
      `/companies?company=${brewery.id}`,
      { scroll: false },
    );
  });

  it("on wide screens, shows the open company in a side panel that can be closed", async () => {
    wideScreen();
    navigation().search = `?company=${brewery.id}`;
    serveCompanies([brewery]);
    serveCompany(brewery);
    const user = userEvent.setup();
    renderWithProviders(<CompaniesScreen />);

    const panel = await screen.findByRole("region", {
      name: "Addis Brewery",
    });
    expect(
      await within(panel).findByRole("heading", {
        level: 2,
        name: "Addis Brewery",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Addis Brewery" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await user.click(
      within(panel).getByRole("button", { name: t.closeDetail }),
    );
    expect(navigation().push).toHaveBeenLastCalledWith("/companies", {
      scroll: false,
    });
  });

  it("on narrower screens, a shared panel link opens the company's page", async () => {
    navigation().search = `?company=${brewery.id}`;
    serveCompanies([brewery]);
    renderWithProviders(<CompaniesScreen />);

    await waitFor(() =>
      expect(navigation().replace).toHaveBeenCalledWith(
        `/companies/${brewery.id}`,
      ),
    );
  });
});

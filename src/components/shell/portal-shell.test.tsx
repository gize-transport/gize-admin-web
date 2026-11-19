import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import {
  apiUrl,
  problem,
  problemHeaders,
  server,
  type Schemas,
} from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { navItems, type NavItem } from "./nav-items";
import { PortalShell } from "./portal-shell";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  nav.state = state;
  return mockNavigation(state);
});
const auth = vi.hoisted(() => ({
  signOut: vi.fn(async () => ({ error: null })),
}));
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth }),
  getAccessToken: async () => "access-token",
}));

type Nav = ReturnType<
  typeof import("../../../tests/utils/navigation").createNavigationState
>;
const navigation = () => nav.state as Nav;
const t = messages.Shell;

startMswServer();

const allBuilt: NavItem[] = navItems.map((item) => ({
  ...item,
  available: true,
}));

function serveStaff(role: Schemas["StaffRole"]) {
  server.use(
    http.get(apiUrl("/v1/staff/me"), () =>
      HttpResponse.json<Schemas["StaffMe"]>({
        id: "00000000-0000-4000-8000-000000000002",
        full_name: role === "admin" ? "Abebe Admin" : "Selam Staff",
        email: `${role}@gize.test`,
        role,
      }),
    ),
  );
}

/** The overview's counts, of which the sidebar shows the open route requests. */
function serveOverview(openRequests: number) {
  server.use(
    http.get(apiUrl("/v1/overview"), () => {
      return HttpResponse.json<Schemas["Overview"]>({
        as_of: "2026-11-19",
        routes: {
          draft: 0,
          forming: 0,
          active: 0,
          paused: 0,
          ready_to_launch: 0,
          active_without_driver: 0,
        },
        riders: { total: 0, riding: 0, reserved: 0, starting: 0 },
        route_requests: { open: openRequests },
        seat_offers: { open: 0 },
        drivers: { active: 0 },
      });
    }),
  );
}

/** The sidebar (desktop) — jsdom shows both it and the top bar, as it has no media queries. */
function sidebar() {
  return within(screen.getByRole("complementary"));
}

beforeEach(() => {
  navigation().pathname = "/";
  serveOverview(0);
});

describe("PortalShell", () => {
  it("puts the page in the main landmark with a skip link to it", async () => {
    serveStaff("staff");
    renderWithProviders(
      <PortalShell>
        <h1>Page</h1>
      </PortalShell>,
    );

    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { name: "Page" }),
    );
    expect(screen.getByRole("link", { name: t.skipToContent })).toHaveAttribute(
      "href",
      "#content",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "content");
  });

  it("shows every built screen, admin tools aside", () => {
    serveStaff("admin");
    renderWithProviders(<PortalShell>{null}</PortalShell>);

    const links = within(
      sidebar().getByRole("navigation", { name: t.navLabel }),
    ).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      t.nav.overview,
      t.nav.routes,
      t.nav.routeRequests,
      t.nav.demand,
      t.nav.companies,
      t.nav.riders,
      t.nav.drivers,
      t.nav.areas,
      t.nav.corridors,
    ]);
  });

  it("marks the current page, including its detail pages", () => {
    serveStaff("staff");
    navigation().pathname = "/routes/abc";
    renderWithProviders(<PortalShell items={allBuilt}>{null}</PortalShell>);

    expect(sidebar().getByRole("link", { name: t.nav.routes })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      sidebar().getByRole("link", { name: t.nav.overview }),
    ).not.toHaveAttribute("aria-current");
  });

  it("groups the screens under headings, Admin only for admins", async () => {
    serveStaff("admin");
    renderWithProviders(<PortalShell items={allBuilt}>{null}</PortalShell>);

    const group = (name: string) =>
      within(sidebar().getByRole("list", { name }))
        .getAllByRole("link")
        .map((link) => link.textContent);
    // Admin shows once the role is known.
    await sidebar().findByRole("list", { name: t.groupAdmin });
    expect(group(t.groupOperations)).toEqual([
      t.nav.routes,
      t.nav.routeRequests,
      t.nav.demand,
    ]);
    expect(group(t.groupPeople)).toEqual([
      t.nav.companies,
      t.nav.riders,
      t.nav.drivers,
    ]);
    expect(group(t.groupPlaces)).toEqual([t.nav.areas, t.nav.corridors]);
    expect(group(t.groupAdmin)).toEqual([t.nav.staff, t.nav.auditLog]);
  });

  it("puts an icon before each name, hidden from screen readers", () => {
    serveStaff("staff");
    renderWithProviders(<PortalShell items={allBuilt}>{null}</PortalShell>);

    const links = within(
      sidebar().getByRole("navigation", { name: t.navLabel }),
    ).getAllByRole("link");
    for (const link of links) {
      const icon = link.querySelector("svg");
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("shows how many route requests are open beside Route requests", async () => {
    serveStaff("staff");
    serveOverview(6);
    renderWithProviders(<PortalShell items={allBuilt}>{null}</PortalShell>);

    const link = sidebar().getByRole("link", { name: t.nav.routeRequests });
    await waitFor(() => expect(link).toHaveAccessibleDescription("6 open"));
    expect(link).toHaveAttribute("href", "/route-requests");
    expect(sidebar().getByText("6")).toBeVisible();
    // Only there.
    expect(
      sidebar().getByRole("link", { name: t.nav.routes }),
    ).not.toHaveAttribute("aria-describedby");
  });

  it("shows 99+ for more than 99 open requests", async () => {
    serveStaff("staff");
    serveOverview(120);
    renderWithProviders(<PortalShell items={allBuilt}>{null}</PortalShell>);

    const link = sidebar().getByRole("link", { name: t.nav.routeRequests });
    await waitFor(() => expect(link).toHaveAccessibleDescription("99+ open"));
    expect(sidebar().getByText("99+")).toBeVisible();
  });

  it("shows no count when no request is open", async () => {
    serveStaff("staff");
    serveOverview(0);
    const { queryClient } = renderWithProviders(
      <PortalShell items={allBuilt}>{null}</PortalShell>,
    );

    await waitFor(() =>
      expect(queryClient.getQueryState(["overview"])?.status).toBe("success"),
    );
    expect(
      sidebar().getByRole("link", { name: t.nav.routeRequests }),
    ).toHaveAccessibleDescription("");
    expect(sidebar().queryByText("0")).toBeNull();
  });

  it.each([
    [403, "FORBIDDEN"],
    [500, "INTERNAL_ERROR"],
  ] as const)(
    "leaves the count out when the counts can't be read (%i)",
    async (status, code) => {
      serveStaff("staff");
      server.use(
        http.get(apiUrl("/v1/overview"), () =>
          HttpResponse.json(problem(status, code), {
            status,
            headers: problemHeaders,
          }),
        ),
      );
      const { queryClient } = renderWithProviders(
        <PortalShell items={allBuilt}>{null}</PortalShell>,
      );

      await waitFor(() =>
        expect(queryClient.getQueryState(["overview"])?.status).toBe("error"),
      );
      expect(
        sidebar().getByRole("link", { name: t.nav.routeRequests }),
      ).toHaveAccessibleDescription("");
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it("drops a count it read before once a later read fails", async () => {
    serveStaff("staff");
    serveOverview(6);
    const { queryClient } = renderWithProviders(
      <PortalShell items={allBuilt}>{null}</PortalShell>,
    );
    const link = sidebar().getByRole("link", { name: t.nav.routeRequests });
    await waitFor(() => expect(link).toHaveAccessibleDescription("6 open"));

    server.use(
      http.get(apiUrl("/v1/overview"), () =>
        HttpResponse.json(problem(500, "INTERNAL_ERROR"), {
          status: 500,
          headers: problemHeaders,
        }),
      ),
    );
    await queryClient.refetchQueries({ queryKey: ["overview"] });

    await waitFor(() => expect(link).toHaveAccessibleDescription(""));
    expect(sidebar().queryByText("6")).toBeNull();
  });

  it("hides Staff and Audit log from staff", async () => {
    serveStaff("staff");
    renderWithProviders(<PortalShell items={allBuilt}>{null}</PortalShell>);

    await sidebar().findByText("Selam Staff");
    expect(sidebar().queryByRole("link", { name: t.nav.staff })).toBeNull();
    expect(sidebar().queryByRole("link", { name: t.nav.auditLog })).toBeNull();
  });

  it("shows Staff and Audit log to admins once the role is known", async () => {
    serveStaff("admin");
    renderWithProviders(<PortalShell items={allBuilt}>{null}</PortalShell>);

    expect(
      await sidebar().findByRole("link", { name: t.nav.staff }),
    ).toHaveAttribute("href", "/staff");
    expect(
      sidebar().getByRole("link", { name: t.nav.auditLog }),
    ).toHaveAttribute("href", "/audit-log");
  });

  it("opens the menu drawer, keeps focus inside, and closes on Escape back to the button", async () => {
    serveStaff("staff");
    const user = userEvent.setup();
    renderWithProviders(<PortalShell items={allBuilt}>{null}</PortalShell>);
    const open = screen.getByRole("button", { name: t.openMenu });

    await user.click(open);

    const drawer = await screen.findByRole("dialog", { name: t.menuTitle });
    expect(drawer).toContainElement(document.activeElement as HTMLElement);
    expect(
      within(drawer).getByRole("link", { name: t.nav.routes }),
    ).toBeInTheDocument();
    for (let i = 0; i < 20; i++) await user.tab();
    expect(drawer).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(open).toHaveFocus();
  });

  it("closes the drawer when a link changes the page", async () => {
    serveStaff("staff");
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <PortalShell items={allBuilt}>{null}</PortalShell>,
    );
    await user.click(screen.getByRole("button", { name: t.openMenu }));
    await screen.findByRole("dialog");

    navigation().pathname = "/routes";
    rerender(<PortalShell items={allBuilt}>{null}</PortalShell>);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes the drawer when a link to the page already open is clicked", async () => {
    serveStaff("staff");
    const user = userEvent.setup();
    renderWithProviders(<PortalShell items={allBuilt}>{null}</PortalShell>);
    await user.click(screen.getByRole("button", { name: t.openMenu }));
    const drawer = await screen.findByRole("dialog");

    await user.click(
      within(drawer).getByRole("link", { name: t.nav.overview }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("signs out once someone the API says isn't staff, even with the drawer open", async () => {
    server.use(
      http.get(apiUrl("/v1/staff/me"), () =>
        HttpResponse.json(problem(403, "FORBIDDEN"), {
          status: 403,
          headers: problemHeaders,
        }),
      ),
    );
    auth.signOut.mockClear();
    navigation().replace.mockClear();
    const user = userEvent.setup();
    renderWithProviders(<PortalShell>{null}</PortalShell>);
    await user.click(screen.getByRole("button", { name: t.openMenu }));

    await waitFor(() =>
      expect(navigation().replace).toHaveBeenCalledWith(
        "/sign-in?reason=not_staff",
      ),
    );
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});

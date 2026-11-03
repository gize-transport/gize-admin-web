import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { currentStaffQueryKey } from "@/lib/auth/use-current-staff";
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
vi.mock("@/components/toast", () => ({ showSuccessToast: vi.fn() }));

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
});

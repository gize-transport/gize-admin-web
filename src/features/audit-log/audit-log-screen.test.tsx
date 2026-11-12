import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { problemResponse } from "../routes/test-support";
import { me, otherAdmin, serveMe, serveMember } from "../staff/test-support";
import { AuditLogScreen } from "./audit-log-screen";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/audit-log";
  nav.state = state;
  return mockNavigation(state);
});
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));

type Nav = ReturnType<
  typeof import("../../../tests/utils/navigation").createNavigationState
>;
const navigation = () => nav.state as Nav;
const t = messages.AuditLog;

startMswServer();

const ROUTE = "00000000-0000-4000-d000-000000000003";
const AREA_A = "00000000-0000-4000-a000-000000000001";
const AREA_B = "00000000-0000-4000-a000-000000000002";
const at = "2026-10-02T09:00:00Z";

function entry(
  index: number,
  overrides: Partial<Schemas["AuditEntryRead"]>,
): Schemas["AuditEntryRead"] {
  return {
    id: `00000000-0000-4000-f000-${String(index).padStart(12, "0")}`,
    created_at: at,
    actor_staff_id: me.id,
    action: "route.status_changed",
    entity_type: "route",
    entity_id: ROUTE,
    before: { status: "draft" },
    after: { status: "forming" },
    request_id: `req-${index}`,
    ...overrides,
  };
}

const entries = [
  entry(1, {}),
  entry(2, {
    action: "company.updated",
    entity_type: "company",
    entity_id: "00000000-0000-4000-c000-000000000001",
    actor_staff_id: otherAdmin.id,
    before: { contact_phone: "[redacted]", notes: null },
    after: { contact_phone: "[redacted]", notes: "[redacted]" },
  }),
  entry(3, {
    action: "staff.first_admin_created",
    entity_type: "staff",
    entity_id: me.id,
    actor_staff_id: null,
    before: null,
    after: { full_name: "[redacted]", role: "admin", is_active: true },
  }),
  entry(4, {
    action: "route.prices_changed",
    before: { price_round_trip: null },
    after: { price_round_trip: 2400 },
  }),
  entry(7, {
    action: "route.areas_changed",
    before: { served_area_ids: [] },
    after: { served_area_ids: [AREA_A, AREA_B] },
  }),
  entry(5, {
    action: "area.renamed",
    entity_type: "area",
    entity_id: "00000000-0000-4000-a000-000000000003",
    before: { name: "Mexiko" },
    after: { name: "Mexico" },
  }),
  entry(6, {
    action: "vehicle.inspected",
    entity_type: "vehicle",
    before: null,
    after: { plate_number: "AA-1234" },
  }),
];

function serveLog(items: Schemas["AuditEntryRead"][], seen?: URL[]) {
  server.use(
    http.get(apiUrl("/v1/audit-log"), ({ request }) => {
      seen?.push(new URL(request.url));
      return HttpResponse.json<Schemas["AuditEntryPage"]>({
        items,
        next_cursor: null,
      });
    }),
    http.get(apiUrl("/v1/staff"), () =>
      HttpResponse.json<Schemas["StaffPage"]>({
        items: [me, otherAdmin],
        next_cursor: null,
      }),
    ),
  );
}

function rowOf(action: string) {
  const row = screen.getByText(action).closest("tr");
  if (!row) throw new Error(`no row for ${action}`);
  return row as HTMLElement;
}

beforeEach(() => {
  navigation().search = "";
  navigation().push.mockClear();
  serveMe();
  serveMember(me, otherAdmin);
});

describe("AuditLogScreen", () => {
  it("lists changes with what changed, on which record, and who did it", async () => {
    serveLog(entries);
    renderWithProviders(<AuditLogScreen />);

    await screen.findByText(t.actions.route.status_changed);
    const route = rowOf(t.actions.route.status_changed);
    expect(
      within(route).getByRole("link", { name: /^Route changed/ }),
    ).toHaveAttribute("href", `/routes/${ROUTE}`);
    expect(await within(route).findByText(me.full_name)).toBeVisible();

    const company = rowOf(t.actions.company.updated);
    expect(
      await within(company).findByText(otherAdmin.full_name),
    ).toBeVisible();
    expect(
      within(rowOf(t.actions.staff.first_admin_created)).getByText(t.operator),
    ).toBeVisible();
    // Areas have no page of their own: named, not linked.
    const area = rowOf(t.actions.area.renamed);
    expect(within(area).queryByRole("link")).toBeNull();
    expect(within(area).getByText(t.entityTitle.area)).toBeVisible();
    // An action this portal doesn't know yet reads as the API wrote it.
    expect(rowOf("vehicle.inspected")).toHaveTextContent(t.entityTitle.other);
  });

  it("shows the changes as before and after, hidden personal values as hidden", async () => {
    serveLog(entries);
    const user = userEvent.setup();
    renderWithProviders(<AuditLogScreen />);

    await screen.findByText(t.actions.company.updated);
    const company = rowOf(t.actions.company.updated);
    await user.click(within(company).getByText(t.showChanges));
    const changes = within(company).getByRole("table", {
      name: t.changesLabel,
    });
    const phone = within(changes)
      .getByRole("rowheader", {
        name: t.fields.contact_phone,
      })
      .closest("tr") as HTMLElement;
    expect(within(phone).getAllByText(t.redacted)).toHaveLength(2);
    expect(changes).not.toHaveTextContent("[redacted]");
    const notes = within(changes)
      .getByRole("rowheader", { name: t.fields.notes })
      .closest("tr") as HTMLElement;
    expect(notes).toHaveTextContent(`${t.notSet}${t.redacted}`);
    expect(within(company).getByText("Reference: req-2")).toBeVisible();

    const prices = rowOf(t.actions.route.prices_changed);
    await user.click(within(prices).getByText(t.showChanges));
    expect(prices).toHaveTextContent("2,400 birr");

    // Areas served: each ID short on screen, whole to screen readers; none before.
    const areas = rowOf(t.actions.route.areas_changed);
    await user.click(within(areas).getByText(t.showChanges));
    expect(within(areas).getByText("No areas")).toBeVisible();
    expect(within(areas).getByText(AREA_A)).toHaveClass("sr-only");
    expect(areas).toHaveTextContent("00000000…");

    // Statuses and roles in words; Yes/No; a value not there before says so.
    const status = rowOf(t.actions.route.status_changed);
    await user.click(within(status).getByText(t.showChanges));
    expect(status).toHaveTextContent(
      `${t.values.status.draft}${t.values.status.forming}`,
    );
    const first = rowOf(t.actions.staff.first_admin_created);
    await user.click(within(first).getByText(t.showChanges));
    expect(first).toHaveTextContent(t.values.role.admin);
    expect(within(first).getAllByText(t.yes).length).toBeGreaterThan(0);
    expect(within(first).getAllByText(t.noValue).length).toBeGreaterThan(0);
  });

  it("names rider and seat changes, linking to the rider", async () => {
    const RIDER = "00000000-0000-4000-f000-000000000041";
    serveLog([
      entry(41, {
        action: "rider.updated",
        entity_type: "rider",
        entity_id: RIDER,
        before: {
          phone: "[redacted]",
          plan: "round_trip",
          saturday_addon: false,
        },
        after: { phone: "[redacted]", plan: "morning", saturday_addon: true },
      }),
      entry(42, {
        action: "route_assignment.created",
        entity_type: "route_assignment",
        entity_id: "00000000-0000-4000-f000-000000000042",
        before: null,
        after: { status: "reserved", start_date: "2026-12-01" },
      }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<AuditLogScreen />);

    await screen.findByText(t.actions.rider.updated);
    const rider = rowOf(t.actions.rider.updated);
    expect(
      within(rider).getByRole("link", { name: /^Rider changed/ }),
    ).toHaveAttribute("href", `/riders/${RIDER}`);
    await user.click(within(rider).getByText(t.showChanges));
    expect(rider).toHaveTextContent(
      `${t.fields.plan}${t.values.plan.round_trip}${t.values.plan.morning}`,
    );
    expect(rider).toHaveTextContent(
      `${t.fields.saturday_addon}${t.no}${t.yes}`,
    );
    expect(rider).not.toHaveTextContent("[redacted]");

    // A seat has no page of its own: named, not linked.
    const seat = rowOf(t.actions.route_assignment.created);
    expect(within(seat).queryByRole("link")).toBeNull();
    expect(
      within(seat).getByText(t.entityTitle.route_assignment),
    ).toBeVisible();
    await user.click(within(seat).getByText(t.showChanges));
    // A new record has nothing before.
    expect(seat).toHaveTextContent(
      `${t.fields.status}–${t.noValue}${t.values.status.reserved}`,
    );
  });

  it("names driver changes, linking to the driver, the phone hidden", async () => {
    const DRIVER = "00000000-0000-4000-f000-000000000051";
    serveLog([
      entry(51, {
        action: "driver.updated",
        entity_type: "driver",
        entity_id: DRIVER,
        before: { phone: "[redacted]", plate: "AA 3-B12341", is_active: true },
        after: { phone: "[redacted]", plate: "AA 3-B54321", is_active: false },
      }),
      entry(52, {
        action: "route.driver_changed",
        entity_type: "route",
        entity_id: "00000000-0000-4000-d000-000000000052",
        before: { driver_id: null },
        after: { driver_id: DRIVER },
      }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<AuditLogScreen />);

    await screen.findByText(t.actions.driver.updated);
    const changed = rowOf(t.actions.driver.updated);
    expect(
      within(changed).getByRole("link", { name: /^Driver changed/ }),
    ).toHaveAttribute("href", `/drivers/${DRIVER}`);
    await user.click(within(changed).getByText(t.showChanges));
    expect(changed).toHaveTextContent(
      `${t.fields.plate}AA 3-B12341AA 3-B54321`,
    );
    expect(changed).not.toHaveTextContent("[redacted]");
    expect(rowOf(t.actions.route.driver_changed)).toBeVisible();
  });

  it("filters by who made the change", async () => {
    const seen: URL[] = [];
    serveLog(entries, seen);
    const user = userEvent.setup();
    renderWithProviders(<AuditLogScreen />);

    const select = await screen.findByLabelText(t.actorFilter);
    await waitFor(() =>
      expect(
        within(select).getByRole("option", { name: otherAdmin.full_name }),
      ).toBeInTheDocument(),
    );
    await user.selectOptions(select, otherAdmin.id);

    expect(navigation().push).toHaveBeenLastCalledWith(
      `/audit-log?actor_staff_id=${otherAdmin.id}`,
      { scroll: false },
    );
  });

  it("shows one record's history from an entry, and back to all", async () => {
    serveLog(entries);
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<AuditLogScreen />);

    await screen.findByText(t.actions.route.status_changed);
    const route = rowOf(t.actions.route.status_changed);
    await user.click(within(route).getByText(t.showChanges));
    await user.click(
      within(route).getByRole("button", { name: t.recordHistory }),
    );
    expect(navigation().push).toHaveBeenLastCalledWith(
      `/audit-log?entity_type=route&entity_id=${ROUTE}`,
      { scroll: false },
    );
    unmount();

    navigation().search = `?entity_type=route&entity_id=${ROUTE}`;
    const seen: URL[] = [];
    serveLog([entries[0]!], seen);
    renderWithProviders(<AuditLogScreen />);
    expect(
      await screen.findByText(t.recordFilter.replace("{type}", "route")),
    ).toBeVisible();
    expect(seen[0]?.searchParams.get("entity_type")).toBe("route");
    expect(seen[0]?.searchParams.get("entity_id")).toBe(ROUTE);
    expect(
      screen.getByRole("link", {
        name: t.openRecord.replace("{type}", "route"),
      }),
    ).toHaveAttribute("href", `/routes/${ROUTE}`);
    await user.click(screen.getByRole("button", { name: t.showAll }));
    expect(navigation().push).toHaveBeenLastCalledWith("/audit-log", {
      scroll: false,
    });
  });

  it("moves focus to the record banner after a history opens, and to Done by after Show all", async () => {
    serveLog(entries);
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<AuditLogScreen />);
    await screen.findByText(t.actions.route.status_changed);
    const route = rowOf(t.actions.route.status_changed);
    await user.click(within(route).getByText(t.showChanges));
    await user.click(
      within(route).getByRole("button", { name: t.recordHistory }),
    );

    // The address changes (the mock router doesn't navigate by itself).
    navigation().search = `?entity_type=route&entity_id=${ROUTE}`;
    rerender(<AuditLogScreen />);
    const banner = (
      await screen.findByText(t.recordFilter.replace("{type}", "route"))
    ).parentElement;
    await waitFor(() => expect(banner).toHaveFocus());

    await user.click(screen.getByRole("button", { name: t.showAll }));
    navigation().search = "";
    rerender(<AuditLogScreen />);
    await waitFor(() =>
      expect(screen.getByLabelText(t.actorFilter)).toHaveFocus(),
    );
  });

  it("names a person in the address who isn't in the Done by list", async () => {
    const outside = {
      ...otherAdmin,
      id: "00000000-0000-4000-8000-000000000077",
      full_name: "Tigist Outside",
    };
    navigation().search = `?actor_staff_id=${outside.id}`;
    serveLog([entry(8, { actor_staff_id: outside.id })]);
    serveMember(me, otherAdmin, outside);
    renderWithProviders(<AuditLogScreen />);

    const select = await screen.findByLabelText(t.actorFilter);
    await waitFor(() => expect(select).toHaveDisplayValue("Tigist Outside"));
  });

  it("offers to clear a filter the API can't read", async () => {
    navigation().search = `?actor_staff_id=${otherAdmin.id}`;
    server.use(
      http.get(apiUrl("/v1/audit-log"), () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "VALIDATION_FAILED",
            status: 422,
            code: "VALIDATION_FAILED",
            request_id: "req-422",
            errors: [
              {
                location: "query",
                field: "/actor_staff_id",
                reason: "invalid",
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
    renderWithProviders(<AuditLogScreen />);

    expect(await screen.findByText(t.noMatchesTitle)).toBeVisible();
    expect(screen.getByRole("button", { name: t.clearFilters })).toBeVisible();
  });

  it("ignores a record filter in the URL that isn't a type and ID together", async () => {
    navigation().search = "?entity_type=route";
    const seen: URL[] = [];
    serveLog(entries, seen);
    renderWithProviders(<AuditLogScreen />);

    await screen.findByText(t.actions.area.renamed);
    expect(seen[0]?.searchParams.has("entity_type")).toBe(false);
  });

  it("says when nothing was recorded, and when a filter matches nothing", async () => {
    serveLog([]);
    const { unmount } = renderWithProviders(<AuditLogScreen />);
    expect(await screen.findByText(t.emptyTitle)).toBeVisible();
    unmount();

    navigation().search = `?actor_staff_id=${otherAdmin.id}`;
    renderWithProviders(<AuditLogScreen />);
    expect(await screen.findByText(t.noMatchesTitle)).toBeVisible();
  });

  it("shows an error with its reference and a retry, and no permission for staff", async () => {
    server.use(
      http.get(apiUrl("/v1/audit-log"), () =>
        problemResponse(503, "SERVICE_UNAVAILABLE", "req-503"),
      ),
    );
    const { unmount } = renderWithProviders(<AuditLogScreen />);
    expect(await screen.findByText("req-503")).toBeVisible();
    expect(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    ).toBeVisible();
    unmount();

    server.use(
      http.get(apiUrl("/v1/audit-log"), () =>
        problemResponse(403, "FORBIDDEN"),
      ),
    );
    renderWithProviders(<AuditLogScreen />);
    expect(await screen.findByText(messages.NoPermission.title)).toBeVisible();
  });
});

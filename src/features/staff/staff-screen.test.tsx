import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { chooseFilter } from "../../../tests/utils/filters";
import { renderWithProviders } from "../../../tests/utils/render";
import { problemResponse } from "../routes/test-support";
import { StaffScreen } from "./staff-screen";
import {
  former,
  me,
  otherAdmin,
  pending,
  serveMe,
  serveMember,
  serveMembers,
} from "./test-support";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/staff";
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
const t = messages.Staff;

startMswServer();

beforeEach(() => {
  navigation().search = "";
  navigation().push.mockClear();
  serveMe();
});

afterEach(() => vi.unstubAllGlobals());

function rowOf(name: string) {
  const row = screen.getByRole("link", { name }).closest("tr");
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

describe("StaffScreen", () => {
  it("lists members with email, role and status, marking the signed-in admin", async () => {
    serveMembers([me, otherAdmin, pending, former]);
    renderWithProviders(<StaffScreen />);

    await screen.findByRole("link", { name: "Hana Tesfaye" });
    const mine = rowOf("Abebe Admin");
    expect(mine).toHaveTextContent("admin@gize.test");
    expect(mine).toHaveTextContent(t.roleAdmin);
    expect(await within(mine).findByText(t.you)).toBeVisible();
    expect(within(mine).getByText(t.statusActive)).toBeVisible();
    expect(
      within(rowOf("Hana Tesfaye")).getByText(t.statusPending),
    ).toBeVisible();
    expect(
      within(rowOf("Dawit Former")).getByText(t.statusDeactivated),
    ).toBeVisible();
    expect(rowOf("Meron Admin")).not.toHaveTextContent(t.you);
  });

  it("sends the role and status filters from the URL", async () => {
    navigation().search = "?role=staff&is_active=false";
    const seen: URL[] = [];
    serveMembers([former], seen);
    renderWithProviders(<StaffScreen />);

    await screen.findByRole("link", { name: "Dawit Former" });
    expect(seen[0]?.searchParams.get("role")).toBe("staff");
    expect(seen[0]?.searchParams.get("is_active")).toBe("false");
  });

  it("filters from a menu", async () => {
    serveMembers([me]);
    const user = userEvent.setup();
    renderWithProviders(<StaffScreen />);

    await screen.findByRole("table", { name: t.tableLabel });
    await chooseFilter(user, t.roleFilter, t.roleAdmin);
    expect(navigation().push).toHaveBeenLastCalledWith("/staff?role=admin", {
      scroll: false,
    });
  });

  it("opens a member beside the list on wide screens", async () => {
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
    navigation().search = `?member=${pending.id}`;
    serveMembers([me, pending]);
    serveMember(pending);
    renderWithProviders(<StaffScreen />);

    const panel = await screen.findByRole("region", { name: "Hana Tesfaye" });
    expect(panel).toHaveFocus();
    expect(within(panel).getByText(t.statusPendingNote)).toBeVisible();
  });

  it("says when the person isn't an admin", async () => {
    server.use(
      http.get(apiUrl("/v1/staff"), () => problemResponse(403, "FORBIDDEN")),
    );
    renderWithProviders(<StaffScreen />);

    expect(await screen.findByText(messages.NoPermission.title)).toBeVisible();
  });

  it("shows an error with its reference", async () => {
    server.use(
      http.get(apiUrl("/v1/staff"), () =>
        problemResponse(503, "SERVICE_UNAVAILABLE", "req-503"),
      ),
    );
    renderWithProviders(<StaffScreen />);

    expect(await screen.findByText("req-503")).toBeVisible();
  });
});

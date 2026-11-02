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
import { currentStaffQueryKey } from "@/lib/auth/use-current-staff";
import { AreasScreen } from "./areas-screen";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/areas";
  nav.state = state;
  return mockNavigation(state);
});
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

type Nav = ReturnType<
  typeof import("../../../tests/utils/navigation").createNavigationState
>;
const navigation = () => nav.state as Nav;
const t = messages.Areas;

startMswServer();

function area(name: string, index: number): Schemas["AreaRead"] {
  return {
    id: `00000000-0000-4000-a000-${String(index).padStart(12, "0")}`,
    name,
    created_at: "2026-10-31T21:30:00Z",
    updated_at: "2026-10-31T21:30:00Z",
  };
}
const bole = area("Bole", 1);
const piassa = area("Piassa", 2);

function serveRole(role: Schemas["StaffRole"]) {
  server.use(
    http.get(apiUrl("/v1/staff/me"), () =>
      HttpResponse.json<Schemas["StaffMe"]>({
        id: "00000000-0000-4000-8000-000000000001",
        full_name: "Test",
        email: "t@gize.test",
        role,
      }),
    ),
  );
}

function serveAreas(items: Schemas["AreaRead"][], seen?: URL[]) {
  server.use(
    http.get(apiUrl("/v1/areas"), ({ request }) => {
      seen?.push(new URL(request.url));
      return HttpResponse.json<Schemas["AreaPage"]>({
        items,
        next_cursor: null,
      });
    }),
  );
}

beforeEach(() => {
  navigation().search = "";
  navigation().push.mockClear();
  navigation().replace.mockClear();
  toast.mockClear();
  serveRole("staff");
});

describe("AreasScreen", () => {
  it("lists areas with the date they were added, in Addis Ababa time", async () => {
    serveAreas([bole, piassa]);
    renderWithProviders(<AreasScreen />);

    expect(
      screen.getByRole("heading", { level: 1, name: t.title }),
    ).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: t.tableLabel });
    expect(await within(table).findByText("Bole")).toBeInTheDocument();
    expect(within(table).getByText("Piassa")).toBeInTheDocument();
    // 21:30 UTC on 31 October is 1 November in Addis Ababa.
    expect(within(table).getAllByText("Nov 1, 2026")).toHaveLength(2);
  });

  it("sends the search from the URL and offers to clear it when nothing matches", async () => {
    navigation().search = "?q=zz";
    const seen: URL[] = [];
    serveAreas([], seen);
    const user = userEvent.setup();
    renderWithProviders(<AreasScreen />);

    expect(
      await screen.findByText(t.noMatchesTitle.replace("{q}", "zz")),
    ).toBeInTheDocument();
    expect(seen[0]?.searchParams.get("q")).toBe("zz");
    expect(seen[0]?.searchParams.get("limit")).toBe("25");

    await user.click(screen.getByRole("button", { name: t.clearSearch }));

    expect(navigation().push).toHaveBeenCalledWith("/areas", {
      scroll: false,
    });
  });

  it("puts what is typed in the search box into the URL", async () => {
    serveAreas([bole]);
    const user = userEvent.setup();
    renderWithProviders(<AreasScreen />);
    await screen.findByText("Bole");

    await user.type(screen.getByLabelText(t.searchLabel), "me");

    await waitFor(() =>
      expect(navigation().replace).toHaveBeenLastCalledWith("/areas?q=me", {
        scroll: false,
      }),
    );
  });

  it("invites adding the first area when there are none", async () => {
    serveAreas([]);
    renderWithProviders(<AreasScreen />);

    expect(await screen.findByText(t.emptyTitle)).toBeInTheDocument();
  });

  it("shows a failed load with its reference and a retry", async () => {
    server.use(
      http.get(apiUrl("/v1/areas"), () =>
        HttpResponse.json(problem(500, "INTERNAL_ERROR", "req-500"), {
          status: 500,
          headers: problemHeaders,
        }),
      ),
    );
    renderWithProviders(<AreasScreen />);

    expect(
      await screen.findByText(messages.Errors.INTERNAL_ERROR),
    ).toBeInTheDocument();
    expect(screen.getByText(/req-500/)).toBeInTheDocument();
  });

  it("shows NoPermission when the API says this role can't list areas", async () => {
    server.use(
      http.get(apiUrl("/v1/areas"), () =>
        HttpResponse.json(problem(403, "FORBIDDEN"), {
          status: 403,
          headers: problemHeaders,
        }),
      ),
    );
    renderWithProviders(<AreasScreen />);

    expect(
      await screen.findByText(messages.NoPermission.title),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.add })).toBeNull();
  });

  it("adds an area with one Idempotency-Key per attempt, reused on retry", async () => {
    serveAreas([bole]);
    const keys: (string | null)[] = [];
    let fail = true;
    server.use(
      http.post(apiUrl("/v1/areas"), async ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        if (fail) {
          fail = false;
          return HttpResponse.json(problem(503, "SERVICE_UNAVAILABLE"), {
            status: 503,
            headers: problemHeaders,
          });
        }
        const body = (await request.json()) as Schemas["AreaWrite"];
        return HttpResponse.json<Schemas["AreaRead"]>(area(body.name, 9), {
          status: 201,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AreasScreen />);
    await screen.findByText("Bole");

    await user.click(screen.getByRole("button", { name: t.add }));
    const dialog = await screen.findByRole("dialog", { name: t.addTitle });
    await user.type(within(dialog).getByLabelText(t.nameLabel), "  ጦር ኃይሎች ");
    await user.click(within(dialog).getByRole("button", { name: t.save }));
    expect(
      await within(dialog).findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(t.added.replace("{name}", "ጦር ኃይሎች")),
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // A new add is a new action: a new key.
    await user.click(screen.getByRole("button", { name: t.add }));
    const again = await screen.findByRole("dialog", { name: t.addTitle });
    await user.type(within(again).getByLabelText(t.nameLabel), "Lebu");
    await user.click(within(again).getByRole("button", { name: t.save }));
    await waitFor(() => expect(keys).toHaveLength(3));
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("checks the name before sending it", async () => {
    serveAreas([bole]);
    const user = userEvent.setup();
    renderWithProviders(<AreasScreen />);
    await screen.findByText("Bole");

    await user.click(screen.getByRole("button", { name: t.add }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(t.nameLabel), "   ");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    expect(await within(dialog).findByText(t.nameRequired)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(t.nameLabel)).toHaveFocus();
  });

  it("shows a taken name on the field", async () => {
    serveAreas([bole]);
    server.use(
      http.post(apiUrl("/v1/areas"), () =>
        HttpResponse.json(problem(409, "AREA_NAME_TAKEN"), {
          status: 409,
          headers: problemHeaders,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AreasScreen />);
    await screen.findByText("Bole");

    await user.click(screen.getByRole("button", { name: t.add }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(t.nameLabel), "bole");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    const field = within(dialog).getByLabelText(t.nameLabel);
    await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "true"));
    expect(field).toHaveAccessibleDescription(messages.Errors.AREA_NAME_TAKEN);
  });

  it("renames an area from its row", async () => {
    serveAreas([bole]);
    let sent: Schemas["AreaWrite"] | undefined;
    server.use(
      http.patch(apiUrl("/v1/areas/{area_id}"), async ({ request, params }) => {
        sent = (await request.json()) as Schemas["AreaWrite"];
        return HttpResponse.json<Schemas["AreaRead"]>({
          ...bole,
          id: String(params.area_id),
          name: sent.name,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AreasScreen />);

    await user.click(
      await screen.findByRole("button", { name: "Bole, rename" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: t.renameTitle.replace("{name}", "Bole"),
    });
    const field = within(dialog).getByLabelText(t.nameLabel);
    expect(field).toHaveValue("Bole");
    await user.clear(field);
    await user.type(field, "Bole Medhanialem");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        t.renamed.replace("{name}", "Bole Medhanialem"),
      ),
    );
    expect(sent).toEqual({ name: "Bole Medhanialem" });
  });

  it("offers Delete to admins only", async () => {
    serveAreas([bole]);
    const { queryClient } = renderWithProviders(<AreasScreen />);
    await screen.findByText("Bole");
    // Only once the role is known does hiding Delete mean anything.
    await waitFor(() =>
      expect(queryClient.getQueryState(currentStaffQueryKey)?.status).toBe(
        "success",
      ),
    );

    expect(screen.queryByRole("button", { name: "Delete Bole" })).toBeNull();
  });

  it("lets an admin delete an area, after confirming", async () => {
    serveRole("admin");
    serveAreas([bole]);
    let deleted: string | undefined;
    server.use(
      http.delete(apiUrl("/v1/areas/{area_id}"), ({ params }) => {
        deleted = String(params.area_id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AreasScreen />);

    await user.click(
      await screen.findByRole("button", { name: "Delete Bole" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: t.deleteTitle.replace("{name}", "Bole"),
    });
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(t.deleted.replace("{name}", "Bole")),
    );
    expect(deleted).toBe(bole.id);
  });

  it("explains why an area in use can't be deleted, with its reference, and starts clean next time", async () => {
    serveRole("admin");
    serveAreas([bole]);
    server.use(
      http.delete(apiUrl("/v1/areas/{area_id}"), () =>
        HttpResponse.json(problem(409, "AREA_IN_USE", "req-in-use"), {
          status: 409,
          headers: problemHeaders,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AreasScreen />);

    await user.click(
      await screen.findByRole("button", { name: "Delete Bole" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    expect(await within(dialog).findByText(t.inUse)).toBeInTheDocument();
    expect(within(dialog).getByText("req-in-use")).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole("button", { name: messages.Common.cancel }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Delete Bole" }));
    const again = await screen.findByRole("alertdialog");
    expect(within(again).queryByText(t.inUse)).toBeNull();
  });

  it("explains a delete the API refuses for this role", async () => {
    serveRole("admin");
    serveAreas([bole]);
    server.use(
      http.delete(apiUrl("/v1/areas/{area_id}"), () =>
        HttpResponse.json(problem(403, "FORBIDDEN", "req-403"), {
          status: 403,
          headers: problemHeaders,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AreasScreen />);

    await user.click(
      await screen.findByRole("button", { name: "Delete Bole" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    expect(
      await within(dialog).findByText(messages.Errors.FORBIDDEN),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("req-403")).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
  });

  it("keeps Save disabled while the add is being sent", async () => {
    serveAreas([bole]);
    let release = () => {};
    server.use(
      http.post(apiUrl("/v1/areas"), async () => {
        await new Promise<void>((resolve) => (release = resolve));
        return HttpResponse.json<Schemas["AreaRead"]>(area("Lebu", 9), {
          status: 201,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AreasScreen />);
    await screen.findByText("Bole");

    await user.click(screen.getByRole("button", { name: t.add }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(t.nameLabel), "Lebu");
    const save = within(dialog).getByRole("button", { name: t.save });
    await user.click(save);

    await waitFor(() => expect(save).toHaveAttribute("aria-disabled", "true"));
    expect(save).toHaveAttribute("aria-busy", "true");
    release();
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(t.added.replace("{name}", "Lebu")),
    );
  });

  it("puts the API's validation error on the name field", async () => {
    serveAreas([bole]);
    server.use(
      http.post(apiUrl("/v1/areas"), () =>
        HttpResponse.json<Schemas["ValidationProblem"]>(
          {
            type: "about:blank",
            title: "VALIDATION_FAILED",
            status: 422,
            code: "VALIDATION_FAILED",
            request_id: "req-422",
            errors: [{ location: "body", field: "/name", reason: "too_long" }],
            errors_truncated: false,
          },
          { status: 422, headers: problemHeaders },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AreasScreen />);
    await screen.findByText("Bole");

    await user.click(screen.getByRole("button", { name: t.add }));
    const dialog = await screen.findByRole("dialog");
    const field = within(dialog).getByLabelText(t.nameLabel);
    await user.type(field, "Lebu");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "true"));
    expect(field).toHaveAccessibleDescription(
      messages.ValidationReasons.too_long,
    );
    expect(field).toHaveFocus();
  });

  it("keeps Save disabled until Retry-After has passed after a 429", async () => {
    serveAreas([bole]);
    server.use(
      http.post(apiUrl("/v1/areas"), () =>
        HttpResponse.json(problem(429, "RATE_LIMITED", "req-429"), {
          status: 429,
          headers: { ...problemHeaders, "Retry-After": "1" },
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AreasScreen />);
    await screen.findByText("Bole");

    await user.click(screen.getByRole("button", { name: t.add }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(t.nameLabel), "Lebu");
    const save = within(dialog).getByRole("button", { name: t.save });
    await user.click(save);

    expect(
      await within(dialog).findByText(messages.Errors.RATE_LIMITED),
    ).toBeInTheDocument();
    expect(save).toHaveAttribute("aria-disabled", "true");
    await waitFor(() => expect(save).not.toHaveAttribute("aria-disabled"), {
      timeout: 2500,
    });
  });

  it("pages with the API's cursor", async () => {
    const seen: URL[] = [];
    server.use(
      http.get(apiUrl("/v1/areas"), ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json<Schemas["AreaPage"]>({
          items: [bole],
          next_cursor: "page-2",
        });
      }),
    );
    renderWithProviders(<AreasScreen />);

    const next = await screen.findByRole("link", {
      name: messages.DataTable.nextPage,
    });
    expect(next).toHaveAttribute("href", "/areas?cursor=page-2");
    expect(seen[0]?.searchParams.has("cursor")).toBe(false);
  });

  it("sends the cursor from the URL, and no empty search", async () => {
    navigation().search = "?q=&cursor=page-2";
    const seen: URL[] = [];
    serveAreas([bole], seen);
    renderWithProviders(<AreasScreen />);

    await screen.findByText("Bole");
    expect(seen[0]?.searchParams.get("cursor")).toBe("page-2");
    expect(seen[0]?.searchParams.has("q")).toBe(false);
  });

  it("refreshes the list when the area was deleted by someone else", async () => {
    let listCalls = 0;
    server.use(
      http.get(apiUrl("/v1/areas"), () => {
        listCalls += 1;
        return HttpResponse.json<Schemas["AreaPage"]>({
          items: [bole],
          next_cursor: null,
        });
      }),
      http.patch(apiUrl("/v1/areas/{area_id}"), () =>
        HttpResponse.json(problem(404, "NOT_FOUND", "req-404"), {
          status: 404,
          headers: problemHeaders,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AreasScreen />);

    await user.click(
      await screen.findByRole("button", { name: "Bole, rename" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(t.nameLabel), " North");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    expect(
      await within(dialog).findByText(messages.Errors.NOT_FOUND),
    ).toBeInTheDocument();
    await waitFor(() => expect(listCalls).toBe(2));
  });
});

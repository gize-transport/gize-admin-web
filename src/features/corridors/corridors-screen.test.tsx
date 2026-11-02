import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
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
import { CorridorsScreen } from "./corridors-screen";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/corridors";
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
const t = messages.Corridors;
const tPicker = messages.AreaPicker;

startMswServer();

const at = "2026-10-31T21:30:00Z";

function area(name: string, index: number): Schemas["AreaRead"] {
  return {
    id: `00000000-0000-4000-a000-${String(index).padStart(12, "0")}`,
    name,
    created_at: at,
    updated_at: at,
  };
}
const bole = area("Bole", 1);
const piassa = area("Piassa", 2);
const mexico = area("Mexico", 3);
const allAreas = [bole, piassa, mexico];
const ref = ({ id, name }: Schemas["AreaRead"]): Schemas["AreaRef"] => ({
  id,
  name,
});

function corridor(
  origin: Schemas["AreaRead"],
  destination: Schemas["AreaRead"],
  index: number,
): Schemas["CorridorRead"] {
  return {
    id: `00000000-0000-4000-b000-${String(index).padStart(12, "0")}`,
    origin_area: ref(origin),
    destination_area: ref(destination),
    created_at: at,
    updated_at: at,
  };
}
const bolePiassa = corridor(bole, piassa, 1);
const piassaBole = corridor(piassa, bole, 2);

const pair = (c: Schemas["CorridorRead"]) => ({
  origin: c.origin_area.name,
  destination: c.destination_area.name,
});
const fill = (text: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    text,
  );

/** What screen readers hear for a row's button: "Edit {origin} to {destination}" (no arrow). */
const editName = (values: { origin: string; destination: string }) =>
  fill(
    t.rowName
      .replace(/<arrow>.*?<\/arrow>/, "")
      .replace(/<\/?spoken>/g, "")
      .replace(/\s+/g, " "),
    values,
  );

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

/** The areas list (for the pickers) and one area (for filters read from the URL). */
function serveAreas() {
  server.use(
    http.get(apiUrl("/v1/areas"), ({ request }) => {
      const q = new URL(request.url).searchParams.get("q") ?? "";
      return HttpResponse.json<Schemas["AreaPage"]>({
        items: allAreas.filter((a) =>
          a.name.toLowerCase().startsWith(q.toLowerCase()),
        ),
        next_cursor: null,
      });
    }),
    http.get(apiUrl("/v1/areas/{area_id}"), ({ params }) => {
      const found = allAreas.find((a) => a.id === params.area_id);
      return found
        ? HttpResponse.json<Schemas["AreaRead"]>(found)
        : HttpResponse.json(problem(404, "NOT_FOUND"), {
            status: 404,
            headers: problemHeaders,
          });
    }),
  );
}

function serveCorridors(
  items: Schemas["CorridorRead"][],
  seen?: URL[],
  nextCursor: string | null = null,
) {
  server.use(
    http.get(apiUrl("/v1/corridors"), ({ request }) => {
      seen?.push(new URL(request.url));
      return HttpResponse.json<Schemas["CorridorPage"]>({
        items,
        next_cursor: nextCursor,
      });
    }),
  );
}

/** Opens an area picker (by its label) and picks an area by typing its start. */
async function pick(
  user: UserEvent,
  container: HTMLElement,
  label: string,
  name: string,
) {
  await user.click(within(container).getByRole("combobox", { name: label }));
  await user.type(
    await screen.findByRole("combobox", { name: tPicker.searchLabel }),
    name.slice(0, 3),
  );
  await user.click(await screen.findByRole("option", { name }));
}

async function openAdd(user: UserEvent) {
  // The header's button (an empty list offers a second one).
  const [add] = screen.getAllByRole("button", { name: t.add });
  if (!add) throw new Error("no Add corridor button");
  await user.click(add);
  return screen.findByRole("dialog", { name: t.addTitle });
}

beforeEach(() => {
  navigation().search = "";
  navigation().push.mockClear();
  navigation().replace.mockClear();
  toast.mockClear();
  serveRole("staff");
  serveAreas();
});

describe("CorridorsScreen", () => {
  it("lists corridors with their direction and the date they were added", async () => {
    serveCorridors([bolePiassa, piassaBole]);
    renderWithProviders(<CorridorsScreen />);

    const table = await screen.findByRole("table", { name: t.tableLabel });
    const row = await within(table).findByRole("button", {
      name: editName({ origin: "Bole", destination: "Piassa" }),
    });
    // Seen with the arrow; heard as "Edit Bole to Piassa".
    expect(row).toHaveTextContent("Bole → to Piassa");
    expect(within(row).getByText("→")).toHaveAttribute("aria-hidden", "true");
    expect(
      within(table).getByRole("button", {
        name: editName({ origin: "Piassa", destination: "Bole" }),
      }),
    ).toBeVisible();
    // The button's name holds its visible text (WCAG 2.5.3), plus what it does.
    expect(
      within(table).getByRole("button", {
        name: editName(pair(bolePiassa)),
      }),
    ).toBeVisible();
    // 21:30 UTC on 31 October is 1 November in Addis Ababa.
    expect(within(table).getAllByText("Nov 1, 2026")).toHaveLength(2);
  });

  it("filters by the areas in the URL and shows their names", async () => {
    navigation().search = `?origin_area_id=${bole.id}&destination_area_id=${piassa.id}`;
    const seen: URL[] = [];
    serveCorridors([bolePiassa], seen);
    renderWithProviders(<CorridorsScreen />);

    await screen.findByRole("button", {
      name: editName({ origin: "Bole", destination: "Piassa" }),
    });
    expect(seen[0]?.searchParams.get("origin_area_id")).toBe(bole.id);
    expect(seen[0]?.searchParams.get("destination_area_id")).toBe(piassa.id);
    const filters = screen.getByRole("group", { name: t.filtersLabel });
    expect(
      await within(filters).findByRole("combobox", { name: t.originLabel }),
    ).toHaveTextContent("Bole");
    expect(
      await within(filters).findByRole("combobox", {
        name: t.destinationLabel,
      }),
    ).toHaveTextContent("Piassa");
  });

  it("says when an area in the URL no longer exists", async () => {
    navigation().search =
      "?origin_area_id=00000000-0000-4000-a000-000000000099";
    serveCorridors([]);
    renderWithProviders(<CorridorsScreen />);

    const filters = await screen.findByRole("group", { name: t.filtersLabel });
    expect(
      await within(filters).findByRole("combobox", { name: t.originLabel }),
    ).toHaveTextContent(t.unknownArea);
  });

  it("puts a picked origin in the URL", async () => {
    serveCorridors([bolePiassa, piassaBole]);
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);
    await screen.findByRole("button", {
      name: editName({ origin: "Bole", destination: "Piassa" }),
    });

    await pick(
      user,
      screen.getByRole("group", { name: t.filtersLabel }),
      t.originLabel,
      "Bole",
    );

    expect(navigation().push).toHaveBeenLastCalledWith(
      `/corridors?origin_area_id=${bole.id}`,
      { scroll: false },
    );
  });

  it("offers to clear both filters when nothing matches", async () => {
    navigation().search = `?origin_area_id=${mexico.id}&destination_area_id=${bole.id}`;
    serveCorridors([]);
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);

    expect(await screen.findByText(t.noMatchesTitle)).toBeVisible();
    await user.click(screen.getByRole("button", { name: t.clearFilters }));

    expect(navigation().push).toHaveBeenLastCalledWith("/corridors", {
      scroll: false,
    });
  });

  it("invites adding the first corridor when there are none", async () => {
    serveCorridors([]);
    renderWithProviders(<CorridorsScreen />);

    expect(await screen.findByText(t.emptyTitle)).toBeVisible();
  });

  it("pages with the API's cursor", async () => {
    const seen: URL[] = [];
    serveCorridors([bolePiassa], seen, "page-2");
    renderWithProviders(<CorridorsScreen />);

    const next = await screen.findByRole("link", {
      name: messages.DataTable.nextPage,
    });
    expect(next).toHaveAttribute("href", "/corridors?cursor=page-2");
    expect(seen[0]?.searchParams.get("limit")).toBe("25");
  });

  it("shows a failed load with its reference and a retry", async () => {
    server.use(
      http.get(apiUrl("/v1/corridors"), () =>
        HttpResponse.json(problem(500, "INTERNAL_ERROR", "req-500"), {
          status: 500,
          headers: problemHeaders,
        }),
      ),
    );
    renderWithProviders(<CorridorsScreen />);

    expect(
      await screen.findByText(messages.Errors.INTERNAL_ERROR),
    ).toBeVisible();
    expect(screen.getByText("req-500")).toBeVisible();
    expect(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    ).toBeVisible();
  });

  it("shows NoPermission when the API says this role can't list corridors", async () => {
    server.use(
      http.get(apiUrl("/v1/corridors"), () =>
        HttpResponse.json(problem(403, "FORBIDDEN"), {
          status: 403,
          headers: problemHeaders,
        }),
      ),
    );
    renderWithProviders(<CorridorsScreen />);

    expect(
      await screen.findByText(messages.NoPermission.title),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.add })).toBeNull();
  });

  it("adds a corridor with one Idempotency-Key, reused on retry", async () => {
    serveCorridors([piassaBole]);
    const keys: (string | null)[] = [];
    const bodies: Schemas["CorridorCreate"][] = [];
    let fail = true;
    server.use(
      http.post(apiUrl("/v1/corridors"), async ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        bodies.push((await request.json()) as Schemas["CorridorCreate"]);
        if (fail) {
          fail = false;
          return HttpResponse.json(problem(503, "SERVICE_UNAVAILABLE"), {
            status: 503,
            headers: problemHeaders,
          });
        }
        return HttpResponse.json<Schemas["CorridorRead"]>(bolePiassa, {
          status: 201,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);
    await screen.findByRole("button", {
      name: editName({ origin: "Piassa", destination: "Bole" }),
    });

    const dialog = await openAdd(user);
    await pick(user, dialog, t.originLabel, "Bole");
    await pick(user, dialog, t.destinationLabel, "Piassa");
    await user.click(within(dialog).getByRole("button", { name: t.save }));
    expect(
      await within(dialog).findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(fill(t.added, pair(bolePiassa))),
    );
    expect(bodies[0]).toEqual({
      origin_area_id: bole.id,
      destination_area_id: piassa.id,
    });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // A new add is a new action: a new key.
    const again = await openAdd(user);
    await pick(user, again, t.originLabel, "Mexico");
    await pick(user, again, t.destinationLabel, "Bole");
    await user.click(within(again).getByRole("button", { name: t.save }));
    await waitFor(() => expect(keys).toHaveLength(3));
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("asks for both areas, and two different ones, before sending", async () => {
    serveCorridors([]);
    let posted = false;
    server.use(
      http.post(apiUrl("/v1/corridors"), () => {
        posted = true;
        return HttpResponse.json(problem(500, "INTERNAL_ERROR"), {
          status: 500,
          headers: problemHeaders,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);
    await screen.findByText(t.emptyTitle);

    const dialog = await openAdd(user);
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    const origin = within(dialog).getByRole("combobox", {
      name: t.originLabel,
    });
    expect(await within(dialog).findByText(t.originRequired)).toBeVisible();
    expect(within(dialog).getByText(t.destinationRequired)).toBeVisible();
    await waitFor(() => expect(origin).toHaveFocus());

    await pick(user, dialog, t.originLabel, "Bole");
    await pick(user, dialog, t.destinationLabel, "Bole");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    const destination = within(dialog).getByRole("combobox", {
      name: t.destinationLabel,
    });
    await waitFor(() =>
      expect(destination).toHaveAccessibleDescription(t.sameArea),
    );
    expect(destination).toHaveAttribute("aria-invalid", "true");
    expect(posted).toBe(false);
  });

  it("explains a corridor that already exists, by name", async () => {
    serveCorridors([bolePiassa]);
    server.use(
      http.post(apiUrl("/v1/corridors"), () =>
        HttpResponse.json(problem(409, "CORRIDOR_EXISTS", "req-409"), {
          status: 409,
          headers: problemHeaders,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);
    await screen.findByRole("button", {
      name: editName({ origin: "Bole", destination: "Piassa" }),
    });

    const dialog = await openAdd(user);
    await pick(user, dialog, t.originLabel, "Bole");
    await pick(user, dialog, t.destinationLabel, "Piassa");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    expect(
      await within(dialog).findByText(fill(t.exists, pair(bolePiassa))),
    ).toBeVisible();
    expect(within(dialog).getByText("req-409")).toBeVisible();
  });

  it("puts an area the API doesn't know on its picker and focuses it", async () => {
    serveCorridors([]);
    server.use(
      http.post(apiUrl("/v1/corridors"), () =>
        HttpResponse.json<Schemas["ValidationProblem"]>(
          {
            type: "about:blank",
            title: "VALIDATION_FAILED",
            status: 422,
            code: "VALIDATION_FAILED",
            request_id: "req-422",
            errors: [
              {
                location: "body",
                field: "/destination_area_id",
                reason: "invalid",
              },
            ],
            errors_truncated: false,
          },
          { status: 422, headers: problemHeaders },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);
    await screen.findByText(t.emptyTitle);

    const dialog = await openAdd(user);
    await pick(user, dialog, t.originLabel, "Bole");
    await pick(user, dialog, t.destinationLabel, "Piassa");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    const destination = within(dialog).getByRole("combobox", {
      name: t.destinationLabel,
    });
    await waitFor(() =>
      expect(destination).toHaveAttribute("aria-invalid", "true"),
    );
    expect(destination).toHaveAccessibleDescription(
      messages.ValidationReasons.invalid,
    );
    expect(destination).toHaveFocus();
  });

  it("keeps Save disabled while sending and until Retry-After has passed", async () => {
    serveCorridors([]);
    let release = () => {};
    server.use(
      http.post(apiUrl("/v1/corridors"), async () => {
        await new Promise<void>((resolve) => (release = resolve));
        return HttpResponse.json(problem(429, "RATE_LIMITED", "req-429"), {
          status: 429,
          headers: { ...problemHeaders, "Retry-After": "1" },
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);
    await screen.findByText(t.emptyTitle);

    const dialog = await openAdd(user);
    await pick(user, dialog, t.originLabel, "Bole");
    await pick(user, dialog, t.destinationLabel, "Piassa");
    const save = within(dialog).getByRole("button", { name: t.save });
    await user.click(save);

    await waitFor(() => expect(save).toHaveAttribute("aria-busy", "true"));
    expect(save).toHaveAttribute("aria-disabled", "true");
    release();
    expect(
      await within(dialog).findByText(messages.Errors.RATE_LIMITED),
    ).toBeVisible();
    expect(save).toHaveAttribute("aria-disabled", "true");
    await waitFor(() => expect(save).not.toHaveAttribute("aria-disabled"), {
      timeout: 2500,
    });
  });

  it("changes a corridor's destination, sending only that end", async () => {
    serveCorridors([bolePiassa]);
    let sent: Schemas["CorridorUpdate"] | undefined;
    server.use(
      http.patch(apiUrl("/v1/corridors/{corridor_id}"), async ({ request }) => {
        sent = (await request.json()) as Schemas["CorridorUpdate"];
        return HttpResponse.json<Schemas["CorridorRead"]>({
          ...bolePiassa,
          destination_area: ref(mexico),
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);

    await user.click(
      await screen.findByRole("button", {
        name: editName(pair(bolePiassa)),
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: fill(t.editTitle, pair(bolePiassa)),
    });
    expect(
      within(dialog).getByRole("combobox", { name: t.originLabel }),
    ).toHaveTextContent("Bole");
    await pick(user, dialog, t.destinationLabel, "Mexico");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        fill(t.changed, { origin: "Bole", destination: "Mexico" }),
      ),
    );
    expect(sent).toEqual({ destination_area_id: mexico.id });
  });

  it("closes without a request when nothing was changed", async () => {
    serveCorridors([bolePiassa]);
    let patched = false;
    server.use(
      http.patch(apiUrl("/v1/corridors/{corridor_id}"), () => {
        patched = true;
        return HttpResponse.json<Schemas["CorridorRead"]>(bolePiassa);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);

    await user.click(
      await screen.findByRole("button", {
        name: editName(pair(bolePiassa)),
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(patched).toBe(false);
    expect(toast).not.toHaveBeenCalled();
  });

  it("explains why a corridor with a route can't change", async () => {
    serveCorridors([bolePiassa]);
    server.use(
      http.patch(apiUrl("/v1/corridors/{corridor_id}"), () =>
        HttpResponse.json(problem(409, "CORRIDOR_IN_USE", "req-in-use"), {
          status: 409,
          headers: problemHeaders,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);

    await user.click(
      await screen.findByRole("button", {
        name: editName(pair(bolePiassa)),
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await pick(user, dialog, t.destinationLabel, "Mexico");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    expect(await within(dialog).findByText(t.inUseEdit)).toBeVisible();
    expect(within(dialog).getByText("req-in-use")).toBeVisible();
  });

  it("refreshes the list when the corridor was deleted by someone else", async () => {
    let listCalls = 0;
    server.use(
      http.get(apiUrl("/v1/corridors"), () => {
        listCalls += 1;
        return HttpResponse.json<Schemas["CorridorPage"]>({
          items: [bolePiassa],
          next_cursor: null,
        });
      }),
      http.patch(apiUrl("/v1/corridors/{corridor_id}"), () =>
        HttpResponse.json(problem(404, "NOT_FOUND"), {
          status: 404,
          headers: problemHeaders,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);

    await user.click(
      await screen.findByRole("button", {
        name: editName(pair(bolePiassa)),
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await pick(user, dialog, t.destinationLabel, "Mexico");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    expect(
      await within(dialog).findByText(messages.Errors.NOT_FOUND),
    ).toBeVisible();
    await waitFor(() => expect(listCalls).toBe(2));
  });

  it("offers Delete to admins only", async () => {
    serveCorridors([bolePiassa]);
    const { queryClient } = renderWithProviders(<CorridorsScreen />);
    await screen.findByRole("button", {
      name: editName({ origin: "Bole", destination: "Piassa" }),
    });
    await waitFor(() =>
      expect(queryClient.getQueryState(currentStaffQueryKey)?.status).toBe(
        "success",
      ),
    );

    expect(screen.queryByRole("button", { name: /^Delete / })).toBeNull();
  });

  it("lets an admin delete a corridor, after confirming", async () => {
    serveRole("admin");
    serveCorridors([bolePiassa]);
    let deleted: string | undefined;
    server.use(
      http.delete(apiUrl("/v1/corridors/{corridor_id}"), ({ params }) => {
        deleted = String(params.corridor_id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);

    await user.click(
      await screen.findByRole("button", {
        name: fill(t.deleteLabel, pair(bolePiassa)),
      }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: fill(t.deleteTitle, pair(bolePiassa)),
    });
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(fill(t.deleted, pair(bolePiassa))),
    );
    expect(deleted).toBe(bolePiassa.id);
  });

  it("explains why a corridor with a route can't be deleted, and starts clean next time", async () => {
    serveRole("admin");
    serveCorridors([bolePiassa]);
    server.use(
      http.delete(apiUrl("/v1/corridors/{corridor_id}"), () =>
        HttpResponse.json(problem(409, "CORRIDOR_IN_USE", "req-in-use"), {
          status: 409,
          headers: problemHeaders,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);
    const deleteButton = await screen.findByRole("button", {
      name: fill(t.deleteLabel, pair(bolePiassa)),
    });

    await user.click(deleteButton);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    expect(await within(dialog).findByText(t.inUseDelete)).toBeVisible();
    expect(within(dialog).getByText("req-in-use")).toBeVisible();
    expect(toast).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole("button", { name: messages.Common.cancel }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await user.click(deleteButton);
    const again = await screen.findByRole("alertdialog");
    expect(within(again).queryByText(t.inUseDelete)).toBeNull();
  });

  it("explains a delete the API refuses for this role", async () => {
    serveRole("admin");
    serveCorridors([bolePiassa]);
    server.use(
      http.delete(apiUrl("/v1/corridors/{corridor_id}"), () =>
        HttpResponse.json(problem(403, "FORBIDDEN", "req-403"), {
          status: 403,
          headers: problemHeaders,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);

    await user.click(
      await screen.findByRole("button", {
        name: fill(t.deleteLabel, pair(bolePiassa)),
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    expect(
      await within(dialog).findByText(messages.Errors.FORBIDDEN),
    ).toBeVisible();
    expect(within(dialog).getByText("req-403")).toBeVisible();
  });
  it("treats a filter the API can't read as no matches, with a way out", async () => {
    navigation().search = "?origin_area_id=not-an-id";
    server.use(
      http.get(apiUrl("/v1/corridors"), () =>
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
                field: "/origin_area_id",
                reason: "invalid_format",
              },
            ],
            errors_truncated: false,
          },
          { status: 422, headers: problemHeaders },
        ),
      ),
    );
    renderWithProviders(<CorridorsScreen />);

    expect(await screen.findByText(t.noMatchesTitle)).toBeVisible();
    expect(screen.getByRole("button", { name: t.clearFilters })).toBeVisible();
    expect(screen.queryByText(messages.Errors.VALIDATION_FAILED)).toBeNull();
  });

  it("says when a filter's area name can't be loaded", async () => {
    navigation().search = `?origin_area_id=${bole.id}`;
    serveCorridors([bolePiassa]);
    server.use(
      http.get(apiUrl("/v1/areas/{area_id}"), () =>
        HttpResponse.json(problem(503, "SERVICE_UNAVAILABLE"), {
          status: 503,
          headers: problemHeaders,
        }),
      ),
    );
    renderWithProviders(<CorridorsScreen />);

    const filters = await screen.findByRole("group", { name: t.filtersLabel });
    expect(
      await within(filters).findByRole("combobox", { name: t.originLabel }),
    ).toHaveTextContent(t.areaUnavailable);
  });

  it("sends both ends when both change", async () => {
    serveCorridors([bolePiassa]);
    let sent: Schemas["CorridorUpdate"] | undefined;
    server.use(
      http.patch(apiUrl("/v1/corridors/{corridor_id}"), async ({ request }) => {
        sent = (await request.json()) as Schemas["CorridorUpdate"];
        return HttpResponse.json<Schemas["CorridorRead"]>({
          ...bolePiassa,
          origin_area: ref(mexico),
          destination_area: ref(bole),
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);

    await user.click(
      await screen.findByRole("button", { name: editName(pair(bolePiassa)) }),
    );
    const dialog = await screen.findByRole("dialog");
    await pick(user, dialog, t.originLabel, "Mexico");
    await pick(user, dialog, t.destinationLabel, "Bole");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    await waitFor(() =>
      expect(sent).toEqual({
        origin_area_id: mexico.id,
        destination_area_id: bole.id,
      }),
    );
  });

  it("checks the destination again when the origin changes", async () => {
    serveCorridors([]);
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);
    await screen.findByText(t.emptyTitle);

    const dialog = await openAdd(user);
    await pick(user, dialog, t.originLabel, "Bole");
    await pick(user, dialog, t.destinationLabel, "Bole");
    await user.click(within(dialog).getByRole("button", { name: t.save }));
    expect(await within(dialog).findByText(t.sameArea)).toBeVisible();

    await pick(user, dialog, t.originLabel, "Piassa");

    await waitFor(() =>
      expect(within(dialog).queryByText(t.sameArea)).toBeNull(),
    );
    expect(
      within(dialog).getByRole("combobox", { name: t.destinationLabel }),
    ).not.toHaveAttribute("aria-invalid");
  });

  it("explains an add the API refuses for this role", async () => {
    serveCorridors([]);
    server.use(
      http.post(apiUrl("/v1/corridors"), () =>
        HttpResponse.json(problem(403, "FORBIDDEN", "req-403"), {
          status: 403,
          headers: problemHeaders,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CorridorsScreen />);
    await screen.findByText(t.emptyTitle);

    const dialog = await openAdd(user);
    await pick(user, dialog, t.originLabel, "Bole");
    await pick(user, dialog, t.destinationLabel, "Piassa");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    expect(
      await within(dialog).findByText(messages.Errors.FORBIDDEN),
    ).toBeVisible();
    expect(within(dialog).getByText("req-403")).toBeVisible();
  });

  it("moves focus to the page content when the button that opened the form is gone", async () => {
    let items: Schemas["CorridorRead"][] = [];
    server.use(
      http.get(apiUrl("/v1/corridors"), () =>
        HttpResponse.json<Schemas["CorridorPage"]>({
          items,
          next_cursor: null,
        }),
      ),
      http.post(apiUrl("/v1/corridors"), () => {
        items = [bolePiassa];
        return HttpResponse.json<Schemas["CorridorRead"]>(bolePiassa, {
          status: 201,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <main id="content" tabIndex={-1}>
        <CorridorsScreen />
      </main>,
    );
    await screen.findByText(t.emptyTitle);

    // The empty state's button: once the corridor is added, the table replaces it.
    const buttons = screen.getAllByRole("button", { name: t.add });
    const emptyStateAdd = buttons.at(-1);
    if (!emptyStateAdd) throw new Error("no empty-state button");
    await user.click(emptyStateAdd);
    const dialog = await screen.findByRole("dialog", { name: t.addTitle });
    await pick(user, dialog, t.originLabel, "Bole");
    await pick(user, dialog, t.destinationLabel, "Piassa");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(emptyStateAdd.isConnected).toBe(false);
    await waitFor(() =>
      expect(document.getElementById("content")).toHaveFocus(),
    );
  });
});

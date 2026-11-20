import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import {
  apiUrl,
  problemHeaders,
  server,
  type Schemas,
} from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { useRoute, useRoutes } from "./queries";
import { RouteDriver } from "./route-driver";
import {
  fill,
  problemResponse,
  route,
  serveRole,
  serveRoute,
} from "./test-support";

vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.Routes;
const tPicker = messages.DriverPicker;

startMswServer();

beforeEach(() => {
  toast.mockClear();
  serveRole("staff");
});

const at = "2026-11-05T07:30:00Z";
function driver(
  name: string,
  index: number,
  plate: string,
): Schemas["DriverRead"] {
  return {
    id: `00000000-0000-4000-9900-${String(index).padStart(12, "0")}`,
    full_name: name,
    phone: `+2519110003${String(index).padStart(2, "0")}`,
    address: "Bole",
    plate,
    is_active: true,
    created_at: at,
    updated_at: at,
  };
}
const bereket = driver("Bereket Tolosa", 1, "AA 3-B12341");
const fikru = driver("Fikru Hailu", 3, "AA 2-A54321");

const withoutDriver = route("B-07", 7, { status: "active" });
const driven = route("B-07", 7, {
  status: "active",
  driver: {
    id: bereket.id,
    full_name: bereket.full_name,
    plate: bereket.plate,
  },
});

/** The active drivers the picker searches (`drivers_list`); returns what it asked. */
function serveDrivers(items: Schemas["DriverRead"][]) {
  const seen: URL[] = [];
  server.use(
    http.get(apiUrl("/v1/drivers"), ({ request }) => {
      const url = new URL(request.url);
      seen.push(url);
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      return HttpResponse.json<Schemas["DriverPage"]>({
        items: items.filter((d) => d.full_name.toLowerCase().startsWith(q)),
        next_cursor: null,
      });
    }),
  );
  return seen;
}

/** Answers PUT /driver; returns the bodies sent. */
function serveSetDriver(answer: (body: Schemas["RouteDriverSet"]) => Response) {
  const sent: Schemas["RouteDriverSet"][] = [];
  server.use(
    http.put(apiUrl("/v1/routes/{route_id}/driver"), async ({ request }) => {
      const body = (await request.json()) as Schemas["RouteDriverSet"];
      sent.push(body);
      return answer(body);
    }),
  );
  return sent;
}

const option = (d: Schemas["DriverRead"]) => `${d.full_name} · ${d.plate}`;

async function chooseIn(
  user: UserEvent,
  dialog: HTMLElement,
  d: Schemas["DriverRead"],
) {
  await user.click(
    within(dialog).getByRole("combobox", { name: t.driverLabel }),
  );
  await user.type(
    await screen.findByRole("combobox", { name: tPicker.searchLabel }),
    d.full_name.slice(0, 3),
  );
  await user.click(await screen.findByRole("option", { name: option(d) }));
}

/**
 * The route as the page reads it: from the query cache, so a change shows at once, with the
 * routes list beside it (a change refetches it, which takes a moment).
 */
function FromCache({ id }: { id: string }) {
  const found = useRoute(id);
  useRoutes({
    q: null,
    routeType: null,
    status: null,
    corridorId: null,
    companyId: null,
    sort: null,
    cursor: null,
  });
  return found.data ? <RouteDriver route={found.data} /> : null;
}

describe("RouteDriver", () => {
  it("shows the route's driver with their plate, linked to them", () => {
    renderWithProviders(<RouteDriver route={driven} />);

    expect(
      screen.getByRole("link", { name: "Bereket Tolosa" }),
    ).toHaveAttribute("href", `/drivers/${bereket.id}`);
    expect(screen.getByText("AA 3-B12341")).toBeVisible();
    expect(screen.getByRole("button", { name: t.changeDriver })).toBeVisible();
    expect(screen.getByRole("button", { name: t.removeDriver })).toBeVisible();
  });

  it("says when the route has no driver, offering to choose one", () => {
    renderWithProviders(<RouteDriver route={withoutDriver} />);

    expect(screen.getByText(t.driverNone)).toBeVisible();
    expect(screen.getByRole("button", { name: t.chooseDriver })).toBeVisible();
    expect(screen.queryByRole("button", { name: t.removeDriver })).toBeNull();
  });

  it("chooses an active driver for the route", async () => {
    const seen = serveDrivers([bereket, fikru]);
    const sent = serveSetDriver(() =>
      HttpResponse.json<Schemas["RouteRead"]>(driven),
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteDriver route={withoutDriver} />);

    await user.click(screen.getByRole("button", { name: t.chooseDriver }));
    const dialog = await screen.findByRole("dialog", {
      name: fill(t.driverTitle, { code: "B-07" }),
    });
    await chooseIn(user, dialog, bereket);
    // Only active drivers are offered.
    expect(seen.at(-1)?.searchParams.get("is_active")).toBe("true");
    // A to Z.
    expect(seen.at(-1)?.searchParams.get("sort")).toBe("name");
    await user.click(
      within(dialog).getByRole("button", { name: t.driverSave }),
    );

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.driverSavedToast));
    expect(sent).toEqual([{ driver_id: bereket.id }]);
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("asks for a driver before sending", async () => {
    serveDrivers([bereket]);
    const sent = serveSetDriver(() => HttpResponse.json(driven));
    const user = userEvent.setup();
    renderWithProviders(<RouteDriver route={withoutDriver} />);

    await user.click(screen.getByRole("button", { name: t.chooseDriver }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: t.driverSave }),
    );

    const picker = within(dialog).getByRole("combobox", {
      name: t.driverLabel,
    });
    expect(picker).toHaveAccessibleDescription(
      expect.stringContaining(t.driverRequired),
    );
    expect(picker).toHaveFocus();
    expect(sent).toHaveLength(0);
  });

  it("explains a driver whose times clash with another of their routes, on the picker", async () => {
    serveDrivers([bereket, fikru]);
    serveSetDriver(() => problemResponse(409, "DRIVER_BUSY", "req-busy"));
    const user = userEvent.setup();
    renderWithProviders(<RouteDriver route={driven} />);

    await user.click(screen.getByRole("button", { name: t.changeDriver }));
    const dialog = await screen.findByRole("dialog");
    await chooseIn(user, dialog, fikru);
    await user.click(
      within(dialog).getByRole("button", { name: t.driverSave }),
    );

    const picker = within(dialog).getByRole("combobox", {
      name: t.driverLabel,
    });
    await waitFor(() =>
      expect(picker).toHaveAccessibleDescription(
        expect.stringContaining(fill(t.driverBusy, { name: "Fikru Hailu" })),
      ),
    );
    expect(picker).toHaveFocus();
    expect(picker).toHaveAttribute("aria-invalid", "true");
    expect(toast).not.toHaveBeenCalled();
  });

  it("explains a driver who can no longer be chosen, and searches afresh", async () => {
    const seen = serveDrivers([bereket, fikru]);
    serveSetDriver(() =>
      HttpResponse.json(
        {
          type: "about:blank",
          title: "VALIDATION_FAILED",
          status: 422,
          code: "VALIDATION_FAILED",
          request_id: "req-422",
          errors: [
            { location: "body", field: "/driver_id", reason: "invalid" },
          ],
          errors_truncated: false,
        },
        { status: 422, headers: problemHeaders },
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteDriver route={withoutDriver} />);

    await user.click(screen.getByRole("button", { name: t.chooseDriver }));
    const dialog = await screen.findByRole("dialog");
    await chooseIn(user, dialog, fikru);
    const reads = seen.length;
    await user.click(
      within(dialog).getByRole("button", { name: t.driverSave }),
    );

    const picker = within(dialog).getByRole("combobox", {
      name: t.driverLabel,
    });
    await waitFor(() =>
      expect(picker).toHaveAccessibleDescription(
        expect.stringContaining(t.driverUnavailable),
      ),
    );
    // The choice is cleared; the next search reads the drivers again.
    expect(picker).toHaveTextContent(tPicker.placeholder);
    await user.click(picker);
    await user.type(
      await screen.findByRole("combobox", { name: tPicker.searchLabel }),
      "Fik",
    );
    await waitFor(() => expect(seen.length).toBeGreaterThan(reads));
  });

  it("keeps Save disabled until Retry-After has passed", async () => {
    serveDrivers([bereket]);
    serveSetDriver(() =>
      problemResponse(429, "RATE_LIMITED", "req-429", { "Retry-After": "30" }),
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteDriver route={withoutDriver} />);

    await user.click(screen.getByRole("button", { name: t.chooseDriver }));
    const dialog = await screen.findByRole("dialog");
    await chooseIn(user, dialog, bereket);
    await user.click(
      within(dialog).getByRole("button", { name: t.driverSave }),
    );

    expect(await within(dialog).findByText("req-429")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: t.driverSave }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("removes the driver after confirming", async () => {
    const sent = serveSetDriver(() => HttpResponse.json(withoutDriver));
    const user = userEvent.setup();
    renderWithProviders(<RouteDriver route={driven} />);

    await user.click(screen.getByRole("button", { name: t.removeDriver }));
    const dialog = await screen.findByRole("alertdialog", {
      name: fill(t.removeDriverTitle, { name: "Bereket Tolosa", code: "B-07" }),
    });
    expect(dialog).toHaveTextContent(t.removeDriverDescription);
    await user.click(
      within(dialog).getByRole("button", { name: t.removeDriver }),
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(t.driverRemovedToast),
    );
    expect(sent).toEqual([{ driver_id: null }]);
  });

  it("shows a refused removal with its reference", async () => {
    serveSetDriver(() =>
      problemResponse(503, "SERVICE_UNAVAILABLE", "req-503"),
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteDriver route={driven} />);

    await user.click(screen.getByRole("button", { name: t.removeDriver }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: t.removeDriver }),
    );
    expect(await within(dialog).findByText("req-503")).toBeVisible();
  });

  it("removes the driver of a route read from the cache: toast, then focus on Choose driver", async () => {
    serveRoute(driven);
    server.use(
      http.get(apiUrl("/v1/routes"), async () => {
        await delay(200);
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );
    serveSetDriver(() => HttpResponse.json(withoutDriver));
    const user = userEvent.setup();
    renderWithProviders(<FromCache id={driven.id} />);

    await user.click(
      await screen.findByRole("button", { name: t.removeDriver }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: t.removeDriver }),
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(t.driverRemovedToast),
    );
    expect(await screen.findByText(t.driverNone)).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: t.chooseDriver }),
      ).toHaveFocus(),
    );
  });

  it("keeps Remove disabled until Retry-After has passed", async () => {
    serveSetDriver(() =>
      problemResponse(429, "RATE_LIMITED", "req-429", { "Retry-After": "30" }),
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteDriver route={driven} />);

    await user.click(screen.getByRole("button", { name: t.removeDriver }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: t.removeDriver }),
    );
    expect(await within(dialog).findByText("req-429")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: t.removeDriver }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it.each([
    [403, "FORBIDDEN", messages.Errors.FORBIDDEN],
    [404, "NOT_FOUND", messages.Errors.NOT_FOUND],
  ] as const)(
    "explains a %s when choosing, with its reference",
    async (status, code, words) => {
      serveDrivers([bereket]);
      serveSetDriver(() => problemResponse(status, code, `req-${status}`));
      const user = userEvent.setup();
      renderWithProviders(<RouteDriver route={withoutDriver} />);

      await user.click(screen.getByRole("button", { name: t.chooseDriver }));
      const dialog = await screen.findByRole("dialog");
      await chooseIn(user, dialog, bereket);
      await user.click(
        within(dialog).getByRole("button", { name: t.driverSave }),
      );

      expect(await within(dialog).findByText(words)).toBeVisible();
      expect(within(dialog).getByText(`req-${status}`)).toBeVisible();
      expect(toast).not.toHaveBeenCalled();
    },
  );
});

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import {
  actionItems,
  actionsButton,
  chooseAction,
} from "../../../tests/utils/actions";
import { renderWithProviders } from "../../../tests/utils/render";
import { currentStaffQueryKey } from "@/lib/auth/use-current-staff";
import { route } from "../routes/test-support";
import { DriverDetail } from "./driver-detail";
import {
  bereket,
  fill,
  problemResponse,
  sara,
  serveDriver,
  serveRole,
} from "./test-support";

vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/drivers";
  return mockNavigation(state);
});
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.Drivers;

startMswServer();

beforeEach(() => {
  toast.mockClear();
  serveRole("staff");
  serveTheirRoutes(() => []);
});

const b07 = route("B-07", 7, { status: "active" });
const r21 = route("R-21", 21, { status: "draft" });

/** The routes `driver_id` drives, as `routes()` says at each call; records the filters sent. */
function serveTheirRoutes(routes: () => Schemas["RouteRead"][], seen?: URL[]) {
  server.use(
    http.get(apiUrl("/v1/routes"), ({ request }) => {
      seen?.push(new URL(request.url));
      return HttpResponse.json<Schemas["RoutePage"]>({
        items: routes(),
        next_cursor: null,
      });
    }),
  );
}

function renderDetail(
  found: Schemas["DriverRead"],
  props: Partial<Parameters<typeof DriverDetail>[0]> = {},
) {
  return renderWithProviders(
    <DriverDetail driverId={found.id} variant="page" {...props} />,
  );
}

/** Answers PATCH with the driver changed as asked; returns what was sent. */
function servePatch(found: Schemas["DriverRead"]) {
  const sent: Schemas["DriverUpdate"][] = [];
  server.use(
    http.patch(apiUrl("/v1/drivers/{driver_id}"), async ({ request }) => {
      const change = (await request.json()) as Schemas["DriverUpdate"];
      sent.push(change);
      // Read again afterwards: changed.
      serveDriver({ ...found, ...change });
      return HttpResponse.json<Schemas["DriverRead"]>({ ...found, ...change });
    }),
  );
  return sent;
}

describe("DriverDetail", () => {
  it("shows the driver's phone, address, plate, status and dates", async () => {
    serveDriver(sara);
    renderDetail(sara);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Sara Mohammed" }),
    ).toBeVisible();
    const facts = screen.getByRole("group", { name: t.detailLabel });
    const fact = (label: string) =>
      within(facts).getByText(label).nextElementSibling;
    expect(fact(t.phone)).toHaveTextContent("+251911000202");
    expect(fact(t.address)).toHaveTextContent("Megenagna");
    expect(fact(t.plate)).toHaveTextContent("AA 3-B12342");
    // The status sits beside the name.
    expect(screen.getByText(t.inactive)).toBeVisible();
    expect(fact(t.added)).toHaveTextContent("Nov 5, 2026");
    expect(fact(t.updated)).toHaveTextContent("Nov 8, 2026");
    await waitFor(() => expect(fact(t.routes)).toHaveTextContent(t.routesNone));
  });

  it("lists the routes they drive, each linked, with its status", async () => {
    const seen: URL[] = [];
    serveDriver(bereket);
    serveTheirRoutes(() => [b07, r21], seen);
    renderDetail(bereket);

    const facts = await screen.findByRole("group", { name: t.detailLabel });
    expect(
      await within(facts).findByRole("link", { name: "B-07" }),
    ).toHaveAttribute("href", `/routes/${b07.id}`);
    expect(within(facts).getByRole("link", { name: "R-21" })).toHaveAttribute(
      "href",
      `/routes/${r21.id}`,
    );
    expect(within(facts).getByText(messages.RouteStatus.draft)).toBeVisible();
    expect(seen[0]?.searchParams.get("driver_id")).toBe(bereket.id);
  });

  it("says when their routes couldn't be loaded, with a retry", async () => {
    let fail = true;
    serveDriver(bereket);
    server.use(
      http.get(apiUrl("/v1/routes"), () => {
        if (fail) {
          fail = false;
          return problemResponse(503, "SERVICE_UNAVAILABLE");
        }
        return HttpResponse.json<Schemas["RoutePage"]>({
          items: [b07],
          next_cursor: null,
        });
      }),
    );
    const user = userEvent.setup();
    renderDetail(bereket);

    expect(await screen.findByText(t.routesError)).toBeVisible();
    await user.click(screen.getByRole("button", { name: t.routesRetry }));
    expect(await screen.findByRole("link", { name: "B-07" })).toBeVisible();
  });

  it("explains a driver that no longer exists", async () => {
    serveDriver(bereket);
    renderDetail(sara);

    expect(await screen.findByText(t.notFoundTitle)).toBeVisible();
  });

  it("shows a failed load with its reference and a retry", async () => {
    let fail = true;
    server.use(
      http.get(apiUrl("/v1/drivers/{driver_id}"), () => {
        if (fail) {
          fail = false;
          return problemResponse(503, "SERVICE_UNAVAILABLE", "req-503");
        }
        return HttpResponse.json(bereket);
      }),
    );
    const user = userEvent.setup();
    renderDetail(bereket);

    expect(await screen.findByText("req-503")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    );
    expect(
      await screen.findByRole("heading", { name: "Bereket Tolosa" }),
    ).toBeVisible();
  });

  it("shows NoPermission when the API refuses this role", async () => {
    server.use(
      http.get(apiUrl("/v1/drivers/{driver_id}"), () =>
        problemResponse(403, "FORBIDDEN"),
      ),
    );
    renderDetail(bereket);

    expect(await screen.findByText(messages.NoPermission.title)).toBeVisible();
  });

  it("deactivates the driver after confirming, without their name in the toast", async () => {
    serveDriver(bereket);
    const sent = servePatch(bereket);
    const user = userEvent.setup();
    renderDetail(bereket);

    await chooseAction(user, t.deactivate);
    const dialog = await screen.findByRole("alertdialog", {
      name: fill(t.deactivateTitle, { name: "Bereket Tolosa" }),
    });
    expect(dialog).toHaveTextContent(t.deactivateDescription);
    await user.click(
      within(dialog).getByRole("button", { name: t.deactivate }),
    );

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.deactivatedToast));
    expect(sent).toEqual([{ is_active: false }]);
    // Now inactive: the closing dialog keeps saying what it did, never the opposite move.
    expect(
      screen.queryByRole("alertdialog", {
        name: fill(t.reactivateTitle, { name: "Bereket Tolosa" }),
      }),
    ).toBeNull();
  });

  it("names the routes a driver drives when they can't be deactivated, read again", async () => {
    serveDriver(bereket);
    // Given B-07 and R-21 after the page loaded.
    let given = false;
    serveTheirRoutes(() => (given ? [b07, r21] : []));
    server.use(
      http.patch(apiUrl("/v1/drivers/{driver_id}"), () =>
        problemResponse(409, "DRIVER_ASSIGNED", "req-assigned"),
      ),
    );
    const user = userEvent.setup();
    renderDetail(bereket);

    await chooseAction(user, t.deactivate);
    const dialog = await screen.findByRole("alertdialog");
    given = true;
    await user.click(
      within(dialog).getByRole("button", { name: t.deactivate }),
    );

    expect(
      await within(dialog).findByText(
        "They drive B-07 and R-21, so they can't be deactivated. Give those routes another driver, or none, first.",
      ),
    ).toBeVisible();
    expect(within(dialog).getByText("req-assigned")).toBeVisible();
    expect(
      within(dialog).getByRole("link", { name: "Open B-07" }),
    ).toHaveAttribute("href", `/routes/${b07.id}`);
    expect(
      within(dialog).getByRole("link", { name: "Open R-21" }),
    ).toHaveAttribute("href", `/routes/${r21.id}`);
    expect(toast).not.toHaveBeenCalled();
  });

  it("reactivates an inactive driver after confirming", async () => {
    serveDriver(sara);
    const sent = servePatch(sara);
    const user = userEvent.setup();
    renderDetail(sara);

    expect(
      await screen.findByRole("button", { name: t.reactivate }),
    ).toBeVisible();
    expect(await actionItems(user)).not.toContain(t.deactivate);
    await user.click(screen.getByRole("button", { name: t.reactivate }));
    const dialog = await screen.findByRole("alertdialog", {
      name: fill(t.reactivateTitle, { name: "Sara Mohammed" }),
    });
    await user.click(
      within(dialog).getByRole("button", { name: t.reactivate }),
    );

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.reactivatedToast));
    expect(sent).toEqual([{ is_active: true }]);
    // Its button goes away: focus moves to the actions beside it.
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.queryByRole("button", { name: t.reactivate })).toBeNull();
    expect(actionsButton()).toHaveFocus();
  });

  it("keeps a status change disabled until Retry-After has passed", async () => {
    serveDriver(bereket);
    server.use(
      http.patch(apiUrl("/v1/drivers/{driver_id}"), () =>
        problemResponse(429, "RATE_LIMITED", "req-429", {
          "Retry-After": "30",
        }),
      ),
    );
    const user = userEvent.setup();
    renderDetail(bereket);

    await chooseAction(user, t.deactivate);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: t.deactivate }),
    );
    expect(await within(dialog).findByText("req-429")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: t.deactivate }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps Edit beside the name and the rest in its menu; Delete for admins only", async () => {
    for (const [role, items] of [
      ["staff", [t.deactivate, messages.Detail.copyLink]],
      ["admin", [t.deactivate, messages.Detail.copyLink, t.delete]],
    ] as const) {
      serveRole(role);
      serveDriver(bereket);
      const user = userEvent.setup();
      const { queryClient, unmount } = renderDetail(bereket);
      await screen.findByRole("heading", { name: "Bereket Tolosa" });
      await waitFor(() =>
        expect(queryClient.getQueryState(currentStaffQueryKey)?.status).toBe(
          "success",
        ),
      );

      expect(screen.getByRole("button", { name: t.edit })).toBeVisible();
      expect(await actionItems(user)).toEqual(items);
      expect(screen.queryByRole("button", { name: t.delete })).toBeNull();
      unmount();
    }
  });

  it("lets an admin delete the driver, then hands back to the list", async () => {
    serveRole("admin");
    serveDriver(bereket);
    let deleted: string | undefined;
    server.use(
      http.delete(apiUrl("/v1/drivers/{driver_id}"), ({ params }) => {
        deleted = String(params.driver_id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    renderDetail(bereket, { onDeleted });

    await chooseAction(user, t.delete);
    const dialog = await screen.findByRole("alertdialog", {
      name: fill(t.deleteTitle, { name: "Bereket Tolosa" }),
    });
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleted).toBe(bereket.id);
    expect(toast).toHaveBeenCalledWith(t.deletedToast);
  });

  it("names the routes a driver drives when they can't be deleted", async () => {
    serveRole("admin");
    serveDriver(bereket);
    serveTheirRoutes(() => [b07]);
    server.use(
      http.delete(apiUrl("/v1/drivers/{driver_id}"), () =>
        problemResponse(409, "DRIVER_ASSIGNED"),
      ),
    );
    const user = userEvent.setup();
    renderDetail(bereket);

    await chooseAction(user, t.delete);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    expect(
      await within(dialog).findByText(
        "They drive B-07, so they can't be deleted. Give that route another driver, or none, first.",
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByRole("link", { name: "Open B-07" }),
    ).toHaveAttribute("href", `/routes/${b07.id}`);
  });

  it("explains why a driver who drives a route can't be deleted", async () => {
    serveRole("admin");
    serveDriver(bereket);
    server.use(
      http.get(apiUrl("/v1/routes"), () =>
        problemResponse(503, "SERVICE_UNAVAILABLE"),
      ),
      http.delete(apiUrl("/v1/drivers/{driver_id}"), () =>
        problemResponse(409, "DRIVER_ASSIGNED", "req-assigned"),
      ),
    );
    const user = userEvent.setup();
    renderDetail(bereket);

    await chooseAction(user, t.delete);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    // Their routes can't be read: the refusal without names.
    expect(await within(dialog).findByText(t.assignedDelete)).toBeVisible();
    expect(within(dialog).getByText("req-assigned")).toBeVisible();
    expect(within(dialog).queryAllByRole("link")).toHaveLength(0);
  });

  it("explains a delete the API refuses for this role", async () => {
    serveRole("admin");
    serveDriver(bereket);
    server.use(
      http.delete(apiUrl("/v1/drivers/{driver_id}"), () =>
        problemResponse(403, "FORBIDDEN", "req-403"),
      ),
    );
    const user = userEvent.setup();
    renderDetail(bereket);

    await chooseAction(user, t.delete);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    expect(
      await within(dialog).findByText(messages.Errors.FORBIDDEN),
    ).toBeVisible();
  });

  it("opens the edit form filled in", async () => {
    serveDriver(bereket);
    const user = userEvent.setup();
    renderDetail(bereket);

    await user.click(await screen.findByRole("button", { name: t.edit }));
    const dialog = await screen.findByRole("dialog", {
      name: fill(t.editTitle, { name: "Bereket Tolosa" }),
    });
    expect(within(dialog).getByLabelText(t.plateLabel)).toHaveValue(
      "AA 3-B12341",
    );
  });

  it("in a panel, has a close button and a level-2 heading", async () => {
    serveDriver(bereket);
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDetail(bereket, { variant: "panel", onClose });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Bereket Tolosa" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: t.closeDetail }));
    expect(onClose).toHaveBeenCalled();
  });
});

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { currentStaffQueryKey } from "@/lib/auth/use-current-staff";
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
});

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
    expect(fact(t.status)).toHaveTextContent(t.inactive);
    expect(fact(t.added)).toHaveTextContent("Nov 5, 2026");
    expect(fact(t.updated)).toHaveTextContent("Nov 8, 2026");
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

    await user.click(await screen.findByRole("button", { name: t.deactivate }));
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

  it("explains why a driver who drives a route can't be deactivated", async () => {
    serveDriver(bereket);
    server.use(
      http.patch(apiUrl("/v1/drivers/{driver_id}"), () =>
        problemResponse(409, "DRIVER_ASSIGNED", "req-assigned"),
      ),
    );
    const user = userEvent.setup();
    renderDetail(bereket);

    await user.click(await screen.findByRole("button", { name: t.deactivate }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: t.deactivate }),
    );

    expect(await within(dialog).findByText(t.assignedDeactivate)).toBeVisible();
    expect(within(dialog).getByText("req-assigned")).toBeVisible();
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
    expect(screen.queryByRole("button", { name: t.deactivate })).toBeNull();
    await user.click(screen.getByRole("button", { name: t.reactivate }));
    const dialog = await screen.findByRole("alertdialog", {
      name: fill(t.reactivateTitle, { name: "Sara Mohammed" }),
    });
    await user.click(
      within(dialog).getByRole("button", { name: t.reactivate }),
    );

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.reactivatedToast));
    expect(sent).toEqual([{ is_active: true }]);
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

    await user.click(await screen.findByRole("button", { name: t.deactivate }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: t.deactivate }),
    );
    expect(await within(dialog).findByText("req-429")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: t.deactivate }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("offers Delete to admins only", async () => {
    serveDriver(bereket);
    const { queryClient } = renderDetail(bereket);
    await screen.findByRole("heading", { name: "Bereket Tolosa" });
    await waitFor(() =>
      expect(queryClient.getQueryState(currentStaffQueryKey)?.status).toBe(
        "success",
      ),
    );

    expect(screen.queryByRole("button", { name: t.delete })).toBeNull();
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

    await user.click(await screen.findByRole("button", { name: t.delete }));
    const dialog = await screen.findByRole("alertdialog", {
      name: fill(t.deleteTitle, { name: "Bereket Tolosa" }),
    });
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleted).toBe(bereket.id);
    expect(toast).toHaveBeenCalledWith(t.deletedToast);
  });

  it("explains why a driver who drives a route can't be deleted", async () => {
    serveRole("admin");
    serveDriver(bereket);
    server.use(
      http.delete(apiUrl("/v1/drivers/{driver_id}"), () =>
        problemResponse(409, "DRIVER_ASSIGNED", "req-assigned"),
      ),
    );
    const user = userEvent.setup();
    renderDetail(bereket);

    await user.click(await screen.findByRole("button", { name: t.delete }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    expect(await within(dialog).findByText(t.assignedDelete)).toBeVisible();
    expect(within(dialog).getByText("req-assigned")).toBeVisible();
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

    await user.click(await screen.findByRole("button", { name: t.delete }));
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

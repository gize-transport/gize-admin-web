import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import {
  fill,
  problemResponse,
  serveRole,
  validationResponse,
} from "../routes/test-support";
import { RouteRequestDetail } from "./route-request-detail";
import {
  declined,
  forRoute,
  matchedStudent,
  newAreas,
  running,
  schoolRoute,
  servePickerRoutes,
  serveRequest,
} from "./test-support";

vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/route-requests";
  return mockNavigation(state);
});
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.RouteRequests;
const tStatus = messages.RequestStatus;

startMswServer();

beforeEach(() => {
  toast.mockClear();
  serveRole("staff");
});

function fact(label: string) {
  const facts = screen.getByRole("group", { name: t.detailLabel });
  return within(facts).getByText(label, { selector: "dt" }).nextElementSibling;
}

function serveStatus(
  answer: (body: Schemas["RouteRequestStatusSet"]) => Response,
  seen?: Schemas["RouteRequestStatusSet"][],
) {
  server.use(
    http.put(
      apiUrl("/v1/route-requests/{request_id}/status"),
      async ({ request }) => {
        const body = (await request.json()) as Schemas["RouteRequestStatusSet"];
        seen?.push(body);
        return answer(body);
      },
    ),
  );
}

async function renderPage(request: Schemas["RouteRequestRead"]) {
  serveRequest(request);
  const view = renderWithProviders(
    <RouteRequestDetail requestId={request.id} variant="page" />,
  );
  await screen.findByRole("heading", { level: 1, name: request.rider_name });
  return view;
}

async function pickRoute(user: UserEvent, dialog: HTMLElement, code: string) {
  await user.click(
    within(dialog).getByRole("combobox", { name: t.matchRouteLabel }),
  );
  await user.type(
    await screen.findByRole("combobox", {
      name: messages.RoutePicker.searchLabel,
    }),
    code.slice(0, 2),
  );
  await user.click(await screen.findByRole("option", { name: code }));
}

describe("RouteRequestDetail", () => {
  it("shows what's asked, the rider, times and the contact", async () => {
    await renderPage(newAreas);

    expect(fact(t.asked)).toHaveTextContent(/Bole.*Lebu \(not listed\)/);
    expect(fact(t.kind)).toHaveTextContent(t.kindNewAreas);
    expect(fact(t.rider)).toHaveTextContent(t.riderAdult);
    expect(fact(t.preferredTimes)).toHaveTextContent(
      fill(t.timesBoth, { morning: "07:00", back: "17:30" }),
    );
    expect(fact(t.contactName)).toHaveTextContent("Selam Bekele");
    expect(fact(t.contactPhone)).toHaveTextContent("+251911000101");
    expect(fact(t.source)).toHaveTextContent(t.sourceStaff);
    expect(fact(t.notes)).toHaveTextContent(t.noNotes);
    expect(screen.getByText(tStatus.new)).toBeVisible();
  });

  it("links the route asked for and the route matched to", async () => {
    serveRequest(forRoute, matchedStudent);
    const { unmount } = renderWithProviders(
      <RouteRequestDetail requestId={forRoute.id} variant="page" />,
    );
    await screen.findByRole("heading", { level: 1, name: "Dawit Alemu" });
    expect(screen.getByRole("link", { name: /Route B-07/ })).toHaveAttribute(
      "href",
      `/routes/${running.id}`,
    );
    expect(fact(t.preferredTimes)).toHaveTextContent(t.noTimes);
    unmount();

    renderWithProviders(
      <RouteRequestDetail requestId={matchedStudent.id} variant="page" />,
    );
    await screen.findByRole("heading", { level: 1, name: "Liya Girma" });
    expect(fact(t.matchedRoute)).toHaveTextContent("S-06");
    expect(screen.getByRole("link", { name: "S-06" })).toHaveAttribute(
      "href",
      `/routes/${schoolRoute.id}`,
    );
    expect(fact(t.rider)).toHaveTextContent(
      fill(t.riderStudentAt, { school: "Lycée Guebre-Mariam" }),
    );
  });

  it("offers match, fulfil and decline on an open request, nothing on a closed one", async () => {
    const { unmount } = await renderPage(newAreas);
    const steps = screen.getByRole("group", { name: t.nextSteps });
    for (const name of [t.match, t.fulfil, t.decline]) {
      expect(within(steps).getByRole("button", { name })).toBeVisible();
    }
    unmount();

    await renderPage(declined);
    expect(fact(t.declineReason)).toHaveTextContent(
      "Too far from our corridors for now.",
    );
    const closed = screen.getByRole("group", { name: t.nextSteps });
    expect(within(closed).queryAllByRole("button")).toHaveLength(0);
    expect(closed).toHaveTextContent(t.closedDeclined);
  });

  it("matches to a public route for an adult, then focuses the next steps", async () => {
    const seen: Schemas["RouteRequestStatusSet"][] = [];
    const routesAsked: URL[] = [];
    servePickerRoutes([running, schoolRoute], routesAsked);
    serveStatus(
      () =>
        HttpResponse.json<Schemas["RouteRequestRead"]>({
          ...newAreas,
          status: "matched",
          matched_route: { id: running.id, code: "B-07" },
        }),
      seen,
    );
    const user = userEvent.setup();
    await renderPage(newAreas);

    await user.click(screen.getByRole("button", { name: t.match }));
    const dialog = await screen.findByRole("dialog", { name: t.matchTitle });
    await pickRoute(user, dialog, "B-07");
    await user.click(within(dialog).getByRole("button", { name: t.matchSave }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(fill(t.matched, { code: "B-07" })),
    );
    expect(seen).toEqual([{ status: "matched", matched_route_id: running.id }]);
    // Adults: public routes, in any status (a van to come may still be a draft).
    expect(routesAsked[0]?.searchParams.get("route_type")).toBe("public");
    expect(routesAsked[0]?.searchParams.has("status")).toBe(false);
    await waitFor(() =>
      expect(screen.getByRole("group", { name: t.nextSteps })).toHaveFocus(),
    );
    expect(
      screen.getByText(fill(tStatus.matched, { code: "B-07" })),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: t.rematch })).toBeVisible();
  });

  it("asks for a route, and explains a route that isn't for this rider", async () => {
    servePickerRoutes([schoolRoute]);
    serveStatus(() => validationResponse("/matched_route_id"));
    const user = userEvent.setup();
    await renderPage(matchedStudent);

    await user.click(screen.getByRole("button", { name: t.rematch }));
    const dialog = await screen.findByRole("dialog", { name: t.matchTitle });
    await user.click(within(dialog).getByRole("button", { name: t.matchSave }));
    expect(await within(dialog).findByText(t.matchRouteRequired)).toBeVisible();

    await pickRoute(user, dialog, "S-06");
    await user.click(within(dialog).getByRole("button", { name: t.matchSave }));
    expect(await within(dialog).findByText(t.matchRouteNotFor)).toBeVisible();
    expect(
      within(dialog).getByRole("combobox", { name: t.matchRouteLabel }),
    ).toHaveFocus();
  });

  it("marks a request fulfilled, confirmed", async () => {
    const seen: Schemas["RouteRequestStatusSet"][] = [];
    serveStatus(
      () =>
        HttpResponse.json<Schemas["RouteRequestRead"]>({
          ...matchedStudent,
          status: "fulfilled",
        }),
      seen,
    );
    const user = userEvent.setup();
    await renderPage(matchedStudent);

    await user.click(screen.getByRole("button", { name: t.fulfil }));
    const confirm = await screen.findByRole("alertdialog", {
      name: t.fulfilTitle,
    });
    await user.click(within(confirm).getByRole("button", { name: t.fulfil }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.fulfilled));
    expect(seen).toEqual([{ status: "fulfilled" }]);
    expect(await screen.findByText(t.closedFulfilled)).toBeVisible();
  });

  it("declines with a reason it checks first", async () => {
    const seen: Schemas["RouteRequestStatusSet"][] = [];
    serveStatus(
      (body) =>
        HttpResponse.json<Schemas["RouteRequestRead"]>({
          ...newAreas,
          status: "declined",
          decline_reason: body.decline_reason ?? null,
        }),
      seen,
    );
    const user = userEvent.setup();
    await renderPage(newAreas);

    await user.click(screen.getByRole("button", { name: t.decline }));
    const dialog = await screen.findByRole("dialog", {
      name: t.declineTitle,
    });
    await user.click(within(dialog).getByRole("button", { name: t.decline }));
    const reason = within(dialog).getByLabelText(t.declineReasonLabel);
    await waitFor(() => expect(reason).toHaveFocus());
    expect(reason).toHaveAccessibleDescription(
      `${t.declineReasonHint} ${t.declineReasonRequired}`,
    );

    await user.type(reason, "  No route near Lebu yet  ");
    await user.click(within(dialog).getByRole("button", { name: t.decline }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.declined));
    expect(seen).toEqual([
      { status: "declined", decline_reason: "No route near Lebu yet" },
    ]);
    expect(fact(t.declineReason)).toHaveTextContent("No route near Lebu yet");
  });

  it("explains a move that's no longer possible and reloads the request", async () => {
    let reads = 0;
    server.use(
      http.get(apiUrl("/v1/route-requests/{request_id}"), () => {
        reads += 1;
        return HttpResponse.json(
          reads === 1 ? newAreas : { ...newAreas, status: "fulfilled" },
        );
      }),
    );
    serveStatus(() => problemResponse(409, "INVALID_STATUS_CHANGE", "req-409"));
    const user = userEvent.setup();
    renderWithProviders(
      <RouteRequestDetail requestId={newAreas.id} variant="page" />,
    );
    await screen.findByRole("heading", { level: 1, name: "Selam Bekele" });

    await user.click(screen.getByRole("button", { name: t.fulfil }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: t.fulfil }));

    expect(
      await within(confirm).findByText(t.statusChangeInvalid),
    ).toBeVisible();
    expect(within(confirm).getByText("req-409")).toBeVisible();
    await waitFor(() => expect(reads).toBe(2));

    // Its buttons are gone (fulfilled meanwhile): closing keeps focus in the next steps.
    await screen.findByText(t.closedFulfilled);
    await user.click(
      within(confirm).getByRole("button", { name: messages.Common.cancel }),
    );
    await waitFor(() =>
      expect(screen.getByRole("group", { name: t.nextSteps })).toHaveFocus(),
    );
  });

  it("keeps Decline disabled until Retry-After has passed after a 429", async () => {
    serveStatus(() =>
      problemResponse(429, "RATE_LIMITED", "req-429", { "Retry-After": "1" }),
    );
    const user = userEvent.setup();
    await renderPage(newAreas);

    await user.click(screen.getByRole("button", { name: t.decline }));
    const dialog = await screen.findByRole("dialog", { name: t.declineTitle });
    await user.type(within(dialog).getByLabelText(t.declineReasonLabel), "x");
    const button = within(dialog).getByRole("button", { name: t.decline });
    await user.click(button);

    expect(
      await within(dialog).findByText(messages.Errors.RATE_LIMITED),
    ).toBeVisible();
    expect(button).toHaveAttribute("aria-disabled", "true");
    await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled"), {
      timeout: 2500,
    });
  });

  it("lets an admin delete a request; staff see no Delete", async () => {
    const { unmount } = await renderPage(newAreas);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: t.deleteRequest }),
      ).toBeNull(),
    );
    unmount();

    serveRole("admin");
    let deleted = false;
    server.use(
      http.delete(apiUrl("/v1/route-requests/{request_id}"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    serveRequest(newAreas);
    renderWithProviders(
      <RouteRequestDetail
        requestId={newAreas.id}
        variant="page"
        onDeleted={onDeleted}
      />,
    );
    await user.click(
      await screen.findByRole("button", { name: t.deleteRequest }),
    );
    const confirm = await screen.findByRole("alertdialog", {
      name: t.deleteTitle,
    });
    await user.click(
      within(confirm).getByRole("button", { name: t.deleteRequest }),
    );

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleted).toBe(true);
    expect(toast).toHaveBeenCalledWith(t.deleted);
  });

  it("says when the request is gone", async () => {
    serveRequest();
    renderWithProviders(
      <RouteRequestDetail requestId={newAreas.id} variant="page" />,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: t.notFoundTitle }),
    ).toBeVisible();
  });
});

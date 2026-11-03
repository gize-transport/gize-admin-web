import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import {
  areas,
  fill,
  problemResponse,
  servePlaces,
  serveRoute,
  validationResponse,
} from "../routes/test-support";
import { RouteRequestFormDialog } from "./route-request-form-dialog";
import {
  forRoute,
  matchedStudent,
  newAreas,
  running,
  schoolRoute,
  servePickerRoutes,
} from "./test-support";

vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.RouteRequests;

startMswServer();

beforeEach(() => {
  toast.mockClear();
  servePlaces();
});

type Seen = { body: Record<string, unknown>; key: string | null };

function serveCreate(answer: () => Response, seen?: Seen[]) {
  server.use(
    http.post(apiUrl("/v1/route-requests"), async ({ request }) => {
      seen?.push({
        body: (await request.json()) as Record<string, unknown>,
        key: request.headers.get("Idempotency-Key"),
      });
      return answer();
    }),
  );
}

function renderDialog(request?: Schemas["RouteRequestRead"]) {
  const onOpenChange = vi.fn();
  const onRecorded = vi.fn();
  const view = renderWithProviders(
    <RouteRequestFormDialog
      open
      onOpenChange={onOpenChange}
      request={request}
      onRecorded={onRecorded}
    />,
  );
  return {
    ...view,
    onOpenChange,
    onRecorded,
    dialog: screen.getByRole("dialog"),
  };
}

const field = (dialog: HTMLElement, label: string) =>
  within(dialog).getByLabelText(label);

async function fillWho(user: UserEvent, dialog: HTMLElement) {
  await user.type(field(dialog, t.riderNameLabel), "Abebe Kebede");
  await user.type(field(dialog, t.contactNameLabel), "Abebe Kebede");
  await user.type(field(dialog, t.contactPhoneLabel), "0911 00 01 11");
}

async function nameEnd(
  user: UserEvent,
  dialog: HTMLElement,
  legend: string,
  name: string,
) {
  const end = within(dialog).getByRole("group", { name: legend });
  await user.click(within(end).getByLabelText(t.endNamed));
  await user.type(
    within(end).getByLabelText(fill(t.endNameLabel, { end: legend })),
    name,
  );
}

async function pickArea(
  user: UserEvent,
  dialog: HTMLElement,
  legend: string,
  name: string,
) {
  await user.click(
    within(dialog).getByRole("combobox", {
      name: fill(t.endAreaLabel, { end: legend }),
    }),
  );
  await user.type(
    await screen.findByRole("combobox", {
      name: messages.AreaPicker.searchLabel,
    }),
    name.slice(0, 3),
  );
  await user.click(await screen.findByRole("option", { name }));
}

async function pickRoute(user: UserEvent, dialog: HTMLElement, code: string) {
  await user.click(
    within(dialog).getByRole("combobox", { name: t.routeLabel }),
  );
  await user.type(
    await screen.findByRole("combobox", {
      name: messages.RoutePicker.searchLabel,
    }),
    code.slice(0, 2),
  );
  await user.click(await screen.findByRole("option", { name: code }));
}

const save = (dialog: HTMLElement, name = t.record) =>
  within(dialog).getByRole("button", { name });

describe("RouteRequestFormDialog: recording", () => {
  it("records a new-areas request (a listed area and a name), retrying with the same key", async () => {
    const seen: Seen[] = [];
    let fail = true;
    serveCreate(() => {
      if (fail) {
        fail = false;
        return problemResponse(503, "SERVICE_UNAVAILABLE");
      }
      return HttpResponse.json(newAreas, { status: 201 });
    }, seen);
    const user = userEvent.setup();
    const { dialog, onRecorded, onOpenChange } = renderDialog();

    await pickArea(user, dialog, t.fromLegend, "Bole");
    await nameEnd(user, dialog, t.toLegend, "Lebu");
    await fillWho(user, dialog);
    await user.type(field(dialog, t.morningLabel), "07:00");
    await user.type(field(dialog, t.returnLabel), "17:30");
    await user.click(save(dialog));
    expect(
      await within(dialog).findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeVisible();
    await user.click(save(dialog));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.recordedToast));
    expect(seen[0]?.body).toEqual({
      kind: "new_areas",
      rider_type: "adult",
      rider_name: "Abebe Kebede",
      contact_name: "Abebe Kebede",
      contact_phone: "0911 00 01 11",
      from_area_id: areas.bole.id,
      to_area_name: "Lebu",
      preferred_morning_time: "07:00",
      preferred_return_time: "17:30",
    });
    expect(seen[0]?.key).toBeTruthy();
    expect(seen[1]?.key).toBe(seen[0]?.key);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onRecorded).toHaveBeenCalledWith(newAreas);
    // Personal data never goes into the toast.
    expect(JSON.stringify(toast.mock.calls)).not.toContain("Abebe");
  });

  it("checks the fields before sending and focuses a problem", async () => {
    const seen: Seen[] = [];
    serveCreate(() => problemResponse(500, "INTERNAL_ERROR"), seen);
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await nameEnd(user, dialog, t.fromLegend, "Lebu");
    await nameEnd(user, dialog, t.toLegend, "lebu");
    await user.click(within(dialog).getByLabelText(t.riderStudentOption));
    await user.type(field(dialog, t.contactPhoneLabel), "12345");
    await user.type(field(dialog, t.morningLabel), "17:00");
    await user.type(field(dialog, t.returnLabel), "07:00");
    await user.click(save(dialog));

    await waitFor(() =>
      expect(document.activeElement).toHaveAttribute("aria-invalid", "true"),
    );
    const to = field(dialog, fill(t.endNameLabel, { end: t.toLegend }));
    expect(to).toHaveAccessibleDescription(`${t.endNameHint} ${t.endsSame}`);
    expect(field(dialog, t.riderNameLabel)).toHaveAccessibleDescription(
      `${t.riderNameHintStudent} ${t.riderNameRequired}`,
    );
    expect(field(dialog, t.schoolLabel)).toHaveAccessibleDescription(
      t.schoolRequired,
    );
    expect(field(dialog, t.returnLabel)).toHaveAccessibleDescription(
      expect.stringContaining(t.timesOrder),
    );
    expect(field(dialog, t.contactPhoneLabel)).toHaveAccessibleDescription(
      `${t.contactPhoneHint} ${t.phoneInvalid}`,
    );
    expect(seen).toHaveLength(0);
  });

  it("asks for each end of a new-areas request", async () => {
    const user = userEvent.setup();
    const { dialog } = renderDialog();
    await fillWho(user, dialog);
    await user.click(save(dialog));

    expect(await within(dialog).findAllByText(t.endRequired)).toHaveLength(2);
  });

  it("records a seat on a running public route for an adult", async () => {
    const seen: Seen[] = [];
    const routesAsked: URL[] = [];
    servePickerRoutes([running, schoolRoute], routesAsked);
    serveCreate(() => HttpResponse.json(forRoute, { status: 201 }), seen);
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await user.click(within(dialog).getByLabelText(t.kindRouteOption));
    expect(within(dialog).getByText(t.routeHintAdult)).toBeVisible();
    await pickRoute(user, dialog, "B-07");
    await fillWho(user, dialog);
    await user.click(save(dialog));

    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]?.body).toMatchObject({
      kind: "route",
      route_id: running.id,
      rider_type: "adult",
    });
    expect(seen[0]?.body).not.toHaveProperty("school_name");
    // Running routes only: active and paused, public for an adult.
    const statuses = routesAsked.map((url) => url.searchParams.get("status"));
    expect(statuses).toEqual(expect.arrayContaining(["active", "paused"]));
    expect(
      routesAsked.every(
        (url) => url.searchParams.get("route_type") === "public",
      ),
    ).toBe(true);
  });

  it("gives a student's route request the route's school", async () => {
    const seen: Seen[] = [];
    servePickerRoutes([running, schoolRoute]);
    serveRoute(schoolRoute);
    serveCreate(() => HttpResponse.json(matchedStudent, { status: 201 }), seen);
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await user.click(within(dialog).getByLabelText(t.kindRouteOption));
    await user.click(within(dialog).getByLabelText(t.riderStudentOption));
    expect(within(dialog).getByText(t.schoolPending)).toBeVisible();
    await pickRoute(user, dialog, "S-06");
    expect(
      await within(dialog).findByText(
        fill(t.schoolFromRoute, { school: "Lycée Guebre-Mariam" }),
      ),
    ).toBeVisible();
    await fillWho(user, dialog);
    await user.click(save(dialog));

    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]?.body).toMatchObject({
      kind: "route",
      route_id: schoolRoute.id,
      rider_type: "student",
      school_name: "Lycée Guebre-Mariam",
    });
  });

  it("clears the route when the rider type changes", async () => {
    servePickerRoutes([running]);
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await user.click(within(dialog).getByLabelText(t.kindRouteOption));
    await pickRoute(user, dialog, "B-07");
    await user.click(within(dialog).getByLabelText(t.riderStudentOption));

    expect(
      within(dialog).getByRole("combobox", { name: t.routeLabel }),
    ).not.toHaveTextContent("B-07");
  });

  it("explains an open request that already exists, linking that route's open requests", async () => {
    servePickerRoutes([running]);
    serveCreate(() => problemResponse(409, "ROUTE_REQUEST_EXISTS", "req-409"));
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderDialog();

    await user.click(within(dialog).getByLabelText(t.kindRouteOption));
    await pickRoute(user, dialog, "B-07");
    await fillWho(user, dialog);
    await user.click(save(dialog));

    expect(
      await within(dialog).findByText(fill(t.existsRoute, { code: "B-07" })),
    ).toBeVisible();
    expect(within(dialog).getByText("req-409")).toBeVisible();
    expect(
      within(dialog).getByRole("link", {
        name: fill(t.existsRouteLink, { code: "B-07" }),
      }),
    ).toHaveAttribute(
      "href",
      `/route-requests?route_id=${running.id}&open=true`,
    );
    // The list may be behind the dialog: following the link closes it.
    await user.click(
      within(dialog).getByRole("link", {
        name: fill(t.existsRouteLink, { code: "B-07" }),
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("explains an existing request for the same areas", async () => {
    serveCreate(() => problemResponse(409, "ROUTE_REQUEST_EXISTS"));
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await nameEnd(user, dialog, t.fromLegend, "Lebu");
    await pickArea(user, dialog, t.toLegend, "Bole");
    await fillWho(user, dialog);
    await user.click(save(dialog));

    expect(await within(dialog).findByText(t.existsAreas)).toBeVisible();
    expect(
      within(dialog).getByRole("link", { name: t.existsAreasLink }),
    ).toHaveAttribute("href", "/route-requests?kind=new_areas&open=true");
  });

  it("names the route that was refused, even if another is picked after", async () => {
    servePickerRoutes([
      running,
      { ...running, id: "00000000-0000-4000-d000-000000000070", code: "B-08" },
    ]);
    serveCreate(() => problemResponse(409, "ROUTE_REQUEST_EXISTS"));
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await user.click(within(dialog).getByLabelText(t.kindRouteOption));
    await pickRoute(user, dialog, "B-07");
    await fillWho(user, dialog);
    await user.click(save(dialog));
    await within(dialog).findByText(fill(t.existsRoute, { code: "B-07" }));
    await pickRoute(user, dialog, "B-08");

    expect(
      within(dialog).getByText(fill(t.existsRoute, { code: "B-07" })),
    ).toBeVisible();
  });

  it("compares the two names as the API does (case, spaces)", async () => {
    const seen: Seen[] = [];
    serveCreate(() => problemResponse(500, "INTERNAL_ERROR"), seen);
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await nameEnd(user, dialog, t.fromLegend, "Lebu  Mebrat");
    await nameEnd(user, dialog, t.toLegend, "lebu mebrat");
    await fillWho(user, dialog);
    await user.click(save(dialog));

    expect(await within(dialog).findByText(t.endsSame)).toBeVisible();
    expect(seen).toHaveLength(0);
  });

  it("explains a route that couldn't be loaded for a student's school, with a retry", async () => {
    servePickerRoutes([schoolRoute]);
    let fail = true;
    server.use(
      http.get(apiUrl("/v1/routes/{route_id}"), () => {
        if (fail) {
          fail = false;
          return problemResponse(503, "SERVICE_UNAVAILABLE", "req-503");
        }
        return HttpResponse.json(schoolRoute);
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await user.click(within(dialog).getByLabelText(t.kindRouteOption));
    await user.click(within(dialog).getByLabelText(t.riderStudentOption));
    await pickRoute(user, dialog, "S-06");
    expect(
      await within(dialog).findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeVisible();
    expect(within(dialog).getByText("req-503")).toBeVisible();
    await fillWho(user, dialog);
    await user.click(save(dialog));
    expect(await within(dialog).findByText(t.schoolRouteWait)).toBeVisible();

    await user.click(
      within(dialog).getByRole("button", { name: messages.ProblemAlert.retry }),
    );
    expect(
      await within(dialog).findByText(
        fill(t.schoolFromRoute, { school: "Lycée Guebre-Mariam" }),
      ),
    ).toBeVisible();
  });

  it("puts the API's field refusals on their fields", async () => {
    servePickerRoutes([running]);
    serveCreate(() => validationResponse("/route_id"));
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await user.click(within(dialog).getByLabelText(t.kindRouteOption));
    await pickRoute(user, dialog, "B-07");
    await fillWho(user, dialog);
    await user.click(save(dialog));

    expect(await within(dialog).findByText(t.routeNotFor)).toBeVisible();
    expect(
      within(dialog).getByRole("combobox", { name: t.routeLabel }),
    ).toHaveFocus();
  });

  it("keeps Record disabled until Retry-After has passed after a 429", async () => {
    serveCreate(() =>
      problemResponse(429, "RATE_LIMITED", "req-429", { "Retry-After": "1" }),
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await nameEnd(user, dialog, t.fromLegend, "Lebu");
    await nameEnd(user, dialog, t.toLegend, "Summit");
    await fillWho(user, dialog);
    await user.click(save(dialog));

    expect(
      await within(dialog).findByText(messages.Errors.RATE_LIMITED),
    ).toBeVisible();
    expect(save(dialog)).toHaveAttribute("aria-disabled", "true");
    await waitFor(
      () => expect(save(dialog)).not.toHaveAttribute("aria-disabled"),
      { timeout: 2500 },
    );
  });
});

describe("RouteRequestFormDialog: correcting", () => {
  function servePatch(
    answer: () => Response,
    seen?: Record<string, unknown>[],
  ) {
    server.use(
      http.patch(
        apiUrl("/v1/route-requests/{request_id}"),
        async ({ request }) => {
          seen?.push((await request.json()) as Record<string, unknown>);
          return answer();
        },
      ),
    );
  }

  it("shows what's asked as fixed and sends only what changed", async () => {
    const seen: Record<string, unknown>[] = [];
    servePatch(() => HttpResponse.json(newAreas), seen);
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderDialog(newAreas);

    expect(dialog).toHaveTextContent(/Bole.*Lebu \(not listed\)/);
    expect(within(dialog).queryByLabelText(t.kindRouteOption)).toBeNull();
    await user.clear(field(dialog, t.contactPhoneLabel));
    await user.type(field(dialog, t.contactPhoneLabel), "+251 911 000 101");
    await user.clear(field(dialog, t.returnLabel));
    await user.type(field(dialog, t.returnLabel), "18:00");
    await user.type(field(dialog, t.notesLabel), "Prefers a window seat.");
    await user.click(save(dialog, t.save));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.savedToast));
    // The phone is the same number, typed another way.
    expect(seen).toEqual([
      { preferred_return_time: "18:00", notes: "Prefers a window seat." },
    ]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes without a call when nothing changed", async () => {
    const seen: Record<string, unknown>[] = [];
    servePatch(() => HttpResponse.json(newAreas), seen);
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderDialog(newAreas);

    await user.click(save(dialog, t.save));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(seen).toHaveLength(0);
  });

  it("can change a preferred time but not remove it", async () => {
    const user = userEvent.setup();
    const { dialog } = renderDialog(newAreas);

    await user.clear(field(dialog, t.morningLabel));
    await user.click(save(dialog, t.save));

    expect(await within(dialog).findByText(t.timeCantClear)).toBeVisible();
  });

  it("shows the school of a student's request that names a route, without editing it", async () => {
    const { dialog } = renderDialog(matchedStudent);

    expect(within(dialog).queryByLabelText(t.schoolLabel)).toBeNull();
    expect(dialog).toHaveTextContent(
      fill(t.schoolFromRoute, { school: "Lycée Guebre-Mariam" }),
    );
  });

  it("explains a school the API refuses (matched meanwhile), and a change that duplicates another request", async () => {
    servePatch(() => validationResponse("/school_name"));
    const user = userEvent.setup();
    const { dialog, unmount } = renderDialog({
      ...matchedStudent,
      status: "new",
      matched_route: null,
    });

    await user.clear(field(dialog, t.schoolLabel));
    await user.type(field(dialog, t.schoolLabel), "Another School");
    await user.click(save(dialog, t.save));
    expect(await within(dialog).findByText(t.schoolNotRoute)).toBeVisible();
    unmount();

    servePatch(() => problemResponse(409, "ROUTE_REQUEST_EXISTS"));
    const again = renderDialog(newAreas);
    await user.clear(field(again.dialog, t.riderNameLabel));
    await user.type(field(again.dialog, t.riderNameLabel), "Liya");
    await user.click(save(again.dialog, t.save));
    expect(await within(again.dialog).findByText(t.existsEdit)).toBeVisible();
  });
});

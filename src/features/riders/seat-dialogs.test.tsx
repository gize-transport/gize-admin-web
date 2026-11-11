import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import {
  areas,
  brewery,
  fill,
  problemResponse,
  route,
  serveRole,
  validationResponse,
} from "../routes/test-support";
import { EndSeatDialog, KeepSeatDialog, PlaceSeatDialog } from "./seat-dialogs";
import { companyRider, moving, noSeat, rider, riding } from "./test-support";

vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/riders";
  return mockNavigation(state);
});
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.Riders;

startMswServer();

// Noon on 11 November 2026 in Addis Ababa: the dates offered are known (only Date is faked).
const TODAY = "2026-11-11";
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-11T09:00:00Z"));
  toast.mockClear();
  serveRole("staff");
});

afterEach(() => vi.useRealTimers());

function publicRoute(
  code: string,
  index: number,
  overrides: Partial<Schemas["PublicRoute"]> = {},
): Schemas["PublicRoute"] {
  return {
    id: `00000000-0000-4000-d000-${String(index).padStart(12, "0")}`,
    code,
    origin_area: areas.cmc,
    destination_area: areas.mexico,
    served_areas: [],
    morning_time: "06:30",
    morning_arrival_time: "07:15",
    return_time: "17:30",
    return_arrival_time: "18:15",
    prices: { round_trip: 2400, one_way: 1400, saturday: null },
    status: "active",
    full: false,
    ...overrides,
  };
}

// R-03 is the route riding/moving riders are on (test-support's routeId(3)).
const r03 = publicRoute("R-03", 3);
const r07 = publicRoute("R-07", 7, { status: "forming" });
const r09 = publicRoute("R-09", 9, { full: true });

function serveTrip(items: Schemas["PublicRoute"][], seen?: URL[]) {
  server.use(
    http.get(apiUrl("/v1/public/routes"), ({ request }) => {
      seen?.push(new URL(request.url));
      return HttpResponse.json<Schemas["PublicRoutePage"]>({
        items,
        next_cursor: null,
      });
    }),
  );
}

type Sent<T> = { body: T; key: string | null };

function servePlace(
  answer: (body: Schemas["SeatPlacement"]) => Response,
  seen: Sent<Schemas["SeatPlacement"]>[],
) {
  server.use(
    http.put(apiUrl("/v1/riders/{rider_id}/seat"), async ({ request }) => {
      const body = (await request.json()) as Schemas["SeatPlacement"];
      seen.push({ body, key: request.headers.get("Idempotency-Key") });
      return answer(body);
    }),
  );
}

function renderPlace(who: Schemas["RiderRead"]) {
  const onOpenChange = vi.fn();
  const onRecordRequest = vi.fn();
  renderWithProviders(
    <PlaceSeatDialog
      rider={who}
      open
      onOpenChange={onOpenChange}
      onRecordRequest={onRecordRequest}
    />,
  );
  return { onOpenChange, onRecordRequest, dialog: screen.getByRole("dialog") };
}

const option = (dialog: HTMLElement, code: string) =>
  within(dialog).getByRole("radio", { name: new RegExp(`^${code}`) });

describe("PlaceSeatDialog", () => {
  it("offers the routes that take an adult's trip and places them from the next 1st", async () => {
    const seenTrip: URL[] = [];
    const sent: Sent<Schemas["SeatPlacement"]>[] = [];
    serveTrip([r07, r09], seenTrip);
    servePlace(() => HttpResponse.json(noSeat), sent);
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderPlace(noSeat);

    expect(
      within(dialog).getByText(
        fill(t.placeHintAdult, {
          home: "CMC",
          destination: "Mexico",
          plan: t.planRoundTrip,
        }),
      ),
    ).toBeVisible();
    await user.click(
      await within(dialog).findByRole("radio", { name: /^R-07/ }),
    );
    expect(within(dialog).getByText(t.routeForming)).toBeVisible();
    expect(
      within(option(dialog, "R-09").closest("label") as HTMLElement).getByText(
        t.routeFull,
      ),
    ).toBeVisible();
    expect(seenTrip[0]?.searchParams.get("from_area_id")).toBe(areas.cmc.id);
    expect(seenTrip[0]?.searchParams.get("to_area_id")).toBe(areas.mexico.id);
    expect(within(dialog).getByLabelText(t.seatStartMonth)).toHaveValue(
      "2026-12-01",
    );
    await user.click(within(dialog).getByRole("button", { name: t.placeSave }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(sent).toHaveLength(1);
    expect(sent[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent[0]?.body).toEqual({
      route_id: r07.id,
      start_date: "2026-12-01",
    });
    expect(toast).toHaveBeenCalledWith(t.placedToast);
  });

  it("asks for a route before sending", async () => {
    const sent: Sent<Schemas["SeatPlacement"]>[] = [];
    serveTrip([r07]);
    servePlace(() => HttpResponse.json(noSeat), sent);
    const user = userEvent.setup();
    const { dialog } = renderPlace(noSeat);

    await within(dialog).findByRole("radio", { name: /^R-07/ });
    await user.click(within(dialog).getByRole("button", { name: t.placeSave }));

    expect(within(dialog).getByText(t.seatRouteRequired)).toBeVisible();
    expect(option(dialog, "R-07")).toHaveFocus();
    expect(sent).toEqual([]);
  });

  it("moves a rider: their own route isn't offered, and the old seat's end is explained", async () => {
    const sent: Sent<Schemas["SeatPlacement"]>[] = [];
    serveTrip([r03, r07]);
    servePlace(() => HttpResponse.json(riding), sent);
    const user = userEvent.setup();
    const { dialog } = renderPlace(riding);

    expect(
      within(dialog).getByRole("heading", {
        name: fill(t.moveTitle, { name: "Abel Tesfaye" }),
      }),
    ).toBeVisible();
    expect(
      within(dialog).getByText(fill(t.moveNote, { code: "R-03" })),
    ).toBeVisible();
    await user.click(
      await within(dialog).findByRole("radio", { name: /^R-07/ }),
    );
    expect(
      within(dialog).queryByRole("radio", { name: /^R-03/ }),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: t.moveSave }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.movedToast));
    expect(sent[0]?.body.route_id).toBe(r07.id);
  });

  it("asks for a reason when others asked first, then sends it with the same key", async () => {
    const sent: Sent<Schemas["SeatPlacement"]>[] = [];
    serveTrip([r09]);
    servePlace(
      (body) =>
        body.skip_reason
          ? HttpResponse.json(noSeat)
          : problemResponse(409, "ROUTE_HAS_WAITING_REQUESTS"),
      sent,
    );
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderPlace(noSeat);

    await user.click(
      await within(dialog).findByRole("radio", { name: /^R-09/ }),
    );
    await user.click(within(dialog).getByRole("button", { name: t.placeSave }));

    const reason = await within(dialog).findByLabelText(t.skipReasonLabel);
    expect(within(dialog).getByText(t.skipReasonNeeded)).toBeVisible();
    await waitFor(() => expect(reason).toHaveFocus());
    await user.type(reason, "Their employer asked for this route");
    await user.click(within(dialog).getByRole("button", { name: t.placeSave }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(sent).toHaveLength(2);
    expect(sent[1]?.body.skip_reason).toBe(
      "Their employer asked for this route",
    );
    expect(sent[1]?.key).toBe(sent[0]?.key);
  });

  it("offers a route request when a running route is full", async () => {
    serveTrip([r09]);
    servePlace(() => problemResponse(409, "ROUTE_FULL"), []);
    const user = userEvent.setup();
    const { dialog, onOpenChange, onRecordRequest } = renderPlace(noSeat);

    await user.click(
      await within(dialog).findByRole("radio", { name: /^R-09/ }),
    );
    await user.click(within(dialog).getByRole("button", { name: t.placeSave }));

    expect(
      await within(dialog).findByText(
        fill(t.seatFullRequest, { code: "R-09" }),
      ),
    ).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", {
        name: fill(t.seatRecordRequest, { code: "R-09" }),
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onRecordRequest).toHaveBeenCalledWith({ id: r09.id, code: "R-09" });
  });

  it("only explains a full forming route (a request can't name it)", async () => {
    serveTrip([r07]);
    servePlace(() => problemResponse(409, "ROUTE_FULL"), []);
    const user = userEvent.setup();
    const { dialog } = renderPlace(noSeat);

    await user.click(
      await within(dialog).findByRole("radio", { name: /^R-07/ }),
    );
    await user.click(within(dialog).getByRole("button", { name: t.placeSave }));

    expect(
      await within(dialog).findByText(fill(t.seatFull, { code: "R-07" })),
    ).toBeVisible();
    expect(
      within(dialog).queryByRole("button", { name: /Record route request/ }),
    ).not.toBeInTheDocument();
  });

  it("explains a route that doesn't take them on the routes", async () => {
    serveTrip([r07]);
    servePlace(() => validationResponse("route_id"), []);
    const user = userEvent.setup();
    const { dialog } = renderPlace(riding);

    await user.click(
      await within(dialog).findByRole("radio", { name: /^R-07/ }),
    );
    await user.click(within(dialog).getByRole("button", { name: t.moveSave }));

    expect(await within(dialog).findByText(t.seatRouteRefused)).toBeVisible();
    expect(option(dialog, "R-07")).toHaveFocus();
  });

  it("places a company rider on one of their company's routes from today", async () => {
    const seenRoutes: URL[] = [];
    const sent: Sent<Schemas["SeatPlacement"]>[] = [];
    const r21 = route("R-21", 21, {
      route_type: "corporate",
      company: brewery,
      status: "active",
    });
    server.use(
      http.get(apiUrl("/v1/routes"), ({ request }) => {
        seenRoutes.push(new URL(request.url));
        return HttpResponse.json<Schemas["RoutePage"]>({
          items: [r21],
          next_cursor: null,
        });
      }),
    );
    servePlace(() => HttpResponse.json(companyRider), sent);
    const user = userEvent.setup();
    const { dialog } = renderPlace(companyRider);

    await user.click(
      await within(dialog).findByRole("radio", { name: /^R-21/ }),
    );
    expect(
      // The route has 5 seats free this month (test-support).
      within(dialog).getByText("5 seats free this month"),
    ).toBeVisible();
    expect(seenRoutes[0]?.searchParams.get("company_id")).toBe(brewery.id);
    expect(seenRoutes[0]?.searchParams.get("route_type")).toBe("corporate");
    expect(within(dialog).getByLabelText(t.seatStartDay)).toHaveValue(TODAY);
    await user.click(within(dialog).getByRole("button", { name: t.placeSave }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toEqual({
      route_id: r21.id,
      start_date: TODAY,
    });
  });

  it("says when a company isn't active", async () => {
    server.use(
      http.get(apiUrl("/v1/routes"), () =>
        HttpResponse.json<Schemas["RoutePage"]>({
          items: [
            route("R-21", 21, { route_type: "corporate", company: brewery }),
          ],
          next_cursor: null,
        }),
      ),
    );
    servePlace(() => problemResponse(409, "ROUTE_NOT_READY"), []);
    const user = userEvent.setup();
    const { dialog } = renderPlace(companyRider);

    await user.click(
      await within(dialog).findByRole("radio", { name: /^R-21/ }),
    );
    await user.click(within(dialog).getByRole("button", { name: t.placeSave }));

    expect(
      await within(dialog).findByText(
        fill(t.seatCompanyInactive, { company: "Addis Brewery" }),
      ),
    ).toBeVisible();
  });

  it("shows paused routes and routes without the Saturday they want, not to be chosen", async () => {
    const paused = publicRoute("R-11", 11, { status: "paused" });
    const weekdays = publicRoute("R-12", 12);
    const saturdays = publicRoute("R-13", 13, {
      prices: { round_trip: 2400, one_way: 1400, saturday: 300 },
    });
    serveTrip([paused, weekdays, saturdays]);
    const { dialog } = renderPlace(rider(8, { saturday_addon: true }));

    const r11 = await within(dialog).findByRole("radio", { name: /^R-11/ });
    expect(r11).toBeDisabled();
    expect(r11).toHaveAccessibleDescription(t.routePausedNote);
    expect(option(dialog, "R-12")).toBeDisabled();
    expect(option(dialog, "R-12")).toHaveAccessibleDescription(
      t.routeNoSaturday,
    );
    expect(option(dialog, "R-13")).toBeEnabled();
  });

  it("asks for a reason only while the route that needs one is chosen", async () => {
    const sent: Sent<Schemas["SeatPlacement"]>[] = [];
    serveTrip([r09, r07]);
    servePlace(
      (body) =>
        body.route_id === r09.id
          ? problemResponse(409, "ROUTE_HAS_WAITING_REQUESTS")
          : HttpResponse.json(noSeat),
      sent,
    );
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderPlace(noSeat);

    await user.click(
      await within(dialog).findByRole("radio", { name: /^R-09/ }),
    );
    await user.click(within(dialog).getByRole("button", { name: t.placeSave }));
    expect(
      await within(dialog).findByLabelText(t.skipReasonLabel),
    ).toBeVisible();
    await user.click(option(dialog, "R-07"));
    expect(
      within(dialog).queryByLabelText(t.skipReasonLabel),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: t.placeSave }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(sent[1]?.body).toEqual({
      route_id: r07.id,
      start_date: "2026-12-01",
    });
  });

  it("offers no route request to a student on a full route", async () => {
    serveTrip([r09]);
    servePlace(() => problemResponse(409, "ROUTE_FULL"), []);
    const user = userEvent.setup();
    const { dialog } = renderPlace(rider(8, { rider_type: "student" }));

    await user.click(
      await within(dialog).findByRole("radio", { name: /^R-09/ }),
    );
    await user.click(within(dialog).getByRole("button", { name: t.placeSave }));

    expect(
      await within(dialog).findByText(fill(t.seatFull, { code: "R-09" })),
    ).toBeVisible();
    expect(
      within(dialog).queryByRole("button", { name: /Record route request/ }),
    ).not.toBeInTheDocument();
  });

  it("says when no other route takes the trip", async () => {
    serveTrip([r03]);
    const { dialog } = renderPlace(riding);
    expect(await within(dialog).findByText(t.seatNoOtherRoutes)).toBeVisible();
  });

  it("puts a route error on the choices for screen readers", async () => {
    serveTrip([r07]);
    const user = userEvent.setup();
    const { dialog } = renderPlace(noSeat);

    await within(dialog).findByRole("radio", { name: /^R-07/ });
    await user.click(within(dialog).getByRole("button", { name: t.placeSave }));

    const group = within(dialog).getByRole("radiogroup", {
      name: t.seatRouteLegend,
    });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription(t.seatRouteRequired);
    expect(option(dialog, "R-07")).toHaveAccessibleDescription(
      t.seatRouteRequired,
    );
  });

  it("asks for a boarding area and destination first when they have none", () => {
    const { dialog } = renderPlace(rider(8, { destination_area: null }));
    expect(within(dialog).getByText(t.seatNoTrip)).toBeVisible();
  });
});

describe("EndSeatDialog", () => {
  function serveEnd(answer: () => Response, seen: Sent<Schemas["SeatEnd"]>[]) {
    server.use(
      http.post(
        apiUrl("/v1/riders/{rider_id}/seat/end"),
        async ({ request }) => {
          seen.push({
            body: (await request.json()) as Schemas["SeatEnd"],
            key: request.headers.get("Idempotency-Key"),
          });
          return answer();
        },
      ),
    );
  }

  it("ends an adult's seat at this month's end by default", async () => {
    const sent: Sent<Schemas["SeatEnd"]>[] = [];
    serveEnd(() => HttpResponse.json(riding), sent);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <EndSeatDialog rider={riding} open onOpenChange={onOpenChange} />,
    );
    const dialog = screen.getByRole("dialog", {
      name: fill(t.endTitle, { code: "R-03" }),
    });

    expect(within(dialog).getByText(t.endNote)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: t.endSave }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(sent[0]?.body).toEqual({ end_date: "2026-11-30" });
    expect(sent[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(toast).toHaveBeenCalledWith(t.endedToast);
  });

  it("says a planned move is cancelled too, and explains a refused day", async () => {
    serveEnd(() => validationResponse("end_date"), []);
    const user = userEvent.setup();
    renderWithProviders(
      <EndSeatDialog rider={moving} open onOpenChange={vi.fn()} />,
    );
    const dialog = screen.getByRole("dialog");

    expect(
      within(dialog).getByText(fill(t.endNoteMoving, { code: "R-07" })),
    ).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: t.endSave }));

    expect(await within(dialog).findByText(t.endMonthRefused)).toBeVisible();
    expect(within(dialog).getByLabelText(t.endDayLabel)).toHaveFocus();
  });

  it("keeps a planned move when they leave after it starts", async () => {
    const sent: Sent<Schemas["SeatEnd"]>[] = [];
    serveEnd(() => HttpResponse.json(moving), sent);
    const user = userEvent.setup();
    // Riding R-03 until Nov 30, moving to R-07 on Dec 1.
    const soon = {
      ...moving,
      seat: moving.seat && { ...moving.seat, end_date: "2026-11-30" },
      next_seat: moving.next_seat && {
        ...moving.next_seat,
        start_date: "2026-12-01",
      },
    };
    renderWithProviders(
      <EndSeatDialog rider={soon} open onOpenChange={vi.fn()} />,
    );
    const dialog = screen.getByRole("dialog");

    // This month's end: before the move, which is cancelled.
    expect(
      within(dialog).getByText(fill(t.endNoteMoving, { code: "R-07" })),
    ).toBeVisible();
    await user.selectOptions(
      within(dialog).getByLabelText(t.endDayLabel),
      "2027-01-31",
    );
    expect(
      within(dialog).getByText(
        fill(t.endNoteAfterMove, { code: "R-07", date: "Dec 1, 2026" }),
      ),
    ).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: t.endSave }));
    await waitFor(() =>
      expect(sent[0]?.body).toEqual({ end_date: "2027-01-31" }),
    );
  });

  it("offers only earlier days for a seat already ending", async () => {
    const ending = {
      ...riding,
      seat: riding.seat && { ...riding.seat, end_date: "2027-01-31" },
    };
    renderWithProviders(
      <EndSeatDialog rider={ending} open onOpenChange={vi.fn()} />,
    );
    const dialog = screen.getByRole("dialog");

    const options = within(dialog)
      .getAllByRole("option")
      .map((item) => (item as HTMLOptionElement).value);
    expect(options).toEqual(["2026-11-30", "2026-12-31", "2027-01-31"]);
    expect(
      within(dialog).getByText(
        fill(t.endAlreadyEnding, { date: "Jan 31, 2027", code: "R-03" }),
      ),
    ).toBeVisible();
  });

  it("ends a company rider's seat today by default", async () => {
    const sent: Sent<Schemas["SeatEnd"]>[] = [];
    const seated = {
      ...companyRider,
      seat: riding.seat,
    };
    serveEnd(() => HttpResponse.json(seated), sent);
    const user = userEvent.setup();
    renderWithProviders(
      <EndSeatDialog rider={seated} open onOpenChange={vi.fn()} />,
    );
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByLabelText(t.endDayLabel)).toHaveValue(TODAY);
    await user.click(within(dialog).getByRole("button", { name: t.endSave }));

    await waitFor(() => expect(sent[0]?.body).toEqual({ end_date: TODAY }));
  });
});

describe("KeepSeatDialog", () => {
  it("cancels a move by placing them on the route they hold", async () => {
    const sent: Sent<Schemas["SeatPlacement"]>[] = [];
    servePlace(() => HttpResponse.json(riding), sent);
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <KeepSeatDialog rider={moving} open onClose={onClose} />,
    );
    const dialog = screen.getByRole("alertdialog");

    expect(dialog).toHaveTextContent(
      fill(t.keepMovingDescription, { code: "R-03", next: "R-07" }),
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: fill(t.keepSave, { code: "R-03" }),
      }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sent[0]?.body).toEqual({ route_id: moving.seat?.route_id });
    expect(toast).toHaveBeenCalledWith(t.keptToast);
  });

  it("keeps its words after a refusal reloads the rider", async () => {
    servePlace(() => problemResponse(409, "ALREADY_ON_ROUTE"), []);
    server.use(
      http.get(apiUrl("/v1/riders/{rider_id}"), () =>
        HttpResponse.json(riding),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <KeepSeatDialog rider={moving} open onClose={vi.fn()} />,
    );
    const dialog = screen.getByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: fill(t.keepSave, { code: "R-03" }),
      }),
    );

    expect(
      await within(dialog).findByText(messages.Errors.ALREADY_ON_ROUTE),
    ).toBeVisible();
    expect(dialog).toHaveTextContent(
      fill(t.keepMovingDescription, { code: "R-03", next: "R-07" }),
    );
  });

  it("explains when the seat was given to someone else", async () => {
    servePlace(() => problemResponse(409, "ROUTE_FULL"), []);
    const user = userEvent.setup();
    renderWithProviders(
      <KeepSeatDialog rider={moving} open onClose={vi.fn()} />,
    );
    const dialog = screen.getByRole("alertdialog");
    const keep = within(dialog).getByRole("button", {
      name: fill(t.keepSave, { code: "R-03" }),
    });
    await user.click(keep);

    expect(
      await within(dialog).findByText(fill(t.keepFull, { code: "R-03" })),
    ).toBeVisible();
    expect(keep).toHaveAttribute("aria-disabled", "true");
  });
});

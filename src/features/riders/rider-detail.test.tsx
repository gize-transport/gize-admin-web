import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { fill, problemResponse, serveRole } from "../routes/test-support";
import { RiderDetail } from "./rider-detail";
import {
  companyRider,
  moving,
  noSeat,
  reservedSat,
  riding,
  serveRider,
} from "./test-support";
import type { Schemas } from "../../../tests/msw/server";

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

beforeEach(() => {
  toast.mockClear();
  serveRole("staff");
});

function fact(label: string) {
  const facts = screen.getByRole("group", { name: t.detailLabel });
  return within(facts).getByText(label, { selector: "dt" }).nextElementSibling;
}

async function renderPage(rider: Schemas["RiderRead"], onDeleted?: () => void) {
  serveRider(rider);
  const view = renderWithProviders(
    <RiderDetail riderId={rider.id} variant="page" onDeleted={onDeleted} />,
  );
  await screen.findByRole("heading", { level: 1, name: rider.full_name });
  return view;
}

describe("RiderDetail", () => {
  it("shows an adult's details, the phone in full and their seat", async () => {
    await renderPage(riding);

    expect(screen.getByText(t.typeAdult)).toBeVisible();
    expect(fact(t.phone)).toHaveTextContent("+251911000412");
    expect(fact(t.boardsAt)).toHaveTextContent("CMC");
    expect(fact(t.goesTo)).toHaveTextContent("Mexico");
    expect(fact(t.plan)).toHaveTextContent(t.planRoundTrip);
    expect(fact(t.source)).toHaveTextContent(t.sourceStaff);
    expect(fact(t.openRequests)).toHaveTextContent("0");
    const seat = screen.getByRole("link", {
      name: fill(t.seatRouteLink, { code: "R-03" }),
    });
    expect(seat).toHaveAttribute("href", `/routes/${riding.seat?.route_id}`);
    expect(screen.getByText(t.seatRiding)).toBeVisible();
  });

  it("shows a reservation that starts later and a move to come", async () => {
    await renderPage(moving);

    expect(
      screen.getByText(fill(t.seatUntil, { date: "Nov 30, 2099" })),
    ).toBeVisible();
    expect(screen.getByText(t.nextSeat)).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: fill(t.seatRouteLink, { code: "R-07" }),
      }),
    ).toBeVisible();
    expect(
      screen.getByText(fill(t.seatFrom, { date: "Dec 1, 2099" })),
    ).toBeVisible();
  });

  it("shows a self sign-up's plan with Saturday", async () => {
    await renderPage(reservedSat);

    expect(fact(t.plan)).toHaveTextContent(
      fill(t.planWithSaturday, { plan: t.planMorning }),
    );
    expect(fact(t.source)).toHaveTextContent(t.sourceApp);
    expect(screen.getByText(t.seatReserved)).toBeVisible();
  });

  it("shows a company rider's company and no destination", async () => {
    await renderPage(companyRider);

    expect(
      screen.getByText(fill(t.typeCompanyAt, { company: "Addis Brewery" })),
    ).toBeVisible();
    expect(
      within(fact(t.company) as HTMLElement).getByRole("link", {
        name: "Addis Brewery",
      }),
    ).toHaveAttribute("href", `/companies/${companyRider.company?.id}`);
    expect(screen.queryByText(t.goesTo)).not.toBeInTheDocument();
    expect(fact(t.plan)).toHaveTextContent(t.planCompany);
    expect(screen.getByText(t.noSeatDetail)).toBeVisible();
  });

  it("offers delete to admins only", async () => {
    await renderPage(noSeat);
    expect(screen.getByRole("button", { name: t.edit })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: t.deleteRider }),
    ).not.toBeInTheDocument();
  });

  it("deletes a rider once an admin confirms", async () => {
    serveRole("admin");
    let deleted = false;
    server.use(
      http.delete(apiUrl("/v1/riders/{rider_id}"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    await renderPage(noSeat, onDeleted);

    await user.click(
      await screen.findByRole("button", { name: t.deleteRider }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(
      fill(t.deleteDescription, { name: "Selam Girma" }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: t.deleteRider }),
    );

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleted).toBe(true);
    // No name in the toast: personal data.
    expect(toast).toHaveBeenCalledWith(t.deleted);
  });

  it("explains a delete refused while they hold a seat", async () => {
    serveRole("admin");
    server.use(
      http.delete(apiUrl("/v1/riders/{rider_id}"), () =>
        problemResponse(409, "RIDER_HAS_SEAT", "req-409"),
      ),
    );
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    await renderPage(riding, onDeleted);

    expect(
      await screen.findByText(fill(t.deleteHasSeat, { code: "R-03" })),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: t.deleteRider }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: t.deleteRider }),
    );

    expect(await within(dialog).findByText(t.deleteRefusedSeat)).toBeVisible();
    expect(within(dialog).getByText("req-409")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: t.deleteRider }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("waits out Too many requests before deleting again", async () => {
    serveRole("admin");
    server.use(
      http.delete(apiUrl("/v1/riders/{rider_id}"), () =>
        problemResponse(429, "RATE_LIMITED", "req-429", {
          "Retry-After": "30",
        }),
      ),
    );
    const user = userEvent.setup();
    await renderPage(noSeat);

    await user.click(
      await screen.findByRole("button", { name: t.deleteRider }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: t.deleteRider }),
    );

    expect(await within(dialog).findByText("req-429")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: t.deleteRider }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("offers the seat actions that fit where they stand", async () => {
    const { unmount } = await renderPage(noSeat);
    expect(screen.getByRole("button", { name: t.placeButton })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: t.endButton }),
    ).not.toBeInTheDocument();
    unmount();

    await renderPage(riding);
    expect(screen.getByRole("button", { name: t.moveButton })).toBeVisible();
    expect(screen.getByRole("button", { name: t.endButton })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^Keep on/ }),
    ).not.toBeInTheDocument();
  });

  it("offers to keep a rider who is moving on their route", async () => {
    await renderPage(moving);
    expect(
      screen.getByRole("button", {
        name: fill(t.keepButton, { code: "R-03" }),
      }),
    ).toBeVisible();
  });

  it("records a route request for a full route, filled in with the rider", async () => {
    server.use(
      http.get(apiUrl("/v1/public/routes"), () =>
        HttpResponse.json({
          items: [
            {
              id: "00000000-0000-4000-d000-000000000009",
              code: "R-09",
              origin_area: { id: "a", name: "CMC" },
              destination_area: { id: "b", name: "Mexico" },
              served_areas: [],
              morning_time: "06:30",
              morning_arrival_time: null,
              return_time: "17:30",
              return_arrival_time: null,
              prices: { round_trip: 2400, one_way: 1400, saturday: null },
              status: "active",
              full: true,
            },
          ],
          next_cursor: null,
        }),
      ),
      http.put(apiUrl("/v1/riders/{rider_id}/seat"), () =>
        problemResponse(409, "ROUTE_FULL"),
      ),
    );
    const user = userEvent.setup();
    await renderPage(noSeat);

    await user.click(screen.getByRole("button", { name: t.placeButton }));
    const place = await screen.findByRole("dialog");
    await user.click(
      await within(place).findByRole("radio", { name: /^R-09/ }),
    );
    await user.click(within(place).getByRole("button", { name: t.placeSave }));
    await user.click(
      await within(place).findByRole("button", {
        name: fill(t.seatRecordRequest, { code: "R-09" }),
      }),
    );

    const request = await screen.findByRole("dialog", {
      name: messages.RouteRequests.addTitle,
    });
    const tr = messages.RouteRequests;
    expect(within(request).getByLabelText(tr.kindRouteOption)).toBeChecked();
    expect(
      within(request).getByRole("combobox", { name: tr.routeLabel }),
    ).toHaveTextContent("R-09");
    expect(within(request).getByLabelText(tr.riderNameLabel)).toHaveValue(
      "Selam Girma",
    );
    expect(within(request).getByLabelText(tr.contactPhoneLabel)).toHaveValue(
      noSeat.phone,
    );
  });

  it("says when the rider no longer exists", async () => {
    serveRider();
    renderWithProviders(<RiderDetail riderId={riding.id} variant="page" />);

    expect(await screen.findByText(t.notFoundTitle)).toBeVisible();
  });
});

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { routeRequest } from "../route-requests/test-support";
import {
  fill,
  problemResponse,
  route,
  serveRole,
  validationResponse,
} from "../routes/test-support";
import { SeatOffers } from "./seat-offers";

vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/routes";
  return mockNavigation(state);
});
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.Offers;

startMswServer();

// Noon on 11 November 2026 in Addis Ababa (only Date is faked).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-11T09:00:00Z"));
  toast.mockClear();
  serveRole("staff");
});
afterEach(() => vi.useRealTimers());

const running = route("B-07", 7, {
  status: "active",
  prices: { round_trip: 2400, one_way: 1400, saturday: null },
});
const forming = route("B-01", 1, { status: "forming" });

function offer(
  index: number,
  overrides: Partial<Schemas["OfferRead"]> = {},
): Schemas["OfferRead"] {
  return {
    id: `00000000-0000-4000-8800-${String(index).padStart(12, "0")}`,
    route_id: running.id,
    route_code: "B-07",
    request_id: `00000000-0000-4000-e000-${String(index).padStart(12, "0")}`,
    rider_id: null,
    rider_name: "Dawit Alemu",
    start_date: "2026-12-01",
    status: "open",
    expires_at: "2026-11-13T06:40:00Z",
    skip_reason: null,
    sms_status: "sent",
    created_at: "2026-11-11T06:40:00Z",
    updated_at: "2026-11-11T06:40:00Z",
    ...overrides,
  };
}

const open = offer(1);
const failedSms = offer(2, {
  rider_name: "Selam Bekele",
  sms_status: "failed",
  skip_reason: "Works next to the stop",
});
const accepted = offer(3, {
  rider_name: "Liya Girma",
  status: "accepted",
  rider_id: "00000000-0000-4000-9000-000000000007",
});
const expired = offer(4, { rider_name: "Kidus Tadesse", status: "expired" });

function serveOffers(pages: Schemas["OfferRead"][][]) {
  server.use(
    http.get(apiUrl("/v1/routes/{route_id}/offers"), ({ request }) => {
      const cursor = new URL(request.url).searchParams.get("cursor");
      const index = cursor === null ? 0 : Number(cursor);
      return HttpResponse.json<Schemas["OfferPage"]>({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 1) : null,
      });
    }),
  );
}

function serveWaiting(items: Schemas["RouteRequestRead"][]) {
  server.use(
    http.get(apiUrl("/v1/route-requests"), () =>
      HttpResponse.json<Schemas["RouteRequestPage"]>({
        items,
        next_cursor: null,
      }),
    ),
  );
}

type Sent = { body: Schemas["OfferCreate"]; key: string | null };

function serveCreate(
  answer: (body: Schemas["OfferCreate"]) => Response,
  seen: Sent[],
) {
  server.use(
    http.post(apiUrl("/v1/routes/{route_id}/offers"), async ({ request }) => {
      const body = (await request.json()) as Schemas["OfferCreate"];
      seen.push({ body, key: request.headers.get("Idempotency-Key") });
      return answer(body);
    }),
  );
}

function renderOffers(onRoute = running) {
  return renderWithProviders(
    <SeatOffers route={onRoute} SectionHeading="h2" headingClass="" />,
  );
}

const waitingAdult = routeRequest(11, {
  kind: "route",
  rider_name: "Abebe Kebede",
  created_at: "2026-10-01T07:00:00Z",
});
const waitingLater = routeRequest(12, {
  kind: "route",
  rider_name: "Hana Tesfaye",
  created_at: "2026-10-20T07:00:00Z",
});
const waitingStudent = routeRequest(13, {
  kind: "route",
  rider_type: "student",
  rider_name: "Liya Student",
  school_name: "Lycée",
});

async function openOfferDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: t.offer }));
  return screen.findByRole("dialog", {
    name: fill(t.offerTitle, { code: "B-07" }),
  });
}

describe("SeatOffers: the list", () => {
  it("shows each offer's person, seat month, state, text message and reason", async () => {
    serveOffers([[open, failedSms, accepted, expired]]);
    renderOffers();

    const list = await screen.findByRole("list", { name: t.listLabel });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(
      fill(t.openUntil, { date: "Nov 13, 2026, 9:40" }).replace(/\s$/, ""),
    );
    expect(items[0]).toHaveTextContent(
      fill(t.seatFrom, { month: "December 2026" }),
    );
    expect(items[0]).toHaveTextContent(t.sms.sent);
    expect(
      within(items[0] as HTMLElement).getByRole("link", {
        name: "Dawit Alemu",
      }),
    ).toHaveAttribute("href", `/route-requests/${open.request_id}`);
    expect(
      within(items[0] as HTMLElement).getByRole("button", { name: t.accept }),
    ).toBeVisible();

    expect(items[1]).toHaveTextContent(t.sms.failed);
    expect(items[1]).toHaveTextContent(
      fill(t.skipped, { reason: "Works next to the stop" }),
    );

    expect(items[2]).toHaveTextContent(t.status.accepted);
    expect(
      within(items[2] as HTMLElement).getByRole("link", {
        name: fill(t.openRider, { name: "Liya Girma" }),
      }),
    ).toHaveAttribute("href", `/riders/${accepted.rider_id}`);
    expect(
      within(items[2] as HTMLElement).queryByRole("button"),
    ).not.toBeInTheDocument();
    expect(items[3]).toHaveTextContent(t.status.expired);
  });

  it("shows more offers page by page", async () => {
    serveOffers([[open], [expired]]);
    const user = userEvent.setup();
    renderOffers();

    await screen.findByRole("link", { name: "Dawit Alemu" });
    await user.click(screen.getByRole("button", { name: t.showMore }));
    expect(
      await screen.findByRole("link", { name: "Kidus Tadesse" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: t.showMore }),
    ).not.toBeInTheDocument();
  });

  it("says when there are none, and shows an error with a retry", async () => {
    let fail = true;
    server.use(
      http.get(apiUrl("/v1/routes/{route_id}/offers"), () => {
        if (fail) {
          fail = false;
          return problemResponse(503, "SERVICE_UNAVAILABLE", "req-503");
        }
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );
    const user = userEvent.setup();
    renderOffers();

    expect(await screen.findByText("req-503")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    );
    expect(await screen.findByText(t.none)).toBeVisible();
  });
});

describe("SeatOffers: offering", () => {
  it("offers a running route's seat to whoever has waited longest, from the next 1st", async () => {
    const sent: Sent[] = [];
    serveOffers([[]]);
    serveWaiting([waitingAdult, waitingLater, waitingStudent]);
    serveCreate(() => HttpResponse.json(open, { status: 201 }), sent);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    expect(
      within(dialog).getByRole("radio", { name: t.nextInLine }),
    ).toBeChecked();
    expect(
      await within(dialog).findByRole("radio", { name: "Abebe Kebede" }),
    ).toHaveAccessibleDescription(fill(t.askedOn, { date: "Oct 1, 2026" }));
    // Only adults' requests can be offered a seat.
    expect(
      within(dialog).queryByRole("radio", { name: "Liya Student" }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(t.startLabel)).toHaveValue(
      "2026-12-01",
    );
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.offeredToast));
    expect(sent[0]?.body).toEqual({ start_date: "2026-12-01" });
    expect(sent[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("marks a waiting request that already has an open offer", async () => {
    serveOffers([
      [offer(1, { request_id: waitingAdult.id, rider_name: "Abebe Kebede" })],
    ]);
    serveWaiting([waitingAdult, waitingLater]);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    expect(
      await within(dialog).findByRole("radio", { name: "Abebe Kebede" }),
    ).toHaveAccessibleDescription(
      // ICU may put a narrow no-break space before AM.
      /^Asked Oct 1, 2026 · Already offered, open until Nov 13, 2026, 9:40\sAM$/,
    );
  });

  it("offers a forming route's seat as a reservation, with no month to choose", async () => {
    const sent: Sent[] = [];
    serveOffers([[]]);
    serveWaiting([]);
    serveCreate(() => HttpResponse.json(open, { status: 201 }), sent);
    const user = userEvent.setup();
    renderOffers(forming);

    await user.click(await screen.findByRole("button", { name: t.offer }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(fill(t.formingNote, { month: "December 2026" })),
    ).toBeVisible();
    expect(
      within(dialog).queryByLabelText(t.startLabel),
    ).not.toBeInTheDocument();
    expect(await within(dialog).findByText(t.waitingNone)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));

    await waitFor(() => expect(sent[0]?.body).toEqual({}));
  });

  it("asks for a reason to pass older requests, then sends it with the same key", async () => {
    const sent: Sent[] = [];
    serveOffers([[]]);
    serveWaiting([waitingAdult, waitingLater]);
    serveCreate(
      (body) =>
        body.skip_reason
          ? HttpResponse.json(open, { status: 201 })
          : problemResponse(409, "ROUTE_HAS_WAITING_REQUESTS"),
      sent,
    );
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    await user.click(
      await within(dialog).findByRole("radio", { name: "Hana Tesfaye" }),
    );
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));
    const reason = await within(dialog).findByLabelText(t.reasonLabel);
    await waitFor(() => expect(reason).toHaveFocus());
    expect(within(dialog).getByText(t.reasonNeeded)).toBeVisible();
    await user.type(reason, "Works next to the stop");
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.offeredToast));
    expect(sent[1]?.body).toEqual({
      request_id: waitingLater.id,
      skip_reason: "Works next to the stop",
      start_date: "2026-12-01",
    });
    expect(sent[1]?.key).toBe(sent[0]?.key);
  });

  it("drops the reason when whoever has waited longest is chosen again", async () => {
    const sent: Sent[] = [];
    serveOffers([[]]);
    serveWaiting([waitingAdult, waitingLater]);
    serveCreate(
      (body) =>
        body.request_id
          ? problemResponse(409, "ROUTE_HAS_WAITING_REQUESTS")
          : HttpResponse.json(open, { status: 201 }),
      sent,
    );
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    await user.click(
      await within(dialog).findByRole("radio", { name: "Hana Tesfaye" }),
    );
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));
    await within(dialog).findByLabelText(t.reasonLabel);
    await user.click(within(dialog).getByRole("radio", { name: t.nextInLine }));
    expect(
      within(dialog).queryByLabelText(t.reasonLabel),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));

    await waitFor(() =>
      expect(sent[1]?.body).toEqual({ start_date: "2026-12-01" }),
    );
  });

  it.each([
    ["NO_WAITING_REQUESTS", t.nobodyWaiting],
    ["OFFER_OPEN", t.alreadyOffered],
    ["ROUTE_NOT_READY", t.routeNotReady],
    ["ROUTE_FULL", fill(t.fullRunning, { month: "December 2026" })],
  ] as const)("explains %s", async (code, words) => {
    serveOffers([[]]);
    serveWaiting([]);
    serveCreate(() => problemResponse(409, code, "req-409"), []);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));
    expect(await within(dialog).findByText(words)).toBeVisible();
    expect(within(dialog).getByText("req-409")).toBeVisible();
  });

  it("explains a request that no longer waits for the route on the choices", async () => {
    serveOffers([[]]);
    serveWaiting([waitingAdult]);
    serveCreate(() => validationResponse("request_id"), []);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    await user.click(
      await within(dialog).findByRole("radio", { name: "Abebe Kebede" }),
    );
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));
    expect(await within(dialog).findByText(t.requestRefused)).toBeVisible();
    expect(
      within(dialog).getByRole("radio", { name: "Abebe Kebede" }),
    ).toHaveFocus();
  });
});

describe("SeatOffers: answering", () => {
  it("accepts for someone who said yes on the phone", async () => {
    const keys: (string | null)[] = [];
    serveOffers([[open]]);
    server.use(
      http.post(apiUrl("/v1/offers/{offer_id}/accept"), ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return HttpResponse.json({ ...open, status: "accepted" });
      }),
    );
    const user = userEvent.setup();
    renderOffers();

    await user.click(await screen.findByRole("button", { name: t.accept }));
    const dialog = await screen.findByRole("alertdialog", {
      name: fill(t.acceptTitle, { name: "Dawit Alemu" }),
    });
    expect(dialog).toHaveTextContent(
      fill(t.acceptDescription, { code: "B-07", month: "December 2026" }),
    );
    await user.click(within(dialog).getByRole("button", { name: t.accept }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.acceptedToast));
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([
    ["RIDER_HAS_SEAT", fill(t.riderHasSeat, { code: "B-07" })],
    ["RIDER_EXISTS", t.riderExists],
    ["OFFER_CLOSED", t.closed],
  ] as const)("explains a refused acceptance: %s", async (code, words) => {
    serveOffers([[open]]);
    server.use(
      http.post(apiUrl("/v1/offers/{offer_id}/accept"), () =>
        problemResponse(409, code),
      ),
    );
    const user = userEvent.setup();
    renderOffers();

    await user.click(await screen.findByRole("button", { name: t.accept }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.accept }));
    expect(await within(dialog).findByText(words)).toBeVisible();
    if (code === "OFFER_CLOSED") {
      expect(
        within(dialog).getByRole("button", { name: t.accept }),
      ).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("withdraws an offer, and explains one no longer open", async () => {
    let first = true;
    serveOffers([[open]]);
    server.use(
      http.post(apiUrl("/v1/offers/{offer_id}/withdraw"), () => {
        if (first) {
          first = false;
          return problemResponse(409, "OFFER_CLOSED");
        }
        return HttpResponse.json({ ...open, status: "withdrawn" });
      }),
    );
    const user = userEvent.setup();
    renderOffers();

    await user.click(await screen.findByRole("button", { name: t.withdraw }));
    let dialog = await screen.findByRole("alertdialog", {
      name: fill(t.withdrawTitle, { name: "Dawit Alemu" }),
    });
    await user.click(within(dialog).getByRole("button", { name: t.withdraw }));
    expect(await within(dialog).findByText(t.closed)).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: messages.Common.cancel }),
    );

    await user.click(await screen.findByRole("button", { name: t.withdraw }));
    dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.withdraw }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.withdrawnToast));
  });
});

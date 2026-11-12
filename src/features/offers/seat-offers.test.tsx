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

type QueueItem = Schemas["OfferQueueItem"];

function queued(
  request: Schemas["RouteRequestRead"],
  position: number | null,
  extras: Partial<Omit<QueueItem, "request" | "position">> = {},
): QueueItem {
  return {
    request,
    position,
    offered_before: false,
    not_offerable: null,
    ...extras,
  };
}

/** The route's offer queue (`offers_queue`), page by page; returns the pages asked for. */
function serveQueue(pages: QueueItem[][]) {
  const cursors: (string | null)[] = [];
  server.use(
    http.get(apiUrl("/v1/routes/{route_id}/offer-queue"), ({ request }) => {
      const cursor = new URL(request.url).searchParams.get("cursor");
      cursors.push(cursor);
      const index = cursor === null ? 0 : Number(cursor);
      return HttpResponse.json<Schemas["OfferQueuePage"]>({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 1) : null,
      });
    }),
  );
  return cursors;
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

// The example from backend question 10: Meron is next, Almaz was offered a seat here before,
// Dawit has an open offer elsewhere, and a student's request can't be offered a seat.
const almaz = routeRequest(11, {
  kind: "route",
  rider_name: "Almaz Bekele",
  created_at: "2026-09-01T07:00:00Z",
});
const dawit = routeRequest(12, {
  kind: "route",
  rider_name: "Dawit Haile",
  created_at: "2026-09-05T07:00:00Z",
});
const meron = routeRequest(13, {
  kind: "route",
  rider_name: "Meron Tadesse",
  created_at: "2026-09-10T07:00:00Z",
});
const student = routeRequest(14, {
  kind: "route",
  rider_type: "student",
  rider_name: "Kidist Alemu",
  created_at: "2026-09-12T07:00:00Z",
});
const queue: QueueItem[] = [
  queued(meron, 1),
  queued(almaz, 2, { offered_before: true }),
  queued(dawit, null, { not_offerable: "open_offer" }),
  queued(student, null, { not_offerable: "student" }),
];

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

describe("SeatOffers: keeping the list current", () => {
  it("keeps the loaded offers when the next page fails, and retries that page", async () => {
    // The Retry-After wait runs on the real clock.
    vi.useRealTimers();
    let failNext = true;
    server.use(
      http.get(apiUrl("/v1/routes/{route_id}/offers"), ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        if (cursor === null) {
          return HttpResponse.json({ items: [open], next_cursor: "1" });
        }
        if (failNext) {
          failNext = false;
          return problemResponse(429, "RATE_LIMITED", "req-429", {
            "Retry-After": "1",
          });
        }
        return HttpResponse.json({ items: [expired], next_cursor: null });
      }),
    );
    const user = userEvent.setup();
    renderOffers();

    await screen.findByRole("link", { name: "Dawit Alemu" });
    await user.click(screen.getByRole("button", { name: t.showMore }));
    expect(await screen.findByText("req-429")).toBeVisible();
    expect(screen.getByRole("link", { name: "Dawit Alemu" })).toBeVisible();
    // Retry opens once Retry-After has passed.
    const retry = screen.getByRole("button", {
      name: messages.ProblemAlert.retry,
    });
    await waitFor(
      () => expect(retry).not.toHaveAttribute("aria-disabled", "true"),
      { timeout: 3000 },
    );
    await user.click(retry);
    expect(
      await screen.findByRole("link", { name: "Kidus Tadesse" }),
    ).toBeVisible();
  });

  it("reloads when an open offer's 48 hours pass", async () => {
    let calls = 0;
    server.use(
      http.get(apiUrl("/v1/routes/{route_id}/offers"), () => {
        calls += 1;
        // Its 48 hours ended a moment ago (the clock is fixed at 09:00 UTC).
        const lapsing = offer(1, { expires_at: "2026-11-11T08:59:59Z" });
        return HttpResponse.json({
          items: [calls === 1 ? lapsing : { ...lapsing, status: "expired" }],
          next_cursor: null,
        });
      }),
    );
    renderOffers();

    expect(await screen.findByRole("button", { name: t.accept })).toBeVisible();
    expect(
      await screen.findByText(t.status.expired, {}, { timeout: 3000 }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: t.accept }),
    ).not.toBeInTheDocument();
  });
});

describe("SeatOffers: offering", () => {
  it("names who is next in line and offers a running route's seat to them, from the next 1st", async () => {
    const sent: Sent[] = [];
    serveOffers([[]]);
    serveQueue([queue]);
    serveCreate(() => HttpResponse.json(open, { status: 201 }), sent);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    const next = within(dialog).getByRole("radio", { name: t.nextInLine });
    expect(next).toBeChecked();
    await waitFor(() =>
      expect(next).toHaveAccessibleDescription(
        fill(t.nextInLineIs, { name: "Meron Tadesse", date: "Sep 10, 2026" }),
      ),
    );
    expect(within(dialog).getByLabelText(t.startLabel)).toHaveValue(
      "2026-12-01",
    );
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.offeredToast));
    // The API picks whoever is first when it's sent.
    expect(sent[0]?.body).toEqual({ start_date: "2026-12-01" });
    expect(sent[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("shows the queue in the API's order, numbered, with those that can't be offered last", async () => {
    serveOffers([[]]);
    serveQueue([queue]);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    const almazChoice = await within(dialog).findByRole("radio", {
      name: fill(t.position, { position: 2, name: "Almaz Bekele" }),
    });
    expect(almazChoice).toHaveAccessibleDescription(
      `${fill(t.askedOn, { date: "Sep 1, 2026" })} · ${t.offeredBefore}`,
    );
    expect(almazChoice).toBeEnabled();
    // Meron is next in line: not offered again as a choice ahead of the queue.
    expect(
      within(dialog).queryByRole("radio", { name: /Meron Tadesse/ }),
    ).not.toBeInTheDocument();

    const dawitChoice = within(dialog).getByRole("radio", {
      name: "Dawit Haile",
    });
    expect(dawitChoice).toBeDisabled();
    expect(dawitChoice).toHaveAccessibleDescription(
      `${fill(t.askedOn, { date: "Sep 5, 2026" })} · ${t.notOfferable.open_offer}`,
    );
    const studentChoice = within(dialog).getByRole("radio", {
      name: "Kidist Alemu",
    });
    expect(studentChoice).toBeDisabled();
    expect(studentChoice).toHaveAccessibleDescription(
      `${fill(t.askedOn, { date: "Sep 12, 2026" })} · ${t.notOfferable.student}`,
    );

    const order = within(dialog)
      .getAllByRole("radio")
      .map((radio) => radio.closest("label")?.textContent);
    expect(order).toEqual([
      t.nextInLine,
      fill(t.position, { position: 2, name: "Almaz Bekele" }),
      "Dawit Haile",
      "Kidist Alemu",
    ]);
  });

  it("says when next in line is someone who was offered a seat here before", async () => {
    serveOffers([[]]);
    serveQueue([[queued(almaz, 1, { offered_before: true })]]);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    await waitFor(() =>
      expect(
        within(dialog).getByRole("radio", { name: t.nextInLine }),
      ).toHaveAccessibleDescription(
        `${fill(t.nextInLineIs, { name: "Almaz Bekele", date: "Sep 1, 2026" })} · ${t.offeredBefore}`,
      ),
    );
  });

  it("asks for a reason as soon as someone ahead of the queue is chosen", async () => {
    const sent: Sent[] = [];
    serveOffers([[]]);
    serveQueue([queue]);
    serveCreate(() => HttpResponse.json(open, { status: 201 }), sent);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    await user.click(
      await within(dialog).findByRole("radio", {
        name: fill(t.position, { position: 2, name: "Almaz Bekele" }),
      }),
    );
    const reason = within(dialog).getByLabelText(t.reasonLabel);
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));
    expect(await within(dialog).findByText(t.reasonRequired)).toBeVisible();
    expect(reason).toHaveFocus();
    expect(sent).toHaveLength(0);

    await user.type(reason, "Works next to the stop");
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.offeredToast));
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toEqual({
      request_id: almaz.id,
      skip_reason: "Works next to the stop",
      start_date: "2026-12-01",
    });
  });

  it("drops the reason when next in line is chosen again", async () => {
    const sent: Sent[] = [];
    serveOffers([[]]);
    serveQueue([queue]);
    serveCreate(() => HttpResponse.json(open, { status: 201 }), sent);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    await user.click(
      await within(dialog).findByRole("radio", {
        name: fill(t.position, { position: 2, name: "Almaz Bekele" }),
      }),
    );
    await user.type(within(dialog).getByLabelText(t.reasonLabel), "Nearby");
    await user.click(within(dialog).getByRole("radio", { name: t.nextInLine }));
    expect(
      within(dialog).queryByLabelText(t.reasonLabel),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));

    await waitFor(() =>
      expect(sent[0]?.body).toEqual({ start_date: "2026-12-01" }),
    );
  });

  it("shows more of the queue, numbering on, without repeating anyone", async () => {
    const third = routeRequest(15, {
      kind: "route",
      rider_name: "Hana Tesfaye",
      created_at: "2026-09-20T07:00:00Z",
    });
    serveOffers([[]]);
    const cursors = serveQueue([
      [queued(meron, 1), queued(almaz, 2)],
      // Read a moment later: Almaz again (the queue moved), then the next one.
      [queued(almaz, 2), queued(third, 3)],
    ]);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    await within(dialog).findByRole("radio", { name: /Almaz Bekele/ });
    await user.click(
      within(dialog).getByRole("button", { name: t.showMoreQueue }),
    );
    expect(
      await within(dialog).findByRole("radio", {
        name: fill(t.position, { position: 3, name: "Hana Tesfaye" }),
      }),
    ).toBeVisible();
    expect(
      within(dialog).getAllByRole("radio", { name: /Almaz Bekele/ }),
    ).toHaveLength(1);
    expect(cursors).toEqual([null, "1"]);
    expect(
      within(dialog).queryByRole("button", { name: t.showMoreQueue }),
    ).not.toBeInTheDocument();
  });

  it("says when nobody can be offered the seat", async () => {
    serveOffers([[]]);
    serveQueue([[queued(dawit, null, { not_offerable: "open_offer" })]]);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    await waitFor(() =>
      expect(
        within(dialog).getByRole("radio", { name: t.nextInLine }),
      ).toHaveAccessibleDescription(t.nextInLineNobody),
    );
  });

  it("shows an error loading the queue, with a retry", async () => {
    let fail = true;
    serveOffers([[]]);
    server.use(
      http.get(apiUrl("/v1/routes/{route_id}/offer-queue"), () => {
        if (fail) {
          fail = false;
          return problemResponse(503, "SERVICE_UNAVAILABLE", "req-503");
        }
        return HttpResponse.json({ items: queue, next_cursor: null });
      }),
    );
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    expect(await within(dialog).findByText("req-503")).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: messages.ProblemAlert.retry }),
    );
    expect(
      await within(dialog).findByRole("radio", { name: /Almaz Bekele/ }),
    ).toBeVisible();
  });

  it("offers a forming route's seat as a reservation, with no month to choose", async () => {
    const sent: Sent[] = [];
    serveOffers([[]]);
    serveQueue([[]]);
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

  it("explains a refused reason on its field", async () => {
    serveOffers([[]]);
    serveQueue([queue]);
    serveCreate(() => validationResponse("skip_reason"), []);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    await user.click(
      await within(dialog).findByRole("radio", { name: /Almaz Bekele/ }),
    );
    const reason = within(dialog).getByLabelText(t.reasonLabel);
    await user.type(reason, "x");
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));

    expect(await within(dialog).findByText(t.reasonInvalid)).toBeVisible();
    expect(reason).toHaveFocus();
  });

  it("waits out Too many requests before offering again", async () => {
    serveOffers([[]]);
    serveQueue([[]]);
    serveCreate(
      () =>
        problemResponse(429, "RATE_LIMITED", "req-429", {
          "Retry-After": "30",
        }),
      [],
    );
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));
    expect(await within(dialog).findByText("req-429")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: t.offerSave }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("uses a new Idempotency-Key each time the dialog opens", async () => {
    const sent: Sent[] = [];
    serveOffers([[]]);
    serveQueue([[]]);
    serveCreate(() => HttpResponse.json(open, { status: 201 }), sent);
    const user = userEvent.setup();
    renderOffers();

    for (let round = 0; round < 2; round += 1) {
      const dialog = await openOfferDialog(user);
      await user.click(
        within(dialog).getByRole("button", { name: t.offerSave }),
      );
      await waitFor(() => expect(dialog).not.toBeInTheDocument());
    }
    expect(sent).toHaveLength(2);
    expect(sent[1]?.key).not.toBe(sent[0]?.key);
  });

  it.each([
    ["NO_WAITING_REQUESTS", t.nobodyWaiting],
    ["OFFER_OPEN", t.alreadyOffered],
    ["ROUTE_NOT_READY", t.routeNotReady],
    ["ROUTE_FULL", fill(t.fullRunning, { month: "December 2026" })],
  ] as const)("explains %s", async (code, words) => {
    serveOffers([[]]);
    serveQueue([[]]);
    serveCreate(() => problemResponse(409, code, "req-409"), []);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));
    expect(await within(dialog).findByText(words)).toBeVisible();
    expect(within(dialog).getByText("req-409")).toBeVisible();
  });

  it("explains a request that can no longer be offered, and reloads the queue", async () => {
    serveOffers([[]]);
    const cursors = serveQueue([queue]);
    serveCreate(() => validationResponse("request_id"), []);
    const user = userEvent.setup();
    renderOffers();

    const dialog = await openOfferDialog(user);
    const almazChoice = await within(dialog).findByRole("radio", {
      name: /Almaz Bekele/,
    });
    await user.click(almazChoice);
    await user.type(within(dialog).getByLabelText(t.reasonLabel), "Nearby");
    await user.click(within(dialog).getByRole("button", { name: t.offerSave }));
    expect(await within(dialog).findByText(t.requestRefused)).toBeVisible();
    expect(almazChoice).toHaveFocus();
    await waitFor(() => expect(cursors).toHaveLength(2));
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

  it("sends an acceptance again with the same key after no answer", async () => {
    const keys: (string | null)[] = [];
    serveOffers([[open]]);
    server.use(
      http.post(apiUrl("/v1/offers/{offer_id}/accept"), ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return keys.length === 1
          ? HttpResponse.error()
          : HttpResponse.json({ ...open, status: "accepted" });
      }),
    );
    const user = userEvent.setup();
    renderOffers();

    await user.click(await screen.findByRole("button", { name: t.accept }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.accept }));
    expect(
      await within(dialog).findByText(messages.Problems.network),
    ).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: t.accept }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.acceptedToast));
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it("waits out Too many requests before accepting again", async () => {
    serveOffers([[open]]);
    server.use(
      http.post(apiUrl("/v1/offers/{offer_id}/accept"), () =>
        problemResponse(429, "RATE_LIMITED", "req-429", {
          "Retry-After": "30",
        }),
      ),
    );
    const user = userEvent.setup();
    renderOffers();

    await user.click(await screen.findByRole("button", { name: t.accept }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.accept }));
    expect(await within(dialog).findByText("req-429")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: t.accept }),
    ).toHaveAttribute("aria-disabled", "true");
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

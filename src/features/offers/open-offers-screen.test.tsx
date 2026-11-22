import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { fill, problemResponse, serveRole } from "../routes/test-support";
import { OpenOffersScreen } from "./open-offers-screen";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/offers";
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
const t = messages.OpenOffers;
const tOffers = messages.Offers;

startMswServer();

beforeEach(() => {
  navigation().search = "";
  toast.mockClear();
  serveRole("staff");
});

function offer(
  index: number,
  overrides: Partial<Schemas["OfferRead"]> = {},
): Schemas["OfferRead"] {
  return {
    id: `00000000-0000-4000-8800-${String(index).padStart(12, "0")}`,
    route_id: `00000000-0000-4000-d000-${String(index).padStart(12, "0")}`,
    route_code: "B-07",
    request_id: `00000000-0000-4000-e000-${String(index).padStart(12, "0")}`,
    rider_id: null,
    rider_name: "Dawit Alemu",
    start_date: "2026-12-01",
    status: "open",
    expires_at: "2026-11-13T06:40:00Z",
    skip_reason: null,
    sms_status: "failed",
    created_at: "2026-11-11T06:40:00Z",
    updated_at: "2026-11-11T06:40:00Z",
    ...overrides,
  };
}

const soonest = offer(1, { rider_name: "Meron Haile", route_code: "CMC-1" });
const later = offer(2, {
  rider_name: "Abel Tesfaye",
  route_code: "AYAT-2",
  start_date: "2027-01-01",
  expires_at: "2026-11-14T07:00:00Z",
  sms_status: "sent",
});

/** `offers_list_open`, as a list of pages; what's left after an answer is served next. */
function serveOpenOffers(pages: Schemas["OfferRead"][][], seen: URL[] = []) {
  server.use(
    http.get(apiUrl("/v1/offers"), ({ request }) => {
      const url = new URL(request.url);
      seen.push(url);
      const cursor = url.searchParams.get("cursor");
      const index = cursor === null ? 0 : Number(cursor);
      return HttpResponse.json<Schemas["OfferPage"]>({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 1) : null,
      });
    }),
  );
  return seen;
}

const rows = async () => {
  const table = await screen.findByRole("table", { name: t.tableLabel });
  // Past the loading rows: every row has its links.
  await within(table).findAllByRole("link");
  return within(table).getAllByRole("row").slice(1);
};

describe("OpenOffersScreen", () => {
  it("lists the open offers in the API's order: who asked, route, seat month and when it runs out", async () => {
    const seen = serveOpenOffers([[soonest, later]]);
    renderWithProviders(<OpenOffersScreen />);

    expect(
      screen.getByRole("heading", { level: 1, name: t.title }),
    ).toBeVisible();
    const [first, second] = await rows();
    expect(seen[0]?.searchParams.get("limit")).toBe("25");
    expect(
      within(first!).getByRole("link", { name: "Meron Haile" }),
    ).toHaveAttribute("href", `/route-requests/${soonest.request_id}`);
    expect(within(first!).getByRole("link", { name: "CMC-1" })).toHaveAttribute(
      "href",
      `/routes/${soonest.route_id}`,
    );
    expect(first).toHaveTextContent("December 2026");
    expect(second).toHaveTextContent("January 2027");
    expect(
      within(second!).getByRole("link", { name: "Abel Tesfaye" }),
    ).toBeVisible();
    // Texts are off: nothing about them, sent or not.
    for (const text of Object.values(tOffers.sms)) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([t.colWho, t.colRoute, t.colSeatFrom, t.colRunsOut, t.colAnswer]);
    // Each row's buttons say whose offer they answer.
    expect(
      within(first!).getByRole("button", {
        name: `${tOffers.accept} ${fill(t.forWhom, { name: "Meron Haile" })}`,
      }),
    ).toBeVisible();
    expect(
      within(second!).getByRole("button", {
        name: `${tOffers.withdraw} ${fill(t.forWhom, { name: "Abel Tesfaye" })}`,
      }),
    ).toBeVisible();
  });

  it("accepts an offer for someone who said yes: the same Idempotency-Key on a resend, a new one each opening", async () => {
    const pages = [[soonest, later]];
    serveOpenOffers(pages);
    const keys: (string | null)[] = [];
    server.use(
      http.post(
        apiUrl("/v1/offers/{offer_id}/accept"),
        ({ request, params }) => {
          keys.push(request.headers.get("Idempotency-Key"));
          expect(params.offer_id).toBe(soonest.id);
          // The first two tries fail (the outcome unknown); the third goes through.
          if (keys.length < 3) return problemResponse(500, "INTERNAL_ERROR");
          // Once accepted, it's no longer open.
          pages[0] = [later];
          return HttpResponse.json<Schemas["OfferRead"]>({
            ...soonest,
            status: "accepted",
            rider_id: "00000000-0000-4000-9000-000000000001",
          });
        },
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<OpenOffersScreen />);
    const [first] = await rows();
    const acceptName = `${tOffers.accept} ${fill(t.forWhom, { name: "Meron Haile" })}`;

    // Sent twice in one opening: the same attempt, so the same key.
    await user.click(within(first!).getByRole("button", { name: acceptName }));
    let dialog = await screen.findByRole("alertdialog", {
      name: fill(tOffers.acceptTitle, { name: "Meron Haile" }),
    });
    expect(dialog).toHaveTextContent("CMC-1");
    const confirm = () =>
      within(dialog).getByRole("button", { name: tOffers.accept });
    await user.click(confirm());
    expect(await within(dialog).findByText(/req-123/)).toBeVisible();
    await user.click(confirm());
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).toBe(keys[0]);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    // Opened again: a new attempt, with a new key.
    const [again] = await rows();
    await user.click(within(again!).getByRole("button", { name: acceptName }));
    dialog = await screen.findByRole("alertdialog");
    await user.click(confirm());
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(tOffers.acceptedToast),
    );
    expect(keys).toHaveLength(3);
    expect(keys[2]).not.toBe(keys[0]);
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Meron Haile" })).toBeNull(),
    );
    expect(screen.getByRole("link", { name: "Abel Tesfaye" })).toBeVisible();
  });

  it("keeps Accept disabled while it's sent", async () => {
    serveOpenOffers([[soonest]]);
    let release: () => void = () => {};
    server.use(
      http.post(
        apiUrl("/v1/offers/{offer_id}/accept"),
        () =>
          new Promise<Response>((resolve) => {
            release = () =>
              resolve(
                HttpResponse.json<Schemas["OfferRead"]>({
                  ...soonest,
                  status: "accepted",
                }),
              );
          }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<OpenOffersScreen />);
    const [first] = await rows();

    await user.click(
      within(first!).getByRole("button", {
        name: `${tOffers.accept} ${fill(t.forWhom, { name: "Meron Haile" })}`,
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: tOffers.accept }),
    );
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: tOffers.accept }),
      ).toHaveAttribute("aria-disabled", "true"),
    );
    release();
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(tOffers.acceptedToast),
    );
  });

  it("withdraws an offer when the person said no, and explains one already closed (reading the list again)", async () => {
    const pages = [[soonest, later]];
    const seen = serveOpenOffers(pages);
    let calls = 0;
    server.use(
      http.post(apiUrl("/v1/offers/{offer_id}/withdraw"), () => {
        calls += 1;
        if (calls === 1) return problemResponse(409, "OFFER_CLOSED");
        pages[0] = [soonest];
        return HttpResponse.json<Schemas["OfferRead"]>({
          ...later,
          status: "withdrawn",
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<OpenOffersScreen />);
    const [, second] = await rows();
    const withdrawName = `${tOffers.withdraw} ${fill(t.forWhom, { name: "Abel Tesfaye" })}`;

    await user.click(
      within(second!).getByRole("button", { name: withdrawName }),
    );
    let dialog = await screen.findByRole("alertdialog", {
      name: fill(tOffers.withdrawTitle, { name: "Abel Tesfaye" }),
    });
    await user.click(
      within(dialog).getByRole("button", { name: tOffers.withdraw }),
    );
    expect(await within(dialog).findByText(tOffers.closed)).toBeVisible();
    // A refusal: the offer moved on meanwhile, so the list is read again.
    await waitFor(() => expect(seen.length).toBeGreaterThan(1));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    const [, again] = await rows();
    await user.click(
      within(again!).getByRole("button", { name: withdrawName }),
    );
    dialog = await screen.findByRole("alertdialog");
    // A fresh dialog: the earlier refusal isn't shown.
    expect(within(dialog).queryByText(tOffers.closed)).toBeNull();
    await user.click(
      within(dialog).getByRole("button", { name: tOffers.withdraw }),
    );
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(tOffers.withdrawnToast),
    );
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Abel Tesfaye" })).toBeNull(),
    );
  });

  it("sends the page in the address and offers the next one", async () => {
    navigation().search = "?cursor=1";
    const seen = serveOpenOffers([[soonest], [later], [offer(3)]]);
    renderWithProviders(<OpenOffersScreen />);

    expect(
      await screen.findByRole("link", { name: "Abel Tesfaye" }),
    ).toBeVisible();
    expect(seen[0]?.searchParams.get("cursor")).toBe("1");
    expect(
      screen.getByRole("link", { name: messages.DataTable.nextPage }),
    ).toBeVisible();
  });

  it("waits out a 429's Retry-After before Retry reads the list again", async () => {
    let limited = true;
    server.use(
      http.get(apiUrl("/v1/offers"), () =>
        limited
          ? problemResponse(429, "RATE_LIMITED", "req-429", {
              "Retry-After": "1",
            })
          : HttpResponse.json<Schemas["OfferPage"]>({
              items: [soonest],
              next_cursor: null,
            }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<OpenOffersScreen />);

    expect(await screen.findByText(/req-429/)).toBeVisible();
    const retry = screen.getByRole("button", {
      name: messages.ProblemAlert.retry,
    });
    expect(retry).toHaveAttribute("aria-disabled", "true");
    limited = false;
    await waitFor(() => expect(retry).not.toHaveAttribute("aria-disabled"), {
      timeout: 2500,
    });
    await user.click(retry);
    expect(
      await screen.findByRole("link", { name: "Meron Haile" }),
    ).toBeVisible();
  });

  it("reads the list again once the first offer on it runs out", async () => {
    const runsOut = offer(5, {
      rider_name: "Hana Bekele",
      expires_at: new Date(Date.now() + 300).toISOString(),
    });
    const pages = [[runsOut, later]];
    const seen = serveOpenOffers(pages);
    renderWithProviders(<OpenOffersScreen />);

    expect(
      await screen.findByRole("link", { name: "Hana Bekele" }),
    ).toBeVisible();
    pages[0] = [later];
    await waitFor(
      () =>
        expect(screen.queryByRole("link", { name: "Hana Bekele" })).toBeNull(),
      { timeout: 3000 },
    );
    expect(seen.length).toBeGreaterThan(1);
  });

  it("says when no offer is open", async () => {
    serveOpenOffers([[]]);
    renderWithProviders(<OpenOffersScreen />);

    expect(await screen.findByText(t.emptyTitle)).toBeVisible();
    expect(screen.getByText(t.emptyDescription)).toBeVisible();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("explains a failed read with its request ID, and reads again on Retry", async () => {
    let fail = true;
    server.use(
      http.get(apiUrl("/v1/offers"), () =>
        fail
          ? problemResponse(500, "INTERNAL_ERROR")
          : HttpResponse.json<Schemas["OfferPage"]>({
              items: [soonest],
              next_cursor: null,
            }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<OpenOffersScreen />);

    expect(await screen.findByText(/req-123/)).toBeVisible();
    fail = false;
    await user.click(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    );
    expect(
      await screen.findByRole("link", { name: "Meron Haile" }),
    ).toBeVisible();
  });

  it("shows No permission on a 403", async () => {
    server.use(
      http.get(apiUrl("/v1/offers"), () => problemResponse(403, "FORBIDDEN")),
    );
    renderWithProviders(<OpenOffersScreen />);

    expect(await screen.findByText(messages.NoPermission.title)).toBeVisible();
  });
});

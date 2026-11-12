import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import {
  corporate,
  fill,
  problemResponse,
  route,
  serveRole,
} from "../routes/test-support";
import { LaunchMessages } from "./launch-messages";

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

const t = messages.LaunchMessages;

startMswServer();

// Noon on 11 November 2026 in Addis Ababa (only Date is faked).
const NOW = new Date("2026-11-11T09:00:00Z");
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  toast.mockClear();
  serveRole("staff");
});
afterEach(() => vi.useRealTimers());

// Launched an hour ago (its last change), so it isn't watched as a fresh launch.
const running = route("B-07", 7, {
  status: "active",
  updated_at: "2026-11-11T08:00:00Z",
});

type Message = Schemas["LaunchMessage"];

function message(
  index: number,
  status: Message["status"],
  overrides: Partial<Message> = {},
): Message {
  return {
    rider_id: `00000000-0000-4000-9000-${String(index).padStart(12, "0")}`,
    full_name: `Rider ${index}`,
    start_date: "2026-12-01",
    status,
    attempts: status === "pending" ? 0 : 1,
    ...overrides,
  };
}

function launch(riders: Message[]): Schemas["LaunchMessages"] {
  const count = (status: Message["status"]) =>
    riders.filter((rider) => rider.status === status).length;
  return {
    launch_date: "2026-12-01",
    total: riders.length,
    sent: count("sent"),
    sending: count("sending"),
    unconfirmed: count("unconfirmed"),
    failed: count("failed"),
    pending: count("pending"),
    riders,
  };
}

const abebe = message(1, "sent", { full_name: "Abebe Kebede" });
const hana = message(2, "failed", { full_name: "Hana Tesfaye", attempts: 2 });
const liya = message(3, "unconfirmed", { full_name: "Liya Girma" });
const kidus = message(4, "pending", { full_name: "Kidus Tadesse" });
const mixed = launch([abebe, hana, liya, kidus]);

/** Serves the launch messages: one answer per read (the last repeats); returns the reads. */
function serveMessages(...answers: Schemas["LaunchMessages"][]) {
  const reads: number[] = [];
  server.use(
    http.get(apiUrl("/v1/routes/{route_id}/launch-messages"), () => {
      reads.push(Date.now());
      return HttpResponse.json(
        answers[Math.min(reads.length, answers.length) - 1],
      );
    }),
  );
  return reads;
}

type Sent = { key: string | null };

function serveRetry(answer: () => Response, sent: Sent[]) {
  server.use(
    http.post(
      apiUrl("/v1/routes/{route_id}/launch-messages/retry"),
      ({ request }) => {
        sent.push({ key: request.headers.get("Idempotency-Key") });
        return answer();
      },
    ),
  );
}

function renderSection(onRoute: Schemas["RouteRead"] = running) {
  return renderWithProviders(
    <LaunchMessages route={onRoute} SectionHeading="h2" headingClass="" />,
  );
}

async function openRetry(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: fill(t.retry, { count: 2 }) }),
  );
  return screen.findByRole("alertdialog", { name: t.retryTitle });
}

describe("LaunchMessages: what was sent", () => {
  it("shows the launch, its counts and each rider's text, without phone numbers", async () => {
    serveMessages(mixed);
    renderSection();

    expect(
      await screen.findByText(
        fill(t.launchedFor, { date: "Dec 1, 2026" }) +
          " · 4 riders · 1 sent · 1 may have arrived · 1 not delivered · 1 not sent yet",
      ),
    ).toBeVisible();
    const list = screen.getByRole("list", { name: t.listLabel });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);

    expect(
      within(items[0] as HTMLElement).getByRole("link", {
        name: "Abebe Kebede",
      }),
    ).toHaveAttribute("href", `/riders/${abebe.rider_id}`);
    expect(items[0]).toHaveTextContent(
      fill(t.firstDay, { date: "Dec 1, 2026" }),
    );
    expect(items[0]).toHaveTextContent(t.status.sent);
    expect(items[1]).toHaveTextContent(t.status.failed);
    expect(items[1]).toHaveTextContent("Tried 2 times");
    expect(items[2]).toHaveTextContent(t.status.unconfirmed);
    expect(items[2]).toHaveTextContent(t.unconfirmedHint);
    expect(items[3]).toHaveTextContent(t.status.pending);
    expect(list).not.toHaveTextContent(/\+251|09\d{8}/);
  });

  it("says when the route has no launch messages, and offers no resend", async () => {
    serveMessages({ ...launch([]), launch_date: null });
    renderSection();

    expect(await screen.findByText(t.none)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Send again/ }),
    ).not.toBeInTheDocument();
  });

  it("offers no resend when every text was sent or may have arrived", async () => {
    serveMessages(launch([abebe, liya]));
    renderSection();

    await screen.findByRole("link", { name: "Abebe Kebede" });
    expect(
      screen.queryByRole("button", { name: /Send again/ }),
    ).not.toBeInTheDocument();
  });

  it("isn't shown on a company route, a route not launched, or a draft", async () => {
    const reads = serveMessages(mixed);
    for (const onRoute of [
      corporate,
      route("B-01", 1, { status: "forming" }),
      route("B-02", 2, { status: "draft" }),
    ]) {
      const { unmount } = renderSection(onRoute);
      expect(
        screen.queryByRole("heading", { name: t.title }),
      ).not.toBeInTheDocument();
      unmount();
    }
    expect(reads).toHaveLength(0);
  });

  it("is shown on a paused route", async () => {
    serveMessages(mixed);
    renderSection({ ...running, status: "paused" });

    expect(
      await screen.findByRole("link", { name: "Abebe Kebede" }),
    ).toBeVisible();
  });

  it("shows an error with a retry", async () => {
    let fail = true;
    server.use(
      http.get(apiUrl("/v1/routes/{route_id}/launch-messages"), () => {
        if (fail) {
          fail = false;
          return problemResponse(503, "SERVICE_UNAVAILABLE", "req-503");
        }
        return HttpResponse.json(mixed);
      }),
    );
    const user = userEvent.setup();
    renderSection();

    expect(await screen.findByText("req-503")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    );
    expect(
      await screen.findByRole("link", { name: "Abebe Kebede" }),
    ).toBeVisible();
  });
});

describe("LaunchMessages: keeping it current", () => {
  it("reloads while a text is sending, and stops once none is", async () => {
    const reads = serveMessages(
      launch([abebe, message(5, "sending", { full_name: "Selam Bekele" })]),
      launch([abebe, message(5, "sent", { full_name: "Selam Bekele" })]),
    );
    renderSection();

    const list = await screen.findByRole("list", { name: t.listLabel });
    expect(list).toHaveTextContent(t.status.sending);
    await waitFor(() => expect(reads).toHaveLength(2), { timeout: 5000 });
    await waitFor(() => expect(list).not.toHaveTextContent(t.status.sending));
    // Nothing is sending now: no more reads.
    await new Promise((resolve) => setTimeout(resolve, 3500));
    expect(reads).toHaveLength(2);
  }, 12000);

  it("watches texts not sent yet just after a launch", async () => {
    const reads = serveMessages(
      launch([kidus]),
      launch([{ ...kidus, status: "sent", attempts: 1 }]),
    );
    // Launched a moment ago.
    renderSection({ ...running, updated_at: "2026-11-11T08:59:50Z" });

    await screen.findByRole("link", { name: "Kidus Tadesse" });
    await waitFor(() => expect(reads).toHaveLength(2), { timeout: 5000 });
    expect(
      await screen.findByText(t.status.sent, { selector: "span" }),
    ).toBeVisible();
  }, 10000);

  it("doesn't keep reloading a launch long past whose texts weren't sent", async () => {
    const reads = serveMessages(mixed);
    renderSection();

    await screen.findByRole("link", { name: "Abebe Kebede" });
    await new Promise((resolve) => setTimeout(resolve, 3500));
    expect(reads).toHaveLength(1);
  }, 8000);
});

describe("LaunchMessages: sending again", () => {
  it("confirms, then sends the failed and unsent ones again with an Idempotency-Key", async () => {
    const sent: Sent[] = [];
    const reads = serveMessages(
      mixed,
      launch([
        abebe,
        { ...hana, status: "sent", attempts: 3 },
        liya,
        { ...kidus, status: "sent", attempts: 1 },
      ]),
    );
    serveRetry(() => HttpResponse.json(mixed, { status: 202 }), sent);
    const user = userEvent.setup();
    renderSection();

    const dialog = await openRetry(user);
    expect(dialog).toHaveTextContent(
      "It goes to the 2 riders whose text wasn't delivered or wasn't sent yet.",
    );
    await user.click(
      within(dialog).getByRole("button", { name: t.retryConfirm }),
    );

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.retriedToast));
    expect(sent).toHaveLength(1);
    expect(sent[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    // The texts go out after the answer: the list is watched until they have.
    await waitFor(() => expect(reads.length).toBeGreaterThanOrEqual(2), {
      timeout: 5000,
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Send again/ }),
      ).not.toBeInTheDocument(),
    );
  }, 10000);

  it("says it goes to one rider when only one is left", async () => {
    serveMessages(launch([abebe, hana]));
    const user = userEvent.setup();
    renderSection();

    await user.click(
      await screen.findByRole("button", { name: fill(t.retry, { count: 1 }) }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: t.retryTitle,
    });
    expect(dialog).toHaveTextContent(
      "It goes to the rider whose text wasn't delivered or wasn't sent yet.",
    );
  });

  it("sends again with the same key after no answer, and a new key next time", async () => {
    const sent: Sent[] = [];
    serveMessages(mixed);
    serveRetry(
      () =>
        sent.length === 1
          ? HttpResponse.error()
          : HttpResponse.json(mixed, { status: 202 }),
      sent,
    );
    const user = userEvent.setup();
    renderSection();

    let dialog = await openRetry(user);
    await user.click(
      within(dialog).getByRole("button", { name: t.retryConfirm }),
    );
    expect(
      await within(dialog).findByText(messages.Problems.network),
    ).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: t.retryConfirm }),
    );
    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.retriedToast));
    expect(sent[1]?.key).toBe(sent[0]?.key);

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    dialog = await openRetry(user);
    await user.click(
      within(dialog).getByRole("button", { name: t.retryConfirm }),
    );
    await waitFor(() => expect(sent).toHaveLength(3));
    expect(sent[2]?.key).not.toBe(sent[0]?.key);
  });

  it.each([
    ["IDEMPOTENCY_IN_PROGRESS", 409, messages.Errors.IDEMPOTENCY_IN_PROGRESS],
    ["SERVICE_UNAVAILABLE", 503, messages.Errors.SERVICE_UNAVAILABLE],
  ] as const)(
    "explains %s with its request ID",
    async (code, status, words) => {
      serveMessages(mixed);
      serveRetry(() => problemResponse(status, code, "req-x"), []);
      const user = userEvent.setup();
      renderSection();

      const dialog = await openRetry(user);
      await user.click(
        within(dialog).getByRole("button", { name: t.retryConfirm }),
      );
      expect(await within(dialog).findByText(words)).toBeVisible();
      expect(within(dialog).getByText("req-x")).toBeVisible();
    },
  );

  it("waits out Too many requests before sending again", async () => {
    serveMessages(mixed);
    serveRetry(
      () =>
        problemResponse(429, "RATE_LIMITED", "req-429", {
          "Retry-After": "30",
        }),
      [],
    );
    const user = userEvent.setup();
    renderSection();

    const dialog = await openRetry(user);
    await user.click(
      within(dialog).getByRole("button", { name: t.retryConfirm }),
    );
    expect(await within(dialog).findByText("req-429")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: t.retryConfirm }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});

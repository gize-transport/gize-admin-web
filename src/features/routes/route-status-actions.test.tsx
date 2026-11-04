import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { RouteStatusActions } from "./route-status-actions";
import {
  corporate,
  fill,
  forming,
  problemResponse,
  route,
  validationResponse,
} from "./test-support";

vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.Routes;

startMswServer();

beforeEach(() => toast.mockClear());

const change = (
  to: Schemas["RouteStatus"],
  blocked: Schemas["RouteBlocker"][] = [],
  launchDate: string | null = null,
): Schemas["StatusChange"] => ({
  to,
  ready: blocked.length === 0,
  blocked_by: blocked,
  launch_date: launchDate,
});

/** A draft public route without prices: Start forming is blocked. */
const draft = route("B-03", 6, {
  status_changes: [change("forming", ["PRICES_MISSING"])],
});
/** Forming with 7 of 10: Launch blocked (not enough), Back to draft blocked (riders). */
const formingRoute = {
  ...forming,
  status_changes: [
    change("draft", ["ROUTE_HAS_RIDERS"]),
    change("active", ["NOT_ENOUGH_RIDERS"], "2026-12-01"),
  ],
};
/** Forming and ready: 6 of 5 reserved. */
const ready = route("B-04", 7, {
  status: "forming",
  launch_minimum: 5,
  reserved: 6,
  prices: { round_trip: 2000, one_way: 1200, saturday: null },
  status_changes: [
    change("draft", ["ROUTE_HAS_RIDERS"]),
    change("active", [], "2026-12-01"),
  ],
});
const active = route("B-06", 8, {
  status: "active",
  status_changes: [change("paused")],
});

function serveStatus(
  answer: (body: Schemas["RouteStatusSet"]) => Response,
  sent?: Schemas["RouteStatusSet"][],
) {
  server.use(
    http.put(apiUrl("/v1/routes/{route_id}/status"), async ({ request }) => {
      const body = (await request.json()) as Schemas["RouteStatusSet"];
      sent?.push(body);
      return answer(body);
    }),
  );
}

function serveMonths(months: Schemas["LaunchMonth"][], minimum = 5) {
  server.use(
    http.get(apiUrl("/v1/routes/{route_id}/launch-months"), () =>
      HttpResponse.json<Schemas["RouteLaunchMonths"]>({
        status: "forming",
        launch_minimum: minimum,
        months,
      }),
    ),
  );
}

describe("RouteStatusActions", () => {
  it("shows each move the route allows, a blocked one disabled with its reasons", () => {
    renderWithProviders(<RouteStatusActions route={formingRoute} />);

    // Not enough riders for the earliest month: Launch still opens (a later month may be ready),
    // with the reason shown.
    const launch = screen.getByRole("button", { name: t.moveLaunch });
    expect(launch).not.toHaveAttribute("aria-disabled");
    expect(launch).toHaveAccessibleDescription(
      fill(t.blockedNotEnough, {
        reserved: 7,
        minimum: 10,
        month: "December 2026",
      }),
    );
    const back = screen.getByRole("button", { name: t.moveBackToDraft });
    expect(back).toHaveAttribute("aria-disabled", "true");
    expect(back).toHaveAccessibleDescription(t.blockedRiders);
  });

  it("names the moves of a corporate route and says when its company is inactive", () => {
    renderWithProviders(
      <RouteStatusActions
        route={{
          ...corporate,
          status: "draft",
          status_changes: [change("active", ["COMPANY_INACTIVE"])],
        }}
      />,
    );

    const start = screen.getByRole("button", { name: t.moveStartService });
    expect(start).toHaveAccessibleDescription(t.blockedCompany);
  });

  it("says prices are missing before a route can start forming", () => {
    renderWithProviders(<RouteStatusActions route={draft} />);

    expect(
      screen.getByRole("button", { name: t.moveStartForming }),
    ).toHaveAccessibleDescription(t.blockedPrices);
  });

  it("pauses an active route after confirming", async () => {
    const sent: Schemas["RouteStatusSet"][] = [];
    serveStatus(
      () =>
        HttpResponse.json<Schemas["RouteRead"]>({
          ...active,
          status: "paused",
        }),
      sent,
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteStatusActions route={active} />);

    await user.click(screen.getByRole("button", { name: t.movePause }));
    const dialog = await screen.findByRole("alertdialog", {
      name: fill(t.confirmPauseTitle, { code: "B-06" }),
    });
    expect(dialog).toHaveTextContent(t.confirmPauseDescription);
    await user.click(within(dialog).getByRole("button", { name: t.movePause }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        fill(t.statusChanged, {
          code: "B-06",
          status: messages.RouteStatus.paused,
        }),
      ),
    );
    expect(sent).toEqual([{ status: "paused" }]);
  });

  it("explains a move refused meanwhile, and reloads the route", async () => {
    serveStatus(() => problemResponse(409, "INVALID_STATUS_CHANGE", "req-409"));
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(
      <RouteStatusActions route={active} />,
    );
    queryClient.setQueryData(["routes", "detail", active.id], active);

    await user.click(screen.getByRole("button", { name: t.movePause }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.movePause }));

    expect(await within(dialog).findByText(t.refuseInvalid)).toBeVisible();
    expect(within(dialog).getByText("req-409")).toBeVisible();
    expect(
      queryClient.getQueryState(["routes", "detail", active.id])?.isInvalidated,
    ).toBe(true);
    expect(toast).not.toHaveBeenCalled();
  });

  it("puts focus on the moves after a move, and after a refusal that removed the button", async () => {
    serveStatus(() =>
      HttpResponse.json<Schemas["RouteRead"]>({ ...active, status: "paused" }),
    );
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <RouteStatusActions route={active} />,
    );
    const moves = screen.getByRole("group", { name: t.statusActionsLabel });

    await user.click(screen.getByRole("button", { name: t.movePause }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.movePause }));
    await waitFor(() => expect(moves).toHaveFocus());

    // Refused: the route was paused meanwhile, and reloads without its Pause button.
    serveStatus(() => problemResponse(409, "INVALID_STATUS_CHANGE"));
    await user.click(screen.getByRole("button", { name: t.movePause }));
    const again = await screen.findByRole("alertdialog");
    await user.click(within(again).getByRole("button", { name: t.movePause }));
    await within(again).findByText(t.refuseInvalid);
    rerender(
      <RouteStatusActions
        route={{
          ...active,
          status: "paused",
          status_changes: [change("active")],
        }}
      />,
    );
    await user.click(
      within(again).getByRole("button", { name: messages.Common.cancel }),
    );
    await waitFor(() => expect(moves).toHaveFocus());
  });

  it("launches for a chosen month, defaulting to the route's own launch day", async () => {
    serveMonths([
      { launch_date: "2026-12-01", reserved: 6, ready: true },
      { launch_date: "2027-01-01", reserved: 6, ready: true },
      { launch_date: "2027-02-01", reserved: 3, ready: false },
    ]);
    const sent: Schemas["RouteStatusSet"][] = [];
    serveStatus(
      () =>
        HttpResponse.json<Schemas["RouteRead"]>({
          ...ready,
          status: "active",
          updated_at: "2026-11-03T10:00:00Z",
        }),
      sent,
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteStatusActions route={ready} />);

    await user.click(screen.getByRole("button", { name: t.moveLaunch }));
    const dialog = await screen.findByRole("dialog", {
      name: fill(t.launchTitle, { code: "B-04" }),
    });
    const months = within(dialog).getByRole("radiogroup", {
      name: t.launchMonthsLabel,
    });
    const december = await within(months).findByRole("radio", {
      name: /December 2026/,
    });
    expect(december).toBeChecked();
    // Even for the earliest month: active now, riders start that day.
    expect(
      within(dialog).getByText(
        fill(t.launchStarts, { date: "December 1, 2026" }),
      ),
    ).toBeVisible();
    // Not enough riders: listed, but can't be chosen.
    expect(
      within(months).getByRole("radio", { name: /February 2027/ }),
    ).toBeDisabled();

    await user.click(
      within(months).getByRole("radio", { name: /January 2027/ }),
    );
    expect(
      within(dialog).getByText(
        fill(t.launchStarts, { date: "January 1, 2027" }),
      ),
    ).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: t.moveLaunch }),
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        fill(t.launched, { code: "B-04", date: "January 1, 2027" }),
      ),
    );
    expect(sent).toEqual([{ status: "active", launch_date: "2027-01-01" }]);
  });

  it("explains a launch refused because riders left, and reloads the months", async () => {
    let monthCalls = 0;
    server.use(
      http.get(apiUrl("/v1/routes/{route_id}/launch-months"), () => {
        monthCalls += 1;
        return HttpResponse.json<Schemas["RouteLaunchMonths"]>({
          status: "forming",
          launch_minimum: 5,
          months: [{ launch_date: "2026-12-01", reserved: 6, ready: true }],
        });
      }),
    );
    serveStatus(() => problemResponse(409, "NOT_ENOUGH_RIDERS", "req-riders"));
    const user = userEvent.setup();
    renderWithProviders(<RouteStatusActions route={ready} />);

    await user.click(screen.getByRole("button", { name: t.moveLaunch }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("radio", { name: /December 2026/ });
    await user.click(
      within(dialog).getByRole("button", { name: t.moveLaunch }),
    );

    expect(await within(dialog).findByText(t.refuseNotEnough)).toBeVisible();
    expect(within(dialog).getByText("req-riders")).toBeVisible();
    await waitFor(() => expect(monthCalls).toBe(2));
  });

  it("explains a launch day the API won't take any more", async () => {
    serveMonths([{ launch_date: "2026-12-01", reserved: 6, ready: true }]);
    serveStatus(() => validationResponse("/launch_date"));
    const user = userEvent.setup();
    renderWithProviders(<RouteStatusActions route={ready} />);

    await user.click(screen.getByRole("button", { name: t.moveLaunch }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("radio", { name: /December 2026/ });
    await user.click(
      within(dialog).getByRole("button", { name: t.moveLaunch }),
    );

    expect(await within(dialog).findByText(t.launchDateRefused)).toBeVisible();
  });

  it("says when no month is ready, and can't launch", async () => {
    serveMonths([{ launch_date: "2026-12-01", reserved: 3, ready: false }]);
    const user = userEvent.setup();
    renderWithProviders(<RouteStatusActions route={ready} />);

    await user.click(screen.getByRole("button", { name: t.moveLaunch }));
    const dialog = await screen.findByRole("dialog");

    expect(await within(dialog).findByText(t.launchNoReadyMonth)).toBeVisible();
    const launch = within(dialog).getByRole("button", { name: t.moveLaunch });
    expect(launch).toHaveAttribute("aria-disabled", "true");
    expect(launch).toHaveAccessibleDescription(t.launchNoReadyMonth);
  });

  it("shows a failed months load with its reference and a retry", async () => {
    server.use(
      http.get(apiUrl("/v1/routes/{route_id}/launch-months"), () =>
        problemResponse(503, "SERVICE_UNAVAILABLE", "req-months"),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteStatusActions route={ready} />);

    await user.click(screen.getByRole("button", { name: t.moveLaunch }));
    const dialog = await screen.findByRole("dialog");

    expect(await within(dialog).findByText("req-months")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: messages.ProblemAlert.retry }),
    ).toBeVisible();
  });

  it("keeps the confirm button disabled until Retry-After has passed after a 429", async () => {
    serveStatus(() =>
      problemResponse(429, "RATE_LIMITED", "req-429", { "Retry-After": "1" }),
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteStatusActions route={active} />);

    await user.click(screen.getByRole("button", { name: t.movePause }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: t.movePause });
    await user.click(confirm);

    expect(
      await within(dialog).findByText(messages.Errors.RATE_LIMITED),
    ).toBeVisible();
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    await waitFor(() => expect(confirm).not.toHaveAttribute("aria-disabled"), {
      timeout: 2500,
    });
  });
  it("explains each refusal of a move, with the reference", async () => {
    const answers: [
      Schemas["ErrorCode"],
      string,
      Schemas["RouteRead"],
      string,
    ][] = [
      ["ROUTE_NOT_READY", t.refuseNotReady, active, t.movePause],
      ["ROUTE_HAS_RIDERS", t.refuseHasRiders, active, t.movePause],
    ];
    for (const [code, text, existing, button] of answers) {
      serveStatus(() => problemResponse(409, code, `req-${code}`));
      const user = userEvent.setup();
      const { unmount } = renderWithProviders(
        <RouteStatusActions route={existing} />,
      );
      await user.click(screen.getByRole("button", { name: button }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: button }));
      expect(await within(dialog).findByText(text)).toBeVisible();
      expect(within(dialog).getByText(`req-${code}`)).toBeVisible();
      unmount();
    }
  });

  it("reloads a route deleted meanwhile once the dialog closes", async () => {
    serveStatus(() => problemResponse(404, "NOT_FOUND"));
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(
      <RouteStatusActions route={active} />,
    );
    queryClient.setQueryData(["routes", "detail", active.id], active);

    await user.click(screen.getByRole("button", { name: t.movePause }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.movePause }));
    await within(dialog).findByText(messages.Errors.NOT_FOUND);
    expect(
      queryClient.getQueryState(["routes", "detail", active.id])?.isInvalidated,
    ).toBe(false);
    await user.click(
      within(dialog).getByRole("button", { name: messages.Common.cancel }),
    );

    await waitFor(() =>
      expect(
        queryClient.getQueryState(["routes", "detail", active.id])
          ?.isInvalidated,
      ).toBe(true),
    );
  });

  it("doesn't swap a chosen month that stops being ready for another", async () => {
    let calls = 0;
    server.use(
      http.get(apiUrl("/v1/routes/{route_id}/launch-months"), () => {
        calls += 1;
        return HttpResponse.json<Schemas["RouteLaunchMonths"]>({
          status: "forming",
          launch_minimum: 5,
          months: [
            { launch_date: "2026-12-01", reserved: 6, ready: true },
            // January stops being ready once the months reload.
            {
              launch_date: "2027-01-01",
              reserved: calls === 1 ? 6 : 4,
              ready: calls === 1,
            },
          ],
        });
      }),
    );
    serveStatus(() => problemResponse(409, "NOT_ENOUGH_RIDERS"));
    const user = userEvent.setup();
    renderWithProviders(<RouteStatusActions route={ready} />);

    await user.click(screen.getByRole("button", { name: t.moveLaunch }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      await within(dialog).findByRole("radio", { name: /January 2027/ }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: t.moveLaunch }),
    );

    expect(
      await within(dialog).findByText(
        fill(t.launchChosenGone, { month: "January 2027" }),
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByRole("radio", { name: /December 2026/ }),
    ).not.toBeChecked();
    expect(
      within(dialog).getByRole("button", { name: t.moveLaunch }),
    ).toHaveAttribute("aria-disabled", "true");
  });
  it("launches for a later month that's ready when the earliest isn't", async () => {
    serveMonths(
      [
        { launch_date: "2026-12-01", reserved: 7, ready: false },
        { launch_date: "2027-01-01", reserved: 11, ready: true },
      ],
      10,
    );
    const sent: Schemas["RouteStatusSet"][] = [];
    serveStatus(
      () =>
        HttpResponse.json<Schemas["RouteRead"]>({
          ...formingRoute,
          status: "active",
          updated_at: "2026-11-03T10:00:00Z",
        }),
      sent,
    );
    const user = userEvent.setup();
    renderWithProviders(<RouteStatusActions route={formingRoute} />);

    await user.click(screen.getByRole("button", { name: t.moveLaunch }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByRole("radio", { name: /December 2026/ }),
    ).toBeDisabled();
    // The first ready month is chosen.
    expect(
      within(dialog).getByRole("radio", { name: /January 2027/ }),
    ).toBeChecked();
    await user.click(
      within(dialog).getByRole("button", { name: t.moveLaunch }),
    );

    await waitFor(() =>
      expect(sent).toEqual([{ status: "active", launch_date: "2027-01-01" }]),
    );
  });

  it("keeps other blocked moves unusable", () => {
    renderWithProviders(
      <RouteStatusActions
        route={{
          ...formingRoute,
          status_changes: [
            change(
              "active",
              ["NOT_ENOUGH_RIDERS", "PRICES_MISSING"],
              "2026-12-01",
            ),
          ],
        }}
      />,
    );

    expect(screen.getByRole("button", { name: t.moveLaunch })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

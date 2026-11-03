import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { RoutePricesDialog } from "./route-prices-dialog";
import {
  fill,
  forming,
  problemResponse,
  route,
  student,
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

/** A public draft route without prices. */
const unpriced = route("B-03", 6);

function renderDialog(existing: Schemas["RouteRead"]) {
  const onOpenChange = vi.fn();
  const view = renderWithProviders(
    <RoutePricesDialog open onOpenChange={onOpenChange} route={existing} />,
  );
  return { ...view, onOpenChange, dialog: screen.getByRole("dialog") };
}

const field = (dialog: HTMLElement, label: string) =>
  within(dialog).getByLabelText(label);
const save = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: t.save });

function servePut(
  answer: (body: Schemas["RoutePricesSet"]) => Response,
  sent?: Schemas["RoutePricesSet"][],
) {
  server.use(
    http.put(apiUrl("/v1/routes/{route_id}/prices"), async ({ request }) => {
      const body = (await request.json()) as Schemas["RoutePricesSet"];
      sent?.push(body);
      return answer(body);
    }),
  );
}

describe("RoutePricesDialog", () => {
  it("sets a public route's prices, Saturday included", async () => {
    const sent: Schemas["RoutePricesSet"][] = [];
    servePut(
      (body) =>
        HttpResponse.json<Schemas["RouteRead"]>({
          ...unpriced,
          prices: { saturday: null, ...body },
        }),
      sent,
    );
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderDialog(unpriced);
    expect(dialog).toHaveAccessibleName(fill(t.pricesTitle, { code: "B-03" }));
    // The note is part of the dialog's description, so it's announced on opening.
    expect(dialog).toHaveAccessibleDescription(
      `${t.pricesHint} ${t.pricesFrozenNote}`,
    );

    await user.type(field(dialog, t.roundTripLabel), "2400");
    await user.type(field(dialog, t.oneWayLabel), "1400");
    await user.type(field(dialog, t.saturdayLabel), "300");
    await user.click(save(dialog));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(fill(t.pricesSaved, { code: "B-03" })),
    );
    expect(sent).toEqual([{ round_trip: 2400, one_way: 1400, saturday: 300 }]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clears the Saturday add-on when its field is emptied", async () => {
    const sent: Schemas["RoutePricesSet"][] = [];
    servePut(
      (body) =>
        HttpResponse.json<Schemas["RouteRead"]>({
          ...forming,
          prices: { saturday: null, ...body },
        }),
      sent,
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog(forming);
    expect(field(dialog, t.roundTripLabel)).toHaveValue("2400");

    await user.clear(field(dialog, t.saturdayLabel));
    await user.click(save(dialog));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      round_trip: 2400,
      one_way: 1400,
      saturday: null,
    });
  });

  it("offers no Saturday add-on on a student route", async () => {
    const sent: Schemas["RoutePricesSet"][] = [];
    servePut(() => HttpResponse.json<Schemas["RouteRead"]>(student), sent);
    const user = userEvent.setup();
    const { dialog } = renderDialog(student);

    expect(within(dialog).queryByLabelText(t.saturdayLabel)).toBeNull();
    await user.type(field(dialog, t.roundTripLabel), "1800");
    await user.type(field(dialog, t.oneWayLabel), "1000");
    await user.click(save(dialog));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ round_trip: 1800, one_way: 1000 });
  });

  it("checks the prices before sending and focuses the first problem", async () => {
    const sent: Schemas["RoutePricesSet"][] = [];
    servePut(() => problemResponse(500, "INTERNAL_ERROR"), sent);
    const user = userEvent.setup();
    const { dialog } = renderDialog(unpriced);

    await user.type(field(dialog, t.oneWayLabel), "100001");
    await user.type(field(dialog, t.saturdayLabel), "2.5");
    await user.click(save(dialog));

    const roundTrip = field(dialog, t.roundTripLabel);
    await waitFor(() => expect(roundTrip).toHaveFocus());
    expect(roundTrip).toHaveAccessibleDescription(t.priceInvalid);
    expect(field(dialog, t.oneWayLabel)).toHaveAccessibleDescription(
      t.priceInvalid,
    );
    expect(field(dialog, t.saturdayLabel)).toHaveAccessibleDescription(
      `${t.saturdayHint} ${t.priceInvalid}`,
    );
    expect(sent).toHaveLength(0);
  });

  it("closes without a request when nothing changed", async () => {
    const sent: Schemas["RoutePricesSet"][] = [];
    servePut(() => HttpResponse.json<Schemas["RouteRead"]>(forming), sent);
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderDialog(forming);

    await user.click(save(dialog));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(sent).toHaveLength(0);
    expect(toast).not.toHaveBeenCalled();
  });

  it("explains the API's refusals, with the reference", async () => {
    const answers: [Response, string][] = [
      [
        problemResponse(409, "ROUTE_HAS_NO_PRICES", "req-a"),
        t.noPricesForCorporate,
      ],
      [problemResponse(403, "FORBIDDEN", "req-a"), t.pricesAdminOnly],
      [
        problemResponse(503, "SERVICE_UNAVAILABLE", "req-a"),
        messages.Errors.SERVICE_UNAVAILABLE,
      ],
    ];
    for (const [answer, text] of answers) {
      servePut(() => answer.clone());
      const user = userEvent.setup();
      const { dialog, unmount } = renderDialog(unpriced);
      await user.type(field(dialog, t.roundTripLabel), "2400");
      await user.type(field(dialog, t.oneWayLabel), "1400");
      await user.click(save(dialog));
      expect(await within(dialog).findByText(text)).toBeVisible();
      expect(within(dialog).getByText("req-a")).toBeVisible();
      unmount();
    }
  });

  it("puts a field the API refuses on that field", async () => {
    servePut(() => validationResponse("/saturday", "out_of_range"));
    const user = userEvent.setup();
    const { dialog } = renderDialog(unpriced);

    await user.type(field(dialog, t.roundTripLabel), "2400");
    await user.type(field(dialog, t.oneWayLabel), "1400");
    await user.type(field(dialog, t.saturdayLabel), "300");
    await user.click(save(dialog));

    const saturday = field(dialog, t.saturdayLabel);
    await waitFor(() =>
      expect(saturday).toHaveAccessibleDescription(
        `${t.saturdayHint} ${messages.ValidationReasons.out_of_range}`,
      ),
    );
    expect(saturday).toHaveFocus();
  });

  it("keeps Save disabled while sending and until Retry-After has passed", async () => {
    let release = () => {};
    server.use(
      http.put(apiUrl("/v1/routes/{route_id}/prices"), async () => {
        await new Promise<void>((resolve) => (release = resolve));
        return problemResponse(429, "RATE_LIMITED", "req-429", {
          "Retry-After": "1",
        });
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog(unpriced);

    await user.type(field(dialog, t.roundTripLabel), "2400");
    await user.type(field(dialog, t.oneWayLabel), "1400");
    await user.click(save(dialog));
    await waitFor(() =>
      expect(save(dialog)).toHaveAttribute("aria-busy", "true"),
    );
    release();

    expect(
      await within(dialog).findByText(messages.Errors.RATE_LIMITED),
    ).toBeVisible();
    expect(save(dialog)).toHaveAttribute("aria-disabled", "true");
    await waitFor(
      () => expect(save(dialog)).not.toHaveAttribute("aria-disabled"),
      { timeout: 2500 },
    );
  });

  it("refreshes the route when it was deleted meanwhile, once the dialog closes", async () => {
    servePut(() => problemResponse(404, "NOT_FOUND"));
    const user = userEvent.setup();
    const { dialog, queryClient } = renderDialog(unpriced);
    queryClient.setQueryData(["routes", "detail", unpriced.id], unpriced);

    await user.type(field(dialog, t.roundTripLabel), "2400");
    await user.type(field(dialog, t.oneWayLabel), "1400");
    await user.click(save(dialog));
    expect(
      await within(dialog).findByText(messages.Errors.NOT_FOUND),
    ).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: messages.Common.cancel }),
    );

    await waitFor(() =>
      expect(
        queryClient.getQueryState(["routes", "detail", unpriced.id])
          ?.isInvalidated,
      ).toBe(true),
    );
  });
  it("never reads text that isn't a whole number as no Saturday add-on", async () => {
    const sent: Schemas["RoutePricesSet"][] = [];
    servePut(() => HttpResponse.json<Schemas["RouteRead"]>(forming), sent);
    const user = userEvent.setup();
    const { dialog } = renderDialog(forming);

    const saturday = field(dialog, t.saturdayLabel);
    await user.clear(saturday);
    await user.type(saturday, "350 birr");
    await user.click(save(dialog));

    await waitFor(() =>
      expect(saturday).toHaveAttribute("aria-invalid", "true"),
    );
    expect(saturday).toHaveAccessibleDescription(
      `${t.saturdayHint} ${t.priceInvalid}`,
    );
    expect(sent).toHaveLength(0);
  });

  it("reads the role again when the API says this person isn't an admin", async () => {
    servePut(() => problemResponse(403, "FORBIDDEN"));
    const user = userEvent.setup();
    const { dialog, queryClient } = renderDialog(unpriced);
    queryClient.setQueryData(["staff", "me"], { role: "admin" });

    await user.type(field(dialog, t.roundTripLabel), "2400");
    await user.type(field(dialog, t.oneWayLabel), "1400");
    await user.click(save(dialog));

    expect(await within(dialog).findByText(t.pricesAdminOnly)).toBeVisible();
    expect(queryClient.getQueryState(["staff", "me"])?.isInvalidated).toBe(
      true,
    );
  });
});

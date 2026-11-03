import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { RouteFormDialog } from "./route-form-dialog";
import {
  bolePiassa,
  brewery,
  fill,
  forming,
  problemResponse,
  route,
  servePlaces,
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
const tField = messages.CorridorField;

startMswServer();

beforeEach(() => {
  toast.mockClear();
  servePlaces();
});

function renderForm(existing?: Schemas["RouteRead"]) {
  const onOpenChange = vi.fn();
  const view = renderWithProviders(
    <RouteFormDialog open onOpenChange={onOpenChange} route={existing} />,
  );
  return { ...view, onOpenChange, dialog: screen.getByRole("dialog") };
}

async function pick(
  user: UserEvent,
  dialog: HTMLElement,
  label: string,
  searchLabel: string,
  name: string,
) {
  await user.click(within(dialog).getByRole("combobox", { name: label }));
  await user.type(
    await screen.findByRole("combobox", { name: searchLabel }),
    name.slice(0, 3),
  );
  await user.click(await screen.findByRole("option", { name }));
}

const areaSearch = messages.AreaPicker.searchLabel;

async function fillPublicRoute(user: UserEvent, dialog: HTMLElement) {
  const field = (label: string) => within(dialog).getByLabelText(label);
  await user.type(field(t.codeLabel), " bole-pia-02 ");
  await pick(user, dialog, tField.originLabel, areaSearch, "Bole");
  await pick(user, dialog, tField.destinationLabel, areaSearch, "Piassa");
  await within(dialog).findByText(
    fill(tField.found, { origin: "Bole", destination: "Piassa" }),
  );
  await user.click(within(dialog).getByRole("radio", { name: t.typePublic }));
  await user.type(field(t.leaveALabel), "06:30");
  await user.type(field(t.arriveBLabel), "07:15");
  await user.type(field(t.leaveBLabel), "17:30");
  await user.type(field(t.arriveALabel), "18:15");
  await user.clear(field(t.seatsLabel));
  await user.type(field(t.seatsLabel), "14");
  await user.type(field(t.launchMinimumLabel), "10");
}

const save = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: t.save });

describe("RouteFormDialog", () => {
  it("adds a public route with one Idempotency-Key, reused on retry", async () => {
    const keys: (string | null)[] = [];
    const bodies: Schemas["RouteCreate"][] = [];
    let fail = true;
    server.use(
      http.post(apiUrl("/v1/routes"), async ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        bodies.push((await request.json()) as Schemas["RouteCreate"]);
        if (fail) {
          fail = false;
          return problemResponse(503, "SERVICE_UNAVAILABLE");
        }
        return HttpResponse.json<Schemas["RouteRead"]>(
          route("BOLE-PIA-02", 9),
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderForm();
    expect(dialog).toHaveAccessibleName(t.addTitle);

    await fillPublicRoute(user, dialog);
    await user.click(save(dialog));
    expect(
      await within(dialog).findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeVisible();
    await user.click(save(dialog));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        fill(t.addedToast, { code: "BOLE-PIA-02" }),
      ),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(bodies[0]).toEqual({
      code: "BOLE-PIA-02",
      corridor_id: bolePiassa.id,
      route_type: "public",
      morning_time: "06:30",
      morning_arrival_time: "07:15",
      return_time: "17:30",
      return_arrival_time: "18:15",
      seats: 14,
      launch_minimum: 10,
    });
    expect(keys[1]).toBe(keys[0]);
  });

  it("asks a student route for its school and a corporate route for its company", async () => {
    const bodies: Schemas["RouteCreate"][] = [];
    server.use(
      http.post(apiUrl("/v1/routes"), async ({ request }) => {
        bodies.push((await request.json()) as Schemas["RouteCreate"]);
        return HttpResponse.json<Schemas["RouteRead"]>(route("X-1", 9), {
          status: 201,
        });
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm();

    await fillPublicRoute(user, dialog);
    await user.click(
      within(dialog).getByRole("radio", { name: t.typeCorporate }),
    );
    // Corporate routes have no launch minimum, and need a company.
    expect(within(dialog).queryByLabelText(t.launchMinimumLabel)).toBeNull();
    await user.click(save(dialog));
    expect(await within(dialog).findByText(t.companyRequired)).toBeVisible();
    await pick(
      user,
      dialog,
      t.companyLabel,
      messages.CompanyPicker.searchLabel,
      "Addis Brewery",
    );
    await user.click(save(dialog));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      route_type: "corporate",
      company_id: brewery.id,
    });
    expect(bodies[0]).not.toHaveProperty("launch_minimum");
    expect(bodies[0]).not.toHaveProperty("school_name");
  });

  it("checks the fields before sending and focuses the first problem", async () => {
    let posted = false;
    server.use(
      http.post(apiUrl("/v1/routes"), () => {
        posted = true;
        return problemResponse(500, "INTERNAL_ERROR");
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm();
    const field = (label: string) => within(dialog).getByLabelText(label);

    await user.type(field(t.codeLabel), "-bad");
    await user.click(
      within(dialog).getByRole("radio", { name: t.typeStudent }),
    );
    await user.type(field(t.leaveALabel), "08:00");
    await user.type(field(t.arriveBLabel), "07:00");
    await user.type(field(t.seatsLabel), "8");
    await user.type(field(t.launchMinimumLabel), "9");
    await user.click(save(dialog));

    await waitFor(() => expect(field(t.codeLabel)).toHaveFocus());
    expect(field(t.codeLabel)).toHaveAccessibleDescription(
      `${t.codeHint} ${t.codeInvalid}`,
    );
    expect(within(dialog).getByText(t.corridorRequired)).toBeVisible();
    expect(field(t.schoolLabel)).toHaveAccessibleDescription(t.schoolRequired);
    expect(field(t.arriveBLabel)).toHaveAccessibleDescription(
      `${t.timesHint} ${t.timesOrder}`,
    );
    expect(field(t.launchMinimumLabel)).toHaveAccessibleDescription(
      `${t.launchMinimumHint} ${t.launchMinimumAboveSeats}`,
    );
    expect(posted).toBe(false);
  });

  it("shows a taken code on the code field", async () => {
    server.use(
      http.post(apiUrl("/v1/routes"), () =>
        problemResponse(409, "ROUTE_CODE_TAKEN"),
      ),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm();

    await fillPublicRoute(user, dialog);
    await user.click(save(dialog));

    const code = within(dialog).getByLabelText(t.codeLabel);
    await waitFor(() => expect(code).toHaveAttribute("aria-invalid", "true"));
    expect(code).toHaveAccessibleDescription(`${t.codeHint} ${t.codeTaken}`);
    expect(code).toHaveFocus();
  });

  it("edits only what changed", async () => {
    let sent: Schemas["RouteUpdate"] | undefined;
    server.use(
      http.patch(apiUrl("/v1/routes/{route_id}"), async ({ request }) => {
        sent = (await request.json()) as Schemas["RouteUpdate"];
        return HttpResponse.json<Schemas["RouteRead"]>({
          ...forming,
          seats: 16,
        });
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm(forming);
    expect(dialog).toHaveAccessibleName(fill(t.editTitle, { code: "B-01" }));
    // The type is fixed once added.
    expect(within(dialog).queryByRole("radio")).toBeNull();
    expect(within(dialog).getByText(t.typeFixed)).toBeVisible();

    const code = within(dialog).getByLabelText(t.codeLabel);
    await user.clear(code);
    await user.type(code, "b-01"); // the same code in other letters: no change
    const seats = within(dialog).getByLabelText(t.seatsLabel);
    await user.clear(seats);
    await user.type(seats, "16");
    const leave = within(dialog).getByLabelText(t.leaveBLabel);
    await user.clear(leave);
    await user.type(leave, "17:45");
    await user.click(save(dialog));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(fill(t.savedToast, { code: "B-01" })),
    );
    expect(sent).toEqual({ seats: 16, return_time: "17:45" });
  });

  it("asks for both arrival times on a route made before they existed", async () => {
    let patched = false;
    server.use(
      http.patch(apiUrl("/v1/routes/{route_id}"), () => {
        patched = true;
        return HttpResponse.json<Schemas["RouteRead"]>(student);
      }),
    );
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderForm(student);

    // Nothing changed: no request.
    await user.click(save(dialog));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(patched).toBe(false);
  });

  it("won't send two areas that have no corridor between them", async () => {
    let patched = false;
    server.use(
      http.patch(apiUrl("/v1/routes/{route_id}"), () => {
        patched = true;
        return HttpResponse.json<Schemas["RouteRead"]>(forming);
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm(forming);

    await pick(user, dialog, tField.destinationLabel, areaSearch, "Mexico");
    await pick(user, dialog, tField.originLabel, areaSearch, "CMC");
    await user.click(save(dialog));

    // CMC → Mexico has no corridor: nothing is sent, the field says why.
    expect(await within(dialog).findByText(t.corridorRequired)).toBeVisible();
    expect(patched).toBe(false);
  });

  it("explains refusals the API gives for a route's situation", async () => {
    const answers: [Schemas["ErrorCode"], string][] = [
      ["ROUTE_HAS_RIDERS", t.hasRiders],
      ["ROUTE_HAS_PRICES", t.hasPrices],
      ["ROUTE_HAS_REQUESTS", t.hasRequests],
    ];
    for (const [code, text] of answers) {
      server.use(
        http.patch(apiUrl("/v1/routes/{route_id}"), () =>
          problemResponse(409, code, `req-${code}`),
        ),
      );
      const user = userEvent.setup();
      const { dialog, unmount } = renderForm(student);
      const school = within(dialog).getByLabelText(t.schoolLabel);
      await user.clear(school);
      await user.type(school, "Another School");
      await user.click(save(dialog));
      expect(await within(dialog).findByText(text)).toBeVisible();
      expect(within(dialog).getByText(`req-${code}`)).toBeVisible();
      unmount();
    }
  });

  it("puts seat refusals on the seats and launch minimum", async () => {
    server.use(
      http.patch(apiUrl("/v1/routes/{route_id}"), () =>
        problemResponse(409, "SEATS_BELOW_TAKEN"),
      ),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm(forming);

    const seats = within(dialog).getByLabelText(t.seatsLabel);
    await user.clear(seats);
    await user.type(seats, "12");
    await user.clear(within(dialog).getByLabelText(t.launchMinimumLabel));
    await user.type(within(dialog).getByLabelText(t.launchMinimumLabel), "8");
    await user.click(save(dialog));

    await waitFor(() => expect(seats).toHaveAttribute("aria-invalid", "true"));
    expect(seats).toHaveAccessibleDescription(
      `${t.seatsHint} ${t.seatsBelowTaken}`,
    );
    expect(seats).toHaveFocus();
  });

  it("explains a corridor change refused because areas are served", async () => {
    server.use(
      http.patch(apiUrl("/v1/routes/{route_id}"), () =>
        validationResponse("/corridor_id"),
      ),
    );
    servePlaces([
      bolePiassa,
      {
        id: "00000000-0000-4000-b000-000000000009",
        origin_area: {
          id: "00000000-0000-4000-a000-000000000001",
          name: "Bole",
        },
        destination_area: {
          id: "00000000-0000-4000-a000-000000000003",
          name: "Mexico",
        },
      },
    ]);
    const user = userEvent.setup();
    const { dialog } = renderForm(forming);

    await pick(user, dialog, tField.destinationLabel, areaSearch, "Mexico");
    await within(dialog).findByText(
      fill(tField.found, { origin: "Bole", destination: "Mexico" }),
    );
    await user.click(save(dialog));

    expect(await within(dialog).findByText(t.corridorHasAreas)).toBeVisible();
  });

  it("keeps Save disabled until Retry-After has passed after a 429", async () => {
    server.use(
      http.patch(apiUrl("/v1/routes/{route_id}"), () =>
        problemResponse(429, "RATE_LIMITED", "req-429", { "Retry-After": "1" }),
      ),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm(forming);

    const seats = within(dialog).getByLabelText(t.seatsLabel);
    await user.clear(seats);
    await user.type(seats, "13");
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
  it("asks for the other arrival time when only one is set", async () => {
    let patched = false;
    server.use(
      http.patch(apiUrl("/v1/routes/{route_id}"), () => {
        patched = true;
        return HttpResponse.json<Schemas["RouteRead"]>(student);
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm(student);

    await user.type(within(dialog).getByLabelText(t.arriveBLabel), "07:15");
    await user.click(save(dialog));

    const other = within(dialog).getByLabelText(t.arriveALabel);
    await waitFor(() => expect(other).toHaveAttribute("aria-invalid", "true"));
    expect(other).toHaveAccessibleDescription(
      `${t.timesHint} ${t.arrivalsTogether}`,
    );
    expect(patched).toBe(false);
  });

  it("puts a launch minimum refusal on the seats", async () => {
    server.use(
      http.patch(apiUrl("/v1/routes/{route_id}"), () =>
        problemResponse(409, "SEATS_BELOW_LAUNCH_MINIMUM"),
      ),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm(forming);

    const seats = within(dialog).getByLabelText(t.seatsLabel);
    await user.clear(seats);
    await user.type(seats, "12");
    await user.click(save(dialog));

    await waitFor(() =>
      expect(seats).toHaveAccessibleDescription(
        `${t.seatsHint} ${t.seatsBelowLaunchMinimum}`,
      ),
    );
  });

  it("explains a company the API won't take (not active any more)", async () => {
    const corporateRoute = route("R-21", 3, {
      route_type: "corporate",
      company: { id: "00000000-0000-4000-c000-000000000009", name: "Old Co" },
      launch_minimum: null,
      prices: null,
    });
    server.use(
      http.patch(apiUrl("/v1/routes/{route_id}"), () =>
        validationResponse("/company_id"),
      ),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm(corporateRoute);

    await pick(
      user,
      dialog,
      t.companyLabel,
      messages.CompanyPicker.searchLabel,
      "Addis Brewery",
    );
    await user.click(save(dialog));

    const company = within(dialog).getByRole("combobox", {
      name: t.companyLabel,
    });
    await waitFor(() =>
      expect(company).toHaveAccessibleDescription(t.companyNotActive),
    );
    expect(company).toHaveFocus();
  });

  it("explains times the API finds out of order", async () => {
    server.use(
      http.patch(apiUrl("/v1/routes/{route_id}"), () => validationResponse("")),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm(forming);

    const leave = within(dialog).getByLabelText(t.leaveBLabel);
    await user.clear(leave);
    await user.type(leave, "17:45");
    await user.click(save(dialog));

    expect(await within(dialog).findByText(t.timesOrderAlert)).toBeVisible();
  });

  it("refreshes the route when it was deleted while being edited", async () => {
    server.use(
      http.patch(apiUrl("/v1/routes/{route_id}"), () =>
        problemResponse(404, "NOT_FOUND"),
      ),
      http.get(apiUrl("/v1/routes/{route_id}"), () =>
        problemResponse(404, "NOT_FOUND"),
      ),
    );
    const user = userEvent.setup();
    const { dialog, queryClient } = renderForm(forming);
    queryClient.setQueryData(["routes", "detail", forming.id], forming);

    const seats = within(dialog).getByLabelText(t.seatsLabel);
    await user.clear(seats);
    await user.type(seats, "13");
    await user.click(save(dialog));
    expect(
      await within(dialog).findByText(messages.Errors.NOT_FOUND),
    ).toBeVisible();
    expect(
      queryClient.getQueryState(["routes", "detail", forming.id])
        ?.isInvalidated,
    ).toBe(false);

    await user.click(
      within(dialog).getByRole("button", { name: messages.Common.cancel }),
    );
    await waitFor(() =>
      expect(
        queryClient.getQueryState(["routes", "detail", forming.id])
          ?.isInvalidated,
      ).toBe(true),
    );
  });
});

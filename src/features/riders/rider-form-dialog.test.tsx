import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import {
  fill,
  problemResponse,
  servePlaces,
  serveRole,
  validationResponse,
} from "../routes/test-support";
import { RiderFormDialog } from "./rider-form-dialog";
import {
  companyRider,
  rider,
  riderId,
  riding,
  serveLookup,
} from "./test-support";

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
  servePlaces();
});

function renderForm(
  props: { rider?: Schemas["RiderRead"]; initialPhone?: string } = {},
) {
  const onOpenChange = vi.fn();
  const onRecorded = vi.fn();
  renderWithProviders(
    <RiderFormDialog
      open
      onOpenChange={onOpenChange}
      onRecorded={onRecorded}
      {...props}
    />,
  );
  return { onOpenChange, onRecorded, dialog: screen.getByRole("dialog") };
}

/** What the API was sent, with the Idempotency-Key. */
function serveCreate(
  answer: (body: Schemas["RiderCreate"]) => Response,
  seen: { body: Schemas["RiderCreate"]; key: string | null }[],
) {
  server.use(
    http.post(apiUrl("/v1/riders"), async ({ request }) => {
      const body = (await request.json()) as Schemas["RiderCreate"];
      seen.push({ body, key: request.headers.get("Idempotency-Key") });
      return answer(body);
    }),
  );
}

function serveUpdate(
  answer: (body: Schemas["RiderUpdate"]) => Response,
  seen: Schemas["RiderUpdate"][],
) {
  server.use(
    http.patch(apiUrl("/v1/riders/{rider_id}"), async ({ request }) => {
      const body = (await request.json()) as Schemas["RiderUpdate"];
      seen.push(body);
      return answer(body);
    }),
  );
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

const pickArea = (
  user: UserEvent,
  dialog: HTMLElement,
  label: string,
  name: string,
) => pick(user, dialog, label, messages.AreaPicker.searchLabel, name);

async function fillAdult(user: UserEvent, dialog: HTMLElement) {
  await user.type(within(dialog).getByLabelText(t.nameLabel), "Abebe Kebede");
  await user.type(within(dialog).getByLabelText(t.phoneLabel), "0911 22 33 44");
  await pickArea(user, dialog, t.homeLabel, "CMC");
  await pickArea(user, dialog, t.destinationLabel, "Mexico");
  await user.click(within(dialog).getByLabelText(t.planRoundTripOption));
}

const button = (dialog: HTMLElement, name: string) =>
  within(dialog).getByRole("button", { name });

describe("RiderFormDialog: recording", () => {
  it("records an adult from a phone call", async () => {
    const seen: { body: Schemas["RiderCreate"]; key: string | null }[] = [];
    const added = rider(9, { full_name: "Abebe Kebede" });
    serveCreate(() => HttpResponse.json(added, { status: 201 }), seen);
    const user = userEvent.setup();
    const { dialog, onRecorded } = renderForm();

    await fillAdult(user, dialog);
    await user.click(within(dialog).getByLabelText(t.saturdayLabel));
    await user.click(button(dialog, t.record));

    await waitFor(() => expect(onRecorded).toHaveBeenCalledWith(added));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(seen[0]?.body).toEqual({
      rider_type: "adult",
      full_name: "Abebe Kebede",
      phone: "0911 22 33 44",
      home_area_id: "00000000-0000-4000-a000-000000000004",
      destination_area_id: "00000000-0000-4000-a000-000000000003",
      plan: "round_trip",
      saturday_addon: true,
    });
    expect(toast).toHaveBeenCalledWith(t.recordedToast);
  });

  it("records a company rider: their company and where they board", async () => {
    const seen: { body: Schemas["RiderCreate"]; key: string | null }[] = [];
    serveCreate(() => HttpResponse.json(companyRider, { status: 201 }), seen);
    const user = userEvent.setup();
    const { dialog, onRecorded } = renderForm();

    await user.click(within(dialog).getByLabelText(t.typeCompanyOption));
    expect(
      within(dialog).queryByRole("combobox", { name: t.destinationLabel }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("group", { name: t.planLegend }),
    ).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(t.nameLabel), "Hirut Bekele");
    await user.type(within(dialog).getByLabelText(t.phoneLabel), "0911000303");
    await pick(
      user,
      dialog,
      t.companyLabel,
      messages.CompanyPicker.searchLabel,
      "Addis Brewery",
    );
    await pickArea(user, dialog, t.homeLabel, "Bole");
    await user.click(button(dialog, t.record));

    await waitFor(() => expect(onRecorded).toHaveBeenCalled());
    expect(seen[0]?.body).toEqual({
      rider_type: "corporate",
      full_name: "Hirut Bekele",
      phone: "0911000303",
      company_id: "00000000-0000-4000-c000-000000000001",
      home_area_id: "00000000-0000-4000-a000-000000000001",
      saturday_addon: false,
    });
  });

  it("starts with a phone already typed", () => {
    const { dialog } = renderForm({ initialPhone: "+251922334455" });
    expect(within(dialog).getByLabelText(t.phoneLabel)).toHaveValue(
      "+251922334455",
    );
  });

  it("checks the form before sending it", async () => {
    const seen: { body: Schemas["RiderCreate"]; key: string | null }[] = [];
    serveCreate(() => HttpResponse.json({}, { status: 201 }), seen);
    const user = userEvent.setup();
    const { dialog } = renderForm();

    await user.type(within(dialog).getByLabelText(t.phoneLabel), "0911");
    await user.click(button(dialog, t.record));

    expect(await within(dialog).findByText(t.nameRequired)).toBeVisible();
    expect(within(dialog).getByText(t.phoneInvalid)).toBeVisible();
    expect(within(dialog).getByText(t.homeRequired)).toBeVisible();
    expect(within(dialog).getByText(t.destinationRequired)).toBeVisible();
    expect(within(dialog).getByText(t.planRequired)).toBeVisible();
    expect(within(dialog).getByLabelText(t.nameLabel)).toHaveFocus();

    await pickArea(user, dialog, t.homeLabel, "CMC");
    await pickArea(user, dialog, t.destinationLabel, "CMC");
    await user.click(button(dialog, t.record));
    expect(await within(dialog).findByText(t.sameAreas)).toBeVisible();
    expect(seen).toEqual([]);
  });

  it("points to the rider who already has the phone", async () => {
    serveCreate(() => problemResponse(409, "RIDER_EXISTS", "req-409"), []);
    const lookups: Schemas["RiderLookup"][] = [];
    serveLookup([{ ...riding, phone: "+251911223344" }], lookups);
    const user = userEvent.setup();
    const { dialog, onRecorded } = renderForm();

    await fillAdult(user, dialog);
    await user.click(button(dialog, t.record));

    expect(await within(dialog).findByText(t.existsAdult)).toBeVisible();
    const link = await within(dialog).findByRole("link", {
      name: fill(t.existsLink, { name: "Abel Tesfaye" }),
    });
    expect(link).toHaveAttribute("href", `/riders/${riding.id}`);
    expect(lookups).toEqual([{ phone: "+251911223344" }]);
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it("keeps the same Idempotency-Key when sending again", async () => {
    const seen: { body: Schemas["RiderCreate"]; key: string | null }[] = [];
    let first = true;
    serveCreate(() => {
      if (first) {
        first = false;
        return problemResponse(503, "SERVICE_UNAVAILABLE");
      }
      return HttpResponse.json(rider(9), { status: 201 });
    }, seen);
    const user = userEvent.setup();
    const { dialog, onRecorded } = renderForm();

    await fillAdult(user, dialog);
    await user.click(button(dialog, t.record));
    expect(
      await within(dialog).findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeVisible();
    await user.click(button(dialog, t.record));

    await waitFor(() => expect(onRecorded).toHaveBeenCalled());
    expect(seen).toHaveLength(2);
    expect(seen[1]?.key).toBe(seen[0]?.key);
  });
});

describe("RiderFormDialog: correcting", () => {
  it("sends only what changed", async () => {
    const seen: Schemas["RiderUpdate"][] = [];
    serveUpdate(() => HttpResponse.json(riding), seen);
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderForm({ rider: riding });

    expect(within(dialog).getByLabelText(t.nameLabel)).toHaveValue(
      "Abel Tesfaye",
    );
    expect(within(dialog).getByLabelText(t.planRoundTripOption)).toBeChecked();
    await user.click(within(dialog).getByLabelText(t.planMorningOption));
    await user.click(button(dialog, t.save));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(seen).toEqual([{ plan: "morning" }]);
    expect(toast).toHaveBeenCalledWith(t.savedToast);
  });

  it("closes without a request when nothing changed", async () => {
    const seen: Schemas["RiderUpdate"][] = [];
    serveUpdate(() => HttpResponse.json(riding), seen);
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderForm({ rider: riding });

    // The same number typed another way is no change.
    const phone = within(dialog).getByLabelText(t.phoneLabel);
    await user.clear(phone);
    await user.type(phone, "0911 00 04 12");
    await user.click(button(dialog, t.save));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(seen).toEqual([]);
  });

  it("lets a company rider's name, phone and boarding area change, nothing else", async () => {
    const seen: Schemas["RiderUpdate"][] = [];
    serveUpdate(() => HttpResponse.json(companyRider), seen);
    const user = userEvent.setup();
    const { dialog } = renderForm({ rider: companyRider });

    expect(
      within(dialog).getByText(
        fill(t.typeCompanyAt, { company: "Addis Brewery" }),
      ),
    ).toBeVisible();
    expect(
      within(dialog).queryByRole("combobox", { name: t.companyLabel }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("combobox", { name: t.destinationLabel }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText(t.saturdayLabel),
    ).not.toBeInTheDocument();
    await pickArea(user, dialog, t.homeLabel, "CMC");
    await user.click(button(dialog, t.save));

    await waitFor(() =>
      expect(seen).toEqual([
        { home_area_id: "00000000-0000-4000-a000-000000000004" },
      ]),
    );
  });

  it("explains a change that doesn't fit their route on its field", async () => {
    serveUpdate(() => validationResponse("home_area_id"), []);
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderForm({ rider: riding });

    await pickArea(user, dialog, t.homeLabel, "Bole");
    await user.click(button(dialog, t.save));

    expect(
      await within(dialog).findByText(fill(t.homeNotOnRoute, { code: "R-03" })),
    ).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("says when another rider has the new phone", async () => {
    serveUpdate(() => problemResponse(409, "RIDER_EXISTS"), []);
    const user = userEvent.setup();
    const { dialog } = renderForm({ rider: rider(7, { id: riderId(7) }) });

    const phone = within(dialog).getByLabelText(t.phoneLabel);
    await user.clear(phone);
    await user.type(phone, "0911000208");
    await user.click(button(dialog, t.save));

    expect(await within(dialog).findByText(t.phoneTakenEdit)).toBeVisible();
    await waitFor(() => expect(phone).toHaveFocus());
  });
});

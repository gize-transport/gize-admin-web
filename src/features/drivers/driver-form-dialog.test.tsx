import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import {
  apiUrl,
  problemHeaders,
  server,
  type Schemas,
} from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { DriverFormDialog } from "./driver-form-dialog";
import { bereket, fill, problemResponse } from "./test-support";

vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.Drivers;

startMswServer();

beforeEach(() => toast.mockClear());

function renderForm(found?: Schemas["DriverRead"]) {
  const onOpenChange = vi.fn();
  const onAdded = vi.fn();
  const view = renderWithProviders(
    <DriverFormDialog
      open
      onOpenChange={onOpenChange}
      driver={found}
      onAdded={onAdded}
    />,
  );
  return { ...view, onOpenChange, onAdded, dialog: screen.getByRole("dialog") };
}

const field = (dialog: HTMLElement, label: string) =>
  within(dialog).getByLabelText(label);

async function fillNew(user: UserEvent, dialog: HTMLElement) {
  await user.type(field(dialog, t.nameLabel), "  Fikru Hailu ");
  await user.type(field(dialog, t.phoneLabel), "0922 34 56 78");
  await user.type(field(dialog, t.addressLabel), "Ayat, block 12");
  await user.type(field(dialog, t.plateLabel), "aa 3-b54321");
}

const save = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: t.save });

function validation(fieldName: string) {
  return HttpResponse.json(
    {
      type: "about:blank",
      title: "VALIDATION_FAILED",
      status: 422,
      code: "VALIDATION_FAILED",
      request_id: "req-422",
      errors: [{ location: "body", field: fieldName, reason: "invalid" }],
      errors_truncated: false,
    },
    { status: 422, headers: problemHeaders },
  );
}

describe("DriverFormDialog: adding", () => {
  it("adds a driver with one Idempotency-Key, reused on retry", async () => {
    const keys: (string | null)[] = [];
    const bodies: Schemas["DriverCreate"][] = [];
    let fail = true;
    server.use(
      http.post(apiUrl("/v1/drivers"), async ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        bodies.push((await request.json()) as Schemas["DriverCreate"]);
        if (fail) {
          fail = false;
          return problemResponse(503, "SERVICE_UNAVAILABLE");
        }
        return HttpResponse.json<Schemas["DriverRead"]>(bereket, {
          status: 201,
        });
      }),
    );
    const user = userEvent.setup();
    const { dialog, onOpenChange, onAdded } = renderForm();
    expect(dialog).toHaveAccessibleName(t.addTitle);

    await fillNew(user, dialog);
    await user.click(save(dialog));
    expect(
      await within(dialog).findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeVisible();
    await user.click(save(dialog));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.addedToast));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onAdded).toHaveBeenCalledWith(bereket);
    // Trimmed; the API normalises the phone and plate itself.
    expect(bodies[0]).toEqual({
      full_name: "Fikru Hailu",
      phone: "0922 34 56 78",
      address: "Ayat, block 12",
      plate: "aa 3-b54321",
    });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });

  it("checks every field before sending and focuses the first problem", async () => {
    const sent = vi.fn();
    server.use(http.post(apiUrl("/v1/drivers"), sent));
    const user = userEvent.setup();
    const { dialog } = renderForm();

    await user.type(field(dialog, t.phoneLabel), "12345");
    await user.type(field(dialog, t.plateLabel), "A");
    await user.click(save(dialog));

    expect(await within(dialog).findByText(t.nameRequired)).toBeVisible();
    expect(within(dialog).getByText(t.phoneInvalid)).toBeVisible();
    expect(within(dialog).getByText(t.addressRequired)).toBeVisible();
    expect(within(dialog).getByText(t.plateInvalid)).toBeVisible();
    expect(field(dialog, t.nameLabel)).toHaveFocus();
    expect(sent).not.toHaveBeenCalled();
  });

  it.each([
    ["DRIVER_EXISTS", "phoneLabel", messages.Errors.DRIVER_EXISTS],
    ["PLATE_TAKEN", "plateLabel", messages.Errors.PLATE_TAKEN],
  ] as const)("shows %s on its field", async (code, label, words) => {
    server.use(
      http.post(apiUrl("/v1/drivers"), () => problemResponse(409, code)),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm();

    await fillNew(user, dialog);
    await user.click(save(dialog));

    const input = field(dialog, t[label]);
    await waitFor(() =>
      expect(input).toHaveAccessibleDescription(expect.stringContaining(words)),
    );
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("puts the API's field errors on their fields", async () => {
    server.use(http.post(apiUrl("/v1/drivers"), () => validation("plate")));
    const user = userEvent.setup();
    const { dialog } = renderForm();

    await fillNew(user, dialog);
    await user.click(save(dialog));

    await waitFor(() =>
      expect(field(dialog, t.plateLabel)).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(field(dialog, t.plateLabel)).toHaveFocus();
    expect(field(dialog, t.plateLabel)).toHaveAccessibleDescription(
      expect.stringContaining(t.plateRefused),
    );
  });

  it("keeps Save disabled until Retry-After has passed", async () => {
    server.use(
      http.post(apiUrl("/v1/drivers"), () =>
        problemResponse(429, "RATE_LIMITED", "req-429", {
          "Retry-After": "30",
        }),
      ),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm();

    await fillNew(user, dialog);
    await user.click(save(dialog));
    expect(await within(dialog).findByText("req-429")).toBeVisible();
    expect(save(dialog)).toHaveAttribute("aria-disabled", "true");
  });
});

describe("DriverFormDialog: editing", () => {
  it("sends only what changed, a phone or plate written another way being no change", async () => {
    const sent: Schemas["DriverUpdate"][] = [];
    server.use(
      http.patch(apiUrl("/v1/drivers/{driver_id}"), async ({ request }) => {
        const change = (await request.json()) as Schemas["DriverUpdate"];
        sent.push(change);
        return HttpResponse.json({ ...bereket, ...change });
      }),
    );
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderForm(bereket);
    expect(dialog).toHaveAccessibleName(
      fill(t.editTitle, { name: "Bereket Tolosa" }),
    );

    await user.clear(field(dialog, t.phoneLabel));
    await user.type(field(dialog, t.phoneLabel), "0911 000 201");
    await user.clear(field(dialog, t.plateLabel));
    await user.type(field(dialog, t.plateLabel), "aa  3-b12341");
    await user.clear(field(dialog, t.addressLabel));
    await user.type(field(dialog, t.addressLabel), "Bole Bulbula");
    await user.click(save(dialog));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.savedToast));
    expect(sent).toEqual([{ address: "Bole Bulbula" }]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes without a request when nothing changed", async () => {
    const sent = vi.fn();
    server.use(http.patch(apiUrl("/v1/drivers/{driver_id}"), sent));
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderForm(bereket);

    await user.click(save(dialog));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(sent).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});

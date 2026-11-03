import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { CompanyFormDialog } from "./company-form-dialog";
import { brewery, fill, problemResponse } from "./test-support";

vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.Companies;

startMswServer();

beforeEach(() => toast.mockClear());

function renderForm(company?: Schemas["CompanyRead"]) {
  const onOpenChange = vi.fn();
  const view = renderWithProviders(
    <CompanyFormDialog open onOpenChange={onOpenChange} company={company} />,
  );
  return { ...view, onOpenChange, dialog: screen.getByRole("dialog") };
}

async function fillNew(user: UserEvent, dialog: HTMLElement) {
  const field = (label: string) => within(dialog).getByLabelText(label);
  await user.type(field(t.nameLabel), "  Ethio Ceramics ");
  await user.type(field(t.contactNameLabel), "Dawit Alemu");
  await user.type(field(t.contactPhoneLabel), "0922 34 56 78");
  await user.type(field(t.contactEmailLabel), "Dawit@Ceramics.test");
}

const save = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: t.save });

describe("CompanyFormDialog", () => {
  it("adds a company with one Idempotency-Key, reused on retry", async () => {
    const keys: (string | null)[] = [];
    const bodies: Schemas["CompanyCreate"][] = [];
    let fail = true;
    server.use(
      http.post(apiUrl("/v1/companies"), async ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        bodies.push((await request.json()) as Schemas["CompanyCreate"]);
        if (fail) {
          fail = false;
          return problemResponse(503, "SERVICE_UNAVAILABLE");
        }
        return HttpResponse.json<Schemas["CompanyRead"]>(
          { ...brewery, name: "Ethio Ceramics" },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderForm();
    expect(dialog).toHaveAccessibleName(t.addTitle);

    await fillNew(user, dialog);
    await user.click(save(dialog));
    expect(
      await within(dialog).findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeVisible();
    await user.click(save(dialog));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        fill(t.addedToast, { name: "Ethio Ceramics" }),
      ),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Trimmed; the API normalises the phone and email itself. No notes: none sent.
    expect(bodies[0]).toEqual({
      name: "Ethio Ceramics",
      contact_name: "Dawit Alemu",
      contact_phone: "0922 34 56 78",
      contact_email: "Dawit@Ceramics.test",
    });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });

  it("checks every field before sending and focuses the first problem", async () => {
    let posted = false;
    server.use(
      http.post(apiUrl("/v1/companies"), () => {
        posted = true;
        return problemResponse(500, "INTERNAL_ERROR");
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm();

    await user.type(
      within(dialog).getByLabelText(t.contactPhoneLabel),
      "0811 23 45 67",
    );
    await user.type(
      within(dialog).getByLabelText(t.contactEmailLabel),
      "not an email",
    );
    await user.click(save(dialog));

    const name = within(dialog).getByLabelText(t.nameLabel);
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAccessibleDescription(t.nameRequired);
    expect(
      within(dialog).getByLabelText(t.contactNameLabel),
    ).toHaveAccessibleDescription(t.contactNameRequired);
    expect(
      within(dialog).getByLabelText(t.contactPhoneLabel),
    ).toHaveAccessibleDescription(`${t.contactPhoneHint} ${t.phoneInvalid}`);
    expect(
      within(dialog).getByLabelText(t.contactEmailLabel),
    ).toHaveAccessibleDescription(t.emailInvalid);
    expect(posted).toBe(false);
  });

  it("accepts the usual ways of writing a mobile number", async () => {
    let body: Schemas["CompanyCreate"] | undefined;
    server.use(
      http.post(apiUrl("/v1/companies"), async ({ request }) => {
        body = (await request.json()) as Schemas["CompanyCreate"];
        return HttpResponse.json<Schemas["CompanyRead"]>(brewery, {
          status: 201,
        });
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm();

    await fillNew(user, dialog);
    const phone = within(dialog).getByLabelText(t.contactPhoneLabel);
    await user.clear(phone);
    await user.type(phone, "+251 (0) 711-234-567");
    await user.click(save(dialog));

    await waitFor(() =>
      expect(body?.contact_phone).toBe("+251 (0) 711-234-567"),
    );
  });

  it("shows a taken name on the name field", async () => {
    server.use(
      http.post(apiUrl("/v1/companies"), () =>
        problemResponse(409, "COMPANY_NAME_TAKEN"),
      ),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm();

    await fillNew(user, dialog);
    await user.click(save(dialog));

    const name = within(dialog).getByLabelText(t.nameLabel);
    await waitFor(() => expect(name).toHaveAttribute("aria-invalid", "true"));
    expect(name).toHaveAccessibleDescription(
      messages.Errors.COMPANY_NAME_TAKEN,
    );
    expect(name).toHaveFocus();
  });

  it("puts the API's field errors on their fields", async () => {
    server.use(
      http.post(apiUrl("/v1/companies"), () =>
        HttpResponse.json<Schemas["ValidationProblem"]>(
          {
            type: "about:blank",
            title: "VALIDATION_FAILED",
            status: 422,
            code: "VALIDATION_FAILED",
            request_id: "req-422",
            errors: [
              { location: "body", field: "/contact_phone", reason: "invalid" },
            ],
            errors_truncated: false,
          },
          {
            status: 422,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      ),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm();

    await fillNew(user, dialog);
    await user.click(save(dialog));

    const phone = within(dialog).getByLabelText(t.contactPhoneLabel);
    await waitFor(() => expect(phone).toHaveAttribute("aria-invalid", "true"));
    expect(phone).toHaveAccessibleDescription(
      `${t.contactPhoneHint} ${messages.ValidationReasons.invalid}`,
    );
    expect(phone).toHaveFocus();
  });

  it("keeps Save disabled while sending and until Retry-After has passed", async () => {
    let release = () => {};
    server.use(
      http.post(apiUrl("/v1/companies"), async () => {
        await new Promise<void>((resolve) => (release = resolve));
        return problemResponse(429, "RATE_LIMITED", "req-429", {
          "Retry-After": "1",
        });
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm();

    await fillNew(user, dialog);
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

  it("edits only what changed, and clearing the notes sends them empty", async () => {
    let sent: Schemas["CompanyUpdate"] | undefined;
    server.use(
      http.patch(apiUrl("/v1/companies/{company_id}"), async ({ request }) => {
        sent = (await request.json()) as Schemas["CompanyUpdate"];
        return HttpResponse.json<Schemas["CompanyRead"]>({
          ...brewery,
          contact_name: "Hana B.",
          notes: null,
        });
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderForm(brewery);
    expect(dialog).toHaveAccessibleName(
      fill(t.editTitle, { name: "Addis Brewery" }),
    );

    const contact = within(dialog).getByLabelText(t.contactNameLabel);
    await user.clear(contact);
    await user.type(contact, "Hana B.");
    // The same number written another way is no change.
    const phone = within(dialog).getByLabelText(t.contactPhoneLabel);
    await user.clear(phone);
    await user.type(phone, "0911 23 45 67");
    await user.clear(within(dialog).getByLabelText(t.notesLabel));
    await user.click(save(dialog));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        fill(t.savedToast, { name: "Addis Brewery" }),
      ),
    );
    expect(sent).toEqual({ contact_name: "Hana B.", notes: "" });
  });

  it("closes without a request when nothing changed", async () => {
    let patched = false;
    server.use(
      http.patch(apiUrl("/v1/companies/{company_id}"), () => {
        patched = true;
        return HttpResponse.json<Schemas["CompanyRead"]>(brewery);
      }),
    );
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderForm(brewery);

    await user.click(save(dialog));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(patched).toBe(false);
    expect(toast).not.toHaveBeenCalled();
  });
});

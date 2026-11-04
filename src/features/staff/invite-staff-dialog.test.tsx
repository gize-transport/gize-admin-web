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
  validationResponse,
} from "../routes/test-support";
import { InviteStaffDialog } from "./invite-staff-dialog";
import {
  former,
  member,
  pending,
  serveMembers,
  servePatch,
} from "./test-support";

vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.Staff;

startMswServer();

beforeEach(() => toast.mockClear());

type Seen = { body: Record<string, unknown>; key: string | null };

function serveInvite(answer: () => Response, seen?: Seen[]) {
  server.use(
    http.post(apiUrl("/v1/staff"), async ({ request }) => {
      seen?.push({
        body: (await request.json()) as Record<string, unknown>,
        key: request.headers.get("Idempotency-Key"),
      });
      return answer();
    }),
  );
}

function renderDialog() {
  const onOpenChange = vi.fn();
  const onOpenMember = vi.fn();
  renderWithProviders(
    <InviteStaffDialog
      open
      onOpenChange={onOpenChange}
      onOpenMember={onOpenMember}
    />,
  );
  return { onOpenChange, onOpenMember, dialog: screen.getByRole("dialog") };
}

async function fillInvite(
  user: UserEvent,
  dialog: HTMLElement,
  email = "new.person@gize.test",
) {
  await user.type(within(dialog).getByLabelText(t.emailLabel), email);
  await user.type(within(dialog).getByLabelText(t.nameLabel), "New Person");
}

const send = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: t.send });

describe("InviteStaffDialog", () => {
  it("invites as staff by default, retrying with the same key, then opens the member", async () => {
    const seen: Seen[] = [];
    let fail = true;
    const invited = member(9, {
      full_name: "New Person",
      email: "new.person@gize.test",
      role: "staff",
      first_signed_in_at: null,
    });
    serveInvite(() => {
      if (fail) {
        fail = false;
        return problemResponse(503, "SERVICE_UNAVAILABLE");
      }
      return HttpResponse.json<Schemas["StaffRead"]>(invited, { status: 201 });
    }, seen);
    const user = userEvent.setup();
    const { dialog, onOpenMember, onOpenChange } = renderDialog();

    await fillInvite(user, dialog);
    await user.click(send(dialog));
    expect(await within(dialog).findByText(t.inviteUnavailable)).toBeVisible();
    await user.click(send(dialog));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.invited));
    expect(seen[0]?.body).toEqual({
      email: "new.person@gize.test",
      full_name: "New Person",
      role: "staff",
    });
    expect(seen[1]?.key).toBe(seen[0]?.key);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenMember).toHaveBeenCalledWith(invited.id);
  });

  it("checks the email and name first", async () => {
    const seen: Seen[] = [];
    serveInvite(() => problemResponse(500, "INTERNAL_ERROR"), seen);
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await user.type(
      within(dialog).getByLabelText(t.emailLabel),
      "not-an-email",
    );
    await user.click(send(dialog));

    const email = within(dialog).getByLabelText(t.emailLabel);
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAccessibleDescription(
      `${t.emailHint} ${t.emailInvalid}`,
    );
    expect(
      within(dialog).getByLabelText(t.nameLabel),
    ).toHaveAccessibleDescription(t.nameRequired);
    expect(seen).toHaveLength(0);
  });

  it("invites an admin", async () => {
    const seen: Seen[] = [];
    serveInvite(() => HttpResponse.json(member(9), { status: 201 }), seen);
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await fillInvite(user, dialog);
    await user.click(within(dialog).getByLabelText(t.roleAdminOption));
    await user.click(send(dialog));

    await waitFor(() => expect(seen[0]?.body.role).toBe("admin"));
  });

  it("offers to reactivate a deactivated member with the email, with the role chosen", async () => {
    serveInvite(() => problemResponse(409, "STAFF_EMAIL_TAKEN"));
    serveMembers([pending, former]);
    const changes: Schemas["StaffUpdate"][] = [];
    servePatch(
      () => HttpResponse.json({ ...former, is_active: true }),
      changes,
    );
    const user = userEvent.setup();
    const { dialog, onOpenMember } = renderDialog();

    await fillInvite(user, dialog, "Dawit@gize.test");
    await user.click(send(dialog));
    expect(await within(dialog).findByText(t.emailTaken)).toBeVisible();
    // Announced: the offer arrives after focus went to the email.
    const offer = await within(dialog).findByRole("status");
    expect(offer).toHaveTextContent(
      fill(t.emailTakenDeactivated, { name: "Dawit Former", role: "staff" }),
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: fill(t.reactivateInstead, {
          name: "Dawit Former",
          role: "staff",
        }),
      }),
    );

    await waitFor(() => expect(onOpenMember).toHaveBeenCalledWith(former.id));
    expect(changes).toEqual([{ is_active: true, role: "staff" }]);
    expect(toast).toHaveBeenCalledWith(t.reactivated);
  });

  it("offers to open an active member who has the email", async () => {
    serveInvite(() => problemResponse(409, "STAFF_EMAIL_TAKEN"));
    const asked: URL[] = [];
    serveMembers([former, pending], asked);
    const user = userEvent.setup();
    const { dialog, onOpenMember } = renderDialog();

    await fillInvite(user, dialog, "hana@gize.test");
    await user.click(send(dialog));
    await user.click(
      await within(dialog).findByRole("button", {
        name: fill(t.openMember, { name: "Hana Tesfaye" }),
      }),
    );

    expect(onOpenMember).toHaveBeenCalledWith(pending.id);
    expect(asked.length).toBeGreaterThan(0);
    expect(
      within(dialog).queryByRole("button", { name: /^Reactivate/ }),
    ).toBeNull();
  });

  it("reads further pages for the member, and says where to look when not found", async () => {
    serveInvite(() => problemResponse(409, "STAFF_EMAIL_TAKEN"));
    const asked: URL[] = [];
    server.use(
      http.get(apiUrl("/v1/staff"), ({ request }) => {
        const url = new URL(request.url);
        asked.push(url);
        return HttpResponse.json<Schemas["StaffPage"]>({
          items: url.searchParams.has("cursor") ? [pending] : [former],
          next_cursor: url.searchParams.has("cursor") ? null : "page-2",
        });
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await fillInvite(user, dialog, "nobody@gize.test");
    await user.click(send(dialog));

    expect(await within(dialog).findByText(t.emailTakenUnknown)).toBeVisible();
    expect(asked.map((url) => url.searchParams.get("cursor"))).toEqual([
      null,
      "page-2",
    ]);
  });

  it("explains a failed lookup with a retry", async () => {
    serveInvite(() => problemResponse(409, "STAFF_EMAIL_TAKEN"));
    server.use(
      http.get(apiUrl("/v1/staff"), () =>
        problemResponse(503, "SERVICE_UNAVAILABLE", "req-503"),
      ),
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await fillInvite(user, dialog, "dawit@gize.test");
    await user.click(send(dialog));

    expect(await within(dialog).findByText("req-503")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: messages.ProblemAlert.retry }),
    ).toBeVisible();
  });

  it("explains an email that already has a sign-in account", async () => {
    serveInvite(() => problemResponse(409, "AUTH_ACCOUNT_EXISTS", "req-409"));
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await fillInvite(user, dialog);
    await user.click(send(dialog));

    expect(await within(dialog).findByText(t.authAccountExists)).toBeVisible();
    expect(within(dialog).getByText("req-409")).toBeVisible();
  });

  it("puts an email the API refuses on the field", async () => {
    serveInvite(() => validationResponse("/email"));
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await fillInvite(user, dialog);
    await user.click(send(dialog));

    const email = within(dialog).getByLabelText(t.emailLabel);
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
  });

  it("keeps Send disabled until Retry-After has passed after a 429", async () => {
    serveInvite(() =>
      problemResponse(429, "RATE_LIMITED", "req-429", { "Retry-After": "1" }),
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await fillInvite(user, dialog);
    await user.click(send(dialog));

    expect(
      await within(dialog).findByText(messages.Errors.RATE_LIMITED),
    ).toBeVisible();
    expect(send(dialog)).toHaveAttribute("aria-disabled", "true");
    await waitFor(
      () => expect(send(dialog)).not.toHaveAttribute("aria-disabled"),
      {
        timeout: 2500,
      },
    );
  });
});

import { screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/en.json";
import { renderWithProviders } from "../../../../tests/utils/render";
import { SetPasswordForm } from "./set-password-form";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../../tests/utils/navigation");
  const state = createNavigationState();
  nav.state = state;
  return mockNavigation(state);
});
const setPassword = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/password", async (original) => ({
  ...(await original<typeof import("@/lib/auth/password")>()),
  setPassword,
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

type Nav = ReturnType<
  typeof import("../../../../tests/utils/navigation").createNavigationState
>;
const navigation = () => nav.state as Nav;
const t = messages.SetPassword;
const rules = t.rules.replace("{min}", "12").replace("{max}", "72");

async function submit(user: UserEvent, password: string, confirm = password) {
  if (password) await user.type(screen.getByLabelText(t.password), password);
  if (confirm) await user.type(screen.getByLabelText(t.confirm), confirm);
  await user.click(screen.getByRole("button", { name: t.submit }));
}

beforeEach(() => {
  setPassword
    .mockReset()
    .mockResolvedValue({ ok: true, othersSignedOut: true });
  toast.mockClear();
  navigation().replace.mockClear();
});

describe("SetPasswordForm", () => {
  it("shows the rule before typing, on new-password fields", () => {
    renderWithProviders(<SetPasswordForm />);

    const password = screen.getByLabelText(t.password);
    expect(password).toHaveAccessibleDescription(rules);
    expect(password).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText(t.confirm)).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("sets the password and goes into the portal", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SetPasswordForm />);

    await submit(user, "addis-bole-route");

    expect(setPassword).toHaveBeenCalledWith("addis-bole-route");
    await waitFor(() => expect(navigation().replace).toHaveBeenCalledWith("/"));
    expect(toast).toHaveBeenCalledWith(t.done);
  });

  it("asks for 12 characters and the same password twice, before sending", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SetPasswordForm />);

    await submit(user, "Gize2026!", "Gize2026?");

    const password = screen.getByLabelText(t.password);
    await waitFor(() => expect(password).toHaveFocus());
    expect(password).toHaveAccessibleDescription(
      `${rules} ${t.tooShort.replace("{min}", "12")}`,
    );
    expect(screen.getByLabelText(t.confirm)).toHaveAccessibleDescription(
      t.mismatch,
    );
    expect(setPassword).not.toHaveBeenCalled();
  });

  it("counts the length limit as Supabase does (bytes): 25 Ge'ez letters are too long", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SetPasswordForm />);

    await submit(user, "ሰ".repeat(25));

    expect(await screen.findByText(t.tooLong)).toBeVisible();
    expect(setPassword).not.toHaveBeenCalled();
  });

  it("says when signing out the other devices didn't work", async () => {
    setPassword.mockResolvedValue({ ok: true, othersSignedOut: false });
    const user = userEvent.setup();
    renderWithProviders(<SetPasswordForm />);

    await submit(user, "addis-bole-route");

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.doneOthersFailed));
  });

  it("explains a password Supabase refuses, and an expired link with a way to a new one", async () => {
    setPassword.mockResolvedValueOnce({ ok: false, reason: "weak_password" });
    const user = userEvent.setup();
    renderWithProviders(<SetPasswordForm />);

    await submit(user, "password1234");
    const weak = await screen.findByText(t.reasons.weak_password);
    expect(weak.closest("[tabindex]")).toHaveFocus();
    expect(navigation().replace).not.toHaveBeenCalled();

    setPassword.mockResolvedValueOnce({ ok: false, reason: "link_expired" });
    await user.click(screen.getByRole("button", { name: t.submit }));
    expect(await screen.findByText(t.reasons.link_expired)).toBeVisible();
    expect(screen.getByRole("link", { name: t.askNewLink })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });
});

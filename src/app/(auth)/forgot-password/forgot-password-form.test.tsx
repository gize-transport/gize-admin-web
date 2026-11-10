import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/en.json";
import { renderWithProviders } from "../../../../tests/utils/render";
import { ForgotPasswordForm } from "./forgot-password-form";

const requestPasswordReset = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/password", () => ({ requestPasswordReset }));

const t = messages.ForgotPassword;

beforeEach(() => {
  requestPasswordReset.mockReset().mockResolvedValue({ ok: true });
});

describe("ForgotPasswordForm", () => {
  it("sends the link and says so the same way whether or not the email has an account", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(t.email), " Hana@Gize.test ");
    await user.click(screen.getByRole("button", { name: t.submit }));

    expect(requestPasswordReset).toHaveBeenCalledWith("hana@gize.test");
    const sent = await screen.findByText(t.sentTitle);
    expect(sent.closest("[tabindex]")).toHaveFocus();
    expect(
      screen.getByText(t.sent.replace("{email}", "Hana@Gize.test")),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: t.backToSignIn })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("checks the email before sending", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(t.email), "not-an-email");
    await user.click(screen.getByRole("button", { name: t.submit }));

    expect(await screen.findByText(t.emailInvalid)).toBeVisible();
    expect(screen.getByLabelText(t.email)).toHaveAccessibleDescription(
      t.emailInvalid,
    );
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("explains a refusal (too many emails) and keeps the form", async () => {
    requestPasswordReset.mockResolvedValue({
      ok: false,
      reason: "rate_limited",
    });
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(t.email), "hana@gize.test");
    await user.click(screen.getByRole("button", { name: t.submit }));

    const failure = await screen.findByText(t.reasons.rate_limited);
    expect(failure.closest("[tabindex]")).toHaveFocus();
    expect(screen.getByLabelText(t.email)).toHaveValue("hana@gize.test");
  });
});

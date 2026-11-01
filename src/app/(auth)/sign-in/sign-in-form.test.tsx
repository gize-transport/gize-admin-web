import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/en.json";
import { renderWithProviders } from "../../../../tests/utils/render";
import { ApiError } from "@/lib/api/problem";
import type { SignInResult } from "@/lib/auth/sign-in";
import { currentStaffQueryKey } from "@/lib/auth/use-current-staff";
import { SignInForm } from "./sign-in-form";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../../tests/utils/navigation");
  const state = createNavigationState();
  nav.state = state;
  return mockNavigation(state);
});
const signIn = vi.hoisted(() =>
  vi.fn<
    (credentials: { email: string; password: string }) => Promise<SignInResult>
  >(),
);
vi.mock("@/lib/auth/sign-in", () => ({ signIn }));

type Nav = ReturnType<
  typeof import("../../../../tests/utils/navigation").createNavigationState
>;
const navigation = () => nav.state as Nav;
const t = messages.SignIn;

const staff = {
  id: "00000000-0000-4000-8000-000000000002",
  full_name: "Selam Staff",
  email: "staff@gize.test",
  role: "staff" as const,
};

async function fillAndSubmit(email = "staff@gize.test", password = "secret") {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText(t.email), email);
  if (password) await user.type(screen.getByLabelText(t.password), password);
  await user.click(screen.getByRole("button", { name: t.submit }));
  return user;
}

beforeEach(() => {
  navigation().search = "";
  navigation().replace.mockClear();
  navigation().refresh.mockClear();
});

describe("SignInForm", () => {
  it("has labelled email and password fields with sign-in autocomplete", () => {
    renderWithProviders(<SignInForm />);

    expect(screen.getByLabelText(t.email)).toHaveAttribute(
      "autocomplete",
      "username",
    );
    expect(screen.getByLabelText(t.password)).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText(t.password)).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  it("explains empty or invalid fields, focuses the first, and doesn't sign in", async () => {
    renderWithProviders(<SignInForm />);

    await fillAndSubmit("", "");

    expect(await screen.findByText(t.emailRequired)).toBeInTheDocument();
    expect(screen.getByText(t.passwordRequired)).toBeInTheDocument();
    expect(screen.getByLabelText(t.email)).toHaveFocus();
    expect(screen.getByLabelText(t.email)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(t.email)).toHaveAccessibleDescription(
      t.emailRequired,
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it("refuses an email address without a domain", async () => {
    renderWithProviders(<SignInForm />);

    await fillAndSubmit("selam", "secret");

    expect(await screen.findByText(t.emailInvalid)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signs in, caches the staff member and opens a safe next page", async () => {
    navigation().search = "?next=%2Froutes%3Fstatus%3Dforming";
    signIn.mockResolvedValue({ ok: true, staff });
    const { queryClient } = renderWithProviders(<SignInForm />);
    queryClient.setQueryData(["old", "data"], "from someone else");

    await fillAndSubmit(" staff@gize.test ", "secret");

    await waitFor(() =>
      expect(navigation().replace).toHaveBeenCalledWith(
        "/routes?status=forming",
      ),
    );
    expect(signIn).toHaveBeenCalledWith({
      email: "staff@gize.test",
      password: "secret",
    });
    expect(queryClient.getQueryData(["old", "data"])).toBeUndefined();
    expect(queryClient.getQueryData(currentStaffQueryKey)).toEqual(staff);
    expect(navigation().refresh).toHaveBeenCalled();
    // The page is changing: the button stays busy so it can't submit again.
    expect(screen.getByRole("button", { name: t.submit })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("ignores a next page on another site", async () => {
    navigation().search = "?next=%2F%2Fevil.example";
    signIn.mockResolvedValue({ ok: true, staff });
    renderWithProviders(<SignInForm />);

    await fillAndSubmit();

    await waitFor(() => expect(navigation().replace).toHaveBeenCalledWith("/"));
  });

  it("explains wrong credentials and moves focus to the message", async () => {
    signIn.mockResolvedValue({ ok: false, reason: "invalid_credentials" });
    renderWithProviders(<SignInForm />);

    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(t.reasons.invalid_credentials);
    expect(alert.parentElement).toHaveFocus();
    expect(navigation().replace).not.toHaveBeenCalled();
  });

  it("explains a failed staff check with its request ID", async () => {
    signIn.mockResolvedValue({
      ok: false,
      reason: "api",
      error: ApiError.fromResponse(new Response(null, { status: 500 }), {
        type: "about:blank",
        title: "Internal error",
        status: 500,
        code: "INTERNAL_ERROR",
        request_id: "req-500",
      }),
    });
    renderWithProviders(<SignInForm />);

    await fillAndSubmit();

    expect(
      await screen.findByText(messages.Errors.INTERNAL_ERROR),
    ).toBeInTheDocument();
    expect(screen.getByText(/req-500/)).toBeInTheDocument();
  });

  it("explains why someone who isn't staff was signed out", () => {
    navigation().search = "?reason=not_staff";
    renderWithProviders(<SignInForm />);

    expect(screen.getByRole("alert")).toHaveTextContent(t.reasons.not_staff);
  });

  it("confirms a sign-out", () => {
    navigation().search = "?reason=signed_out";
    renderWithProviders(<SignInForm />);

    expect(screen.getByRole("status")).toHaveTextContent(t.signedOut);
  });

  it("keeps the button focused and busy while signing in", async () => {
    let finish: (result: SignInResult) => void = () => {};
    signIn.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderWithProviders(<SignInForm />);

    await fillAndSubmit();

    const button = screen.getByRole("button", { name: t.submit });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveFocus();
    finish({ ok: false, reason: "network" });
    expect(await screen.findByText(t.reasons.network)).toBeInTheDocument();
  });
});

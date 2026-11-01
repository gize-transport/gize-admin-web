import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";
import {
  apiUrl,
  problem,
  problemHeaders,
  server,
  type Schemas,
} from "../../tests/msw/server";
import { startMswServer } from "../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../tests/utils/render";
import { StaffGreeting } from "./staff-greeting";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../tests/utils/navigation");
  const state = createNavigationState();
  nav.state = state;
  return mockNavigation(state);
});
const auth = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth }),
  getAccessToken: async () => "access-token",
}));

type Nav = ReturnType<
  typeof import("../../tests/utils/navigation").createNavigationState
>;
const navigation = () => nav.state as Nav;

startMswServer();

const staff: Schemas["StaffMe"] = {
  id: "00000000-0000-4000-8000-000000000001",
  full_name: "Abebe Admin",
  email: "admin@gize.test",
  role: "admin",
};

beforeEach(() => {
  auth.signOut.mockReset().mockResolvedValue({ error: null });
  navigation().replace.mockClear();
});

describe("StaffGreeting", () => {
  it("shows who is signed in with their role", async () => {
    server.use(
      http.get(apiUrl("/v1/staff/me"), () =>
        HttpResponse.json<Schemas["StaffMe"]>(staff),
      ),
    );
    renderWithProviders(<StaffGreeting />);

    expect(screen.getByRole("status")).toHaveTextContent(
      messages.HomePage.loadingStaff,
    );
    expect(
      await screen.findByText("Signed in as Abebe Admin (Admin)"),
    ).toBeInTheDocument();
  });

  it("signs out, clears the cache and opens sign-in", async () => {
    server.use(
      http.get(apiUrl("/v1/staff/me"), () =>
        HttpResponse.json<Schemas["StaffMe"]>(staff),
      ),
    );
    const { queryClient } = renderWithProviders(<StaffGreeting />);
    await screen.findByText("Signed in as Abebe Admin (Admin)");

    await userEvent.click(
      screen.getByRole("button", { name: messages.HomePage.signOut }),
    );

    await waitFor(() =>
      expect(navigation().replace).toHaveBeenCalledWith(
        "/sign-in?reason=signed_out",
      ),
    );
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("still opens sign-in when Supabase can't be reached", async () => {
    auth.signOut.mockRejectedValue(new TypeError("Failed to fetch"));
    server.use(
      http.get(apiUrl("/v1/staff/me"), () =>
        HttpResponse.json<Schemas["StaffMe"]>(staff),
      ),
    );
    renderWithProviders(<StaffGreeting />);
    await screen.findByText("Signed in as Abebe Admin (Admin)");

    await userEvent.click(
      screen.getByRole("button", { name: messages.HomePage.signOut }),
    );

    await waitFor(() =>
      expect(navigation().replace).toHaveBeenCalledWith(
        "/sign-in?reason=signed_out",
      ),
    );
  });

  it("signs out once, with the button busy, when pressed twice", async () => {
    auth.signOut.mockReturnValue(new Promise(() => {}));
    server.use(
      http.get(apiUrl("/v1/staff/me"), () =>
        HttpResponse.json<Schemas["StaffMe"]>(staff),
      ),
    );
    renderWithProviders(<StaffGreeting />);
    await screen.findByText("Signed in as Abebe Admin (Admin)");
    const button = screen.getByRole("button", {
      name: messages.HomePage.signOut,
    });

    await userEvent.click(button);
    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-busy", "true");
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("signs out someone the API says isn't staff", async () => {
    server.use(
      http.get(apiUrl("/v1/staff/me"), () =>
        HttpResponse.json(problem(403, "FORBIDDEN"), {
          status: 403,
          headers: problemHeaders,
        }),
      ),
    );
    renderWithProviders(<StaffGreeting />);

    await waitFor(() =>
      expect(navigation().replace).toHaveBeenCalledWith(
        "/sign-in?reason=not_staff",
      ),
    );
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("shows other problems with their reference and a retry", async () => {
    server.use(
      http.get(apiUrl("/v1/staff/me"), () =>
        HttpResponse.json(problem(500, "INTERNAL_ERROR", "req-500"), {
          status: 500,
          headers: problemHeaders,
        }),
      ),
    );
    renderWithProviders(<StaffGreeting />);

    expect(
      await screen.findByText(messages.Errors.INTERNAL_ERROR),
    ).toBeInTheDocument();
    expect(screen.getByText(/req-500/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    ).toBeInTheDocument();
    // Whatever went wrong, the person can still sign out.
    expect(
      screen.getByRole("button", { name: messages.HomePage.signOut }),
    ).toBeInTheDocument();
  });
});

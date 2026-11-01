import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiUrl,
  problem,
  problemHeaders,
  server,
  type Schemas,
} from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { ApiError } from "../api/problem";
import { authFailureReason, signIn } from "./sign-in";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("./supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth }),
  getAccessToken: async () => "access-token",
}));

startMswServer();

const staff: Schemas["StaffMe"] = {
  id: "00000000-0000-4000-8000-000000000002",
  full_name: "Selam Staff",
  email: "staff@gize.test",
  role: "staff",
};
const credentials = { email: "staff@gize.test", password: "secret" };

beforeEach(() => {
  auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  auth.signOut.mockResolvedValue({ error: null });
});

describe("signIn", () => {
  it("signs in and returns the staff member from the API", async () => {
    server.use(
      http.get(apiUrl("/v1/staff/me"), () =>
        HttpResponse.json<Schemas["StaffMe"]>(staff),
      ),
    );

    await expect(signIn(credentials)).resolves.toEqual({ ok: true, staff });
    expect(auth.signInWithPassword).toHaveBeenCalledWith(credentials);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("reports wrong credentials without calling the API", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { status: 400, code: "invalid_credentials", name: "AuthApiError" },
    });

    await expect(signIn(credentials)).resolves.toEqual({
      ok: false,
      reason: "invalid_credentials",
    });
  });

  it("signs out again when the API says the person isn't staff", async () => {
    server.use(
      http.get(apiUrl("/v1/staff/me"), () =>
        HttpResponse.json(problem(403, "FORBIDDEN"), {
          status: 403,
          headers: problemHeaders,
        }),
      ),
    );

    await expect(signIn(credentials)).resolves.toEqual({
      ok: false,
      reason: "not_staff",
    });
    // This browser only: the person's sessions on other devices stay.
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("signs out again and returns the API error when the staff check fails", async () => {
    server.use(
      http.get(apiUrl("/v1/staff/me"), () =>
        HttpResponse.json(problem(500, "INTERNAL_ERROR", "req-500"), {
          status: 500,
          headers: problemHeaders,
        }),
      ),
    );

    const result = await signIn(credentials);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: "api" });
    if (!result.ok && result.reason === "api") {
      expect(result.error).toBeInstanceOf(ApiError);
      expect((result.error as ApiError).requestId).toBe("req-500");
    }
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("still reports the outcome when signing out fails", async () => {
    auth.signOut.mockRejectedValue(new TypeError("Failed to fetch"));
    server.use(
      http.get(apiUrl("/v1/staff/me"), () =>
        HttpResponse.json(problem(403, "FORBIDDEN"), {
          status: 403,
          headers: problemHeaders,
        }),
      ),
    );

    await expect(signIn(credentials)).resolves.toEqual({
      ok: false,
      reason: "not_staff",
    });
  });
});

describe("authFailureReason", () => {
  it.each([
    [{ status: 400, code: "invalid_credentials" }, "invalid_credentials"],
    [{ status: 400, code: "email_not_confirmed" }, "not_confirmed"],
    [{ status: 429, code: "over_request_rate_limit" }, "rate_limited"],
    [{ status: 429 }, "rate_limited"],
    [{ status: 0, name: "AuthRetryableFetchError" }, "network"],
    [{ status: 503, name: "AuthRetryableFetchError" }, "unavailable"],
    [{ status: 400, code: "something_else" }, "unknown"],
  ])("%j → %s", (error, reason) => {
    expect(authFailureReason(error)).toBe(reason);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  passwordBytes,
  requestPasswordReset,
  RESET_ANSWER_MS,
  setPassword,
} from "./password";

const auth = vi.hoisted(() => ({
  updateUser: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock("./supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth }),
}));

beforeEach(() => {
  auth.updateUser.mockReset().mockResolvedValue({ error: null });
  auth.signOut.mockReset().mockResolvedValue({ error: null });
  auth.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
});

describe("setPassword", () => {
  it("sets the password, then signs out the person's other sessions", async () => {
    expect(await setPassword("addis-bole-route")).toEqual({
      ok: true,
      othersSignedOut: true,
    });
    expect(auth.updateUser).toHaveBeenCalledWith({
      password: "addis-bole-route",
    });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("tries signing out elsewhere twice, then says it didn't work (the password stays set)", async () => {
    // supabase-js reports this in its result; it doesn't throw.
    auth.signOut.mockResolvedValue({ error: { status: 500 } });
    expect(await setPassword("addis-bole-route")).toEqual({
      ok: true,
      othersSignedOut: false,
    });
    expect(auth.signOut).toHaveBeenCalledTimes(2);
  });

  it("succeeds on the second try at signing out elsewhere", async () => {
    auth.signOut
      .mockResolvedValueOnce({ error: { status: 503 } })
      .mockResolvedValueOnce({ error: null });
    expect(await setPassword("addis-bole-route")).toEqual({
      ok: true,
      othersSignedOut: true,
    });
  });

  it.each([
    [{ code: "weak_password", status: 422 }, "weak_password"],
    [{ code: "same_password", status: 422 }, "same_password"],
    [
      { code: "reauthentication_needed", status: 400 },
      "reauthentication_needed",
    ],
    [{ name: "AuthSessionMissingError" }, "link_expired"],
    [{ code: "bad_jwt", status: 403 }, "link_expired"],
    [{ status: 429 }, "rate_limited"],
    [{ name: "AuthRetryableFetchError" }, "network"],
    [{ name: "AuthRetryableFetchError", status: 503 }, "unavailable"],
    [{ status: 500, code: "unexpected_failure" }, "unknown"],
  ])("explains a refusal (%o) as %s", async (error, reason) => {
    auth.updateUser.mockResolvedValue({ error });
    expect(await setPassword("addis-bole-route")).toEqual({
      ok: false,
      reason,
    });
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

describe("requestPasswordReset", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function request(email: string) {
    const result = requestPasswordReset(email);
    await vi.advanceTimersByTimeAsync(RESET_ANSWER_MS);
    return result;
  }

  it("asks Supabase to email a link, and never answers sooner than the set time", async () => {
    let answered = false;
    const result = requestPasswordReset("hana@gize.test").then((value) => {
      answered = true;
      return value;
    });
    await vi.advanceTimersByTimeAsync(RESET_ANSWER_MS - 1);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toEqual({ ok: true });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("hana@gize.test");
  });

  it("counts a second email to a real account within the minute as sent (it would give the account away)", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      error: { status: 429, code: "over_email_send_rate_limit" },
    });
    expect(await request("hana@gize.test")).toEqual({ ok: true });
  });

  it("says when this browser has made too many requests", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      error: { status: 429, code: "over_request_rate_limit" },
    });
    expect(await request("hana@gize.test")).toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });
});

describe("passwordBytes", () => {
  it("counts as Supabase does: Ge'ez letters are 3 bytes each", () => {
    expect(passwordBytes("abc")).toBe(3);
    expect(passwordBytes("ሰላም")).toBe(9);
  });
});

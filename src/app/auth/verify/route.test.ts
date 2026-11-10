import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

type CookieSetter = (
  cookies: { name: string; value: string; options: object }[],
  headers: Record<string, string>,
) => void;

const supabase = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  setAll: null as CookieSetter | null,
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: CookieSetter } },
  ) => {
    supabase.setAll = options.cookies.setAll;
    return { auth: { verifyOtp: supabase.verifyOtp } };
  },
}));

const SITE = "https://admin.gizetransport.com";

function post(fields: Record<string, string>, origin: string | null = SITE) {
  const body = new URLSearchParams(fields);
  return POST(
    new NextRequest(`${SITE}/auth/verify`, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(origin ? { Origin: origin } : {}),
      },
    }),
  );
}

beforeEach(() => {
  supabase.verifyOtp.mockReset().mockImplementation(async () => {
    // A checked link signs the person in: Supabase hands the session cookies over.
    supabase.setAll?.(
      [{ name: "sb-session", value: "session", options: { path: "/" } }],
      { "Cache-Control": "private, no-store" },
    );
    return { error: null };
  });
});

describe("POST /auth/verify", () => {
  it.each(["invite", "recovery"])(
    "checks a %s link, keeps the session and goes on to set a password",
    async (type) => {
      const response = await post({ token_hash: "abc", type });

      expect(supabase.verifyOtp).toHaveBeenCalledWith({
        type,
        token_hash: "abc",
      });
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(`${SITE}/set-password`);
      expect(response.cookies.get("sb-session")?.value).toBe("session");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );

  it("sends a link that doesn't work back to its page, which says so", async () => {
    supabase.verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
    const response = await post({ token_hash: "used", type: "invite" });

    expect(response.headers.get("location")).toBe(
      `${SITE}/auth/confirm?link=expired`,
    );
  });

  it.each<Record<string, string>>([
    {},
    { token_hash: "abc" },
    { token_hash: "abc", type: "signup" },
    { type: "invite" },
  ])("doesn't check a link this portal doesn't handle (%o)", async (fields) => {
    const response = await post(fields);

    expect(supabase.verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      `${SITE}/auth/confirm?link=expired`,
    );
  });

  it.each([null, "https://evil.example"])(
    "refuses a post from anywhere but this site (origin %s)",
    async (origin) => {
      const response = await post(
        { token_hash: "abc", type: "invite" },
        origin,
      );

      expect(response.status).toBe(403);
      expect(supabase.verifyOtp).not.toHaveBeenCalled();
    },
  );
});

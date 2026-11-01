import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./public-env";

const valid = {
  NEXT_PUBLIC_API_BASE_URL: "https://api.gizetransport.com",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
  NEXT_PUBLIC_SENTRY_DSN: "",
};

describe("parsePublicEnv", () => {
  it("accepts valid values and treats an empty Sentry DSN as off", () => {
    expect(parsePublicEnv(valid)).toEqual({
      apiBaseUrl: "https://api.gizetransport.com",
      supabaseUrl: "https://project.supabase.co",
      supabasePublishableKey: "sb_publishable_abc",
      sentryDsn: undefined,
    });
  });

  it("drops a trailing slash from the API base URL", () => {
    expect(
      parsePublicEnv({
        ...valid,
        NEXT_PUBLIC_API_BASE_URL: "https://api.gizetransport.com/",
      }).apiBaseUrl,
    ).toBe("https://api.gizetransport.com");
  });

  it("allows plain http only on this machine", () => {
    expect(
      parsePublicEnv({
        ...valid,
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
      }).apiBaseUrl,
    ).toBe("http://localhost:8000");
    expect(() =>
      parsePublicEnv({
        ...valid,
        NEXT_PUBLIC_API_BASE_URL: "http://api.gizetransport.com",
      }),
    ).toThrow(
      "NEXT_PUBLIC_API_BASE_URL: must use https (http only for localhost)",
    );
  });

  it("says which variables are missing and which are wrong", () => {
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: undefined }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL: is required");
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "ftp://x.test" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL: (?!is required)/);
  });

  it("names every missing or invalid variable without echoing values", () => {
    let message = "";
    try {
      parsePublicEnv({
        NEXT_PUBLIC_API_BASE_URL: "not a url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/NEXT_PUBLIC_API_BASE_URL/);
    expect(message).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(message).toMatch(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    expect(message).not.toMatch(/not a url/);
    expect(message).toMatch(/\.env\.example/);
  });

  it("refuses a secret key, which would be readable in the browser", () => {
    let message = "";
    try {
      parsePublicEnv({
        ...valid,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc123",
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: this is a secret key/,
    );
    expect(message).not.toMatch(/sb_secret_abc123/);
  });

  it("refuses a legacy anon key (deprecated by Supabase)", () => {
    expect(() =>
      parsePublicEnv({
        ...valid,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "aaaa.bbbb.cccc",
      }),
    ).toThrow(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: must start with sb_publishable_/,
    );
  });

  it("refuses a Sentry DSN that isn't a URL", () => {
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SENTRY_DSN: "nope" }),
    ).toThrow(/NEXT_PUBLIC_SENTRY_DSN/);
  });
});

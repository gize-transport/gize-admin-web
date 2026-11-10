import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, createNonce, STATIC_CSP } from "./csp";

const production = {
  nonce: "abc123",
  apiBaseUrl: "https://gize-api-staging.onrender.com",
  supabaseUrl: "https://project.supabase.co",
  sentryDsn: "https://key@o1.ingest.sentry.io/42",
  development: false,
  secure: true,
};

function directive(policy: string, name: string) {
  return policy
    .split("; ")
    .find((part) => part === name || part.startsWith(`${name} `));
}

describe("contentSecurityPolicy", () => {
  it("only runs scripts with the request's nonce, and never evaluates code in production", () => {
    const policy = contentSecurityPolicy(production);

    expect(directive(policy, "script-src")).toBe(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic'",
    );
    expect(policy).not.toContain("unsafe-eval");
    expect(directive(policy, "script-src")).not.toContain("unsafe-inline");
  });

  it("lets the page talk only to itself, the API, Supabase and Sentry (without the DSN's key)", () => {
    expect(directive(contentSecurityPolicy(production), "connect-src")).toBe(
      "connect-src 'self' https://gize-api-staging.onrender.com https://project.supabase.co https://o1.ingest.sentry.io",
    );
    expect(
      directive(
        contentSecurityPolicy({ ...production, sentryDsn: undefined }),
        "connect-src",
      ),
    ).toBe(
      "connect-src 'self' https://gize-api-staging.onrender.com https://project.supabase.co",
    );
  });

  it("can't be framed, has no plugins and keeps forms and base URLs on the site", () => {
    const policy = contentSecurityPolicy(production);

    for (const part of [
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "default-src 'self'",
      "upgrade-insecure-requests",
    ]) {
      expect(policy).toContain(part);
    }
  });

  it("allows evaluated code in development, and doesn't upgrade requests on a local http page", () => {
    const policy = contentSecurityPolicy({
      ...production,
      apiBaseUrl: "http://localhost:8000",
      supabaseUrl: "http://localhost:54321",
      sentryDsn: undefined,
      development: true,
      secure: false,
    });

    expect(directive(policy, "script-src")).toContain("'unsafe-eval'");
    expect(directive(policy, "connect-src")).toBe(
      "connect-src 'self' http://localhost:8000 http://localhost:54321",
    );
    expect(policy).not.toContain("upgrade-insecure-requests");
  });
});

describe("createNonce", () => {
  it("is different every time", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => createNonce()));
    expect(nonces.size).toBe(50);
  });
});

describe("STATIC_CSP", () => {
  it("lets nothing run on pages middleware skips", () => {
    expect(STATIC_CSP).toContain("default-src 'none'");
    expect(STATIC_CSP).not.toContain("script-src");
    expect(STATIC_CSP).toContain("frame-ancestors 'none'");
  });
});

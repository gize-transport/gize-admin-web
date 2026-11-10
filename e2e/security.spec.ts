import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";

/** One directive of a policy ("script-src …"), or undefined. */
function directive(policy: string, name: string) {
  return policy
    .split("; ")
    .find((part) => part === name || part.startsWith(`${name} `));
}

test.describe("security headers", () => {
  test("every page gets its own nonce-based policy, and the usual protections", async ({
    request,
  }) => {
    const first = await request.get("/sign-in");
    const second = await request.get("/sign-in");
    const policy = first.headers()["content-security-policy"] ?? "";

    const script = directive(policy, "script-src") ?? "";
    expect(script).toMatch(/'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    // A new nonce for each response.
    expect(second.headers()["content-security-policy"]).not.toBe(policy);

    const headers = first.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("a redirect, a missing page and paths middleware skips all carry a policy", async ({
    request,
  }) => {
    // Signed out, the portal redirects to sign-in: the redirect has the nonce policy too.
    const redirect = await request.get("/routes", { maxRedirects: 0 });
    expect(redirect.status()).toBe(307);
    expect(redirect.headers()["content-security-policy"]).toContain("'nonce-");

    // Where middleware doesn't run (a missing image or brand file), the fixed policy: nothing
    // may run on its 404 page.
    for (const path of ["/nothing-here.png", "/brand/nothing-here"]) {
      const response = await request.get(path);
      const policy = response.headers()["content-security-policy"] ?? "";
      expect(policy, path).toContain("default-src 'none'");
      expect(policy, path).not.toContain("script-src");
      expect(response.headers()["x-content-type-options"], path).toBe(
        "nosniff",
      );
    }
  });

  test("the page's own scripts carry the nonce, and nothing breaks the policy", async ({
    page,
  }) => {
    const violations: string[] = [];
    await page.exposeFunction("reportViolation", (text: string) =>
      violations.push(text),
    );
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        (
          window as unknown as { reportViolation: (t: string) => void }
        ).reportViolation(
          `${event.violatedDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}:${event.columnNumber}`,
        );
      });
    });

    const response = await page.goto("/sign-in");
    const policy = response?.headers()["content-security-policy"] ?? "";
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
    expect(nonce).toBeTruthy();
    // Browsers hide a nonce from attributes once read; the property still holds it.
    const scriptNonces = await page.$$eval("script", (scripts) =>
      scripts.map((script) => script.nonce),
    );
    expect(scriptNonces.length).toBeGreaterThan(0);
    expect(scriptNonces.every((value) => value === nonce)).toBe(true);

    // Signed in, through the portal: the API and Supabase calls are allowed.
    await signIn(page, "admin", "/sign-in?next=%2Froutes");
    await expect(page.getByRole("table")).toBeVisible();
    expect(violations).toEqual([]);
  });
});

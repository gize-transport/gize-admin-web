import { describe, expect, it } from "vitest";
import {
  isPublicPath,
  isSignInPath,
  safeNextPath,
  sessionRedirect,
  signInHref,
} from "./paths";

describe("safeNextPath", () => {
  it("keeps a path on this site, with its query", () => {
    expect(safeNextPath("/routes?status=forming")).toBe(
      "/routes?status=forming",
    );
    expect(safeNextPath("/")).toBe("/");
  });

  it.each([
    null,
    "",
    "routes",
    "//evil.example",
    "/\\evil.example",
    "https://evil.example/",
    "javascript:alert(1)",
    "/sign-in",
    "/sign-in?next=%2F",
    "/routes\nx",
  ])("falls back to / for %j", (next) => {
    expect(safeNextPath(next)).toBe("/");
  });
});

describe("signInHref", () => {
  it("keeps the current path and filters as next", () => {
    expect(signInHref({ pathname: "/routes", search: "?status=forming" })).toBe(
      "/sign-in?next=%2Froutes%3Fstatus%3Dforming",
    );
  });

  it("leaves next out for the home page", () => {
    expect(signInHref({ pathname: "/", search: "" })).toBe("/sign-in");
  });

  it("returns null on the sign-in page itself", () => {
    expect(
      signInHref({ pathname: "/sign-in", search: "?next=%2F" }),
    ).toBeNull();
  });
});

describe("isSignInPath and isPublicPath", () => {
  it("matches the sign-in page and its subpaths only", () => {
    expect(isSignInPath("/sign-in")).toBe(true);
    expect(isSignInPath("/sign-in/help")).toBe(true);
    expect(isSignInPath("/sign-inx")).toBe(false);
  });

  it("treats sign-in and the dev gallery as public", () => {
    expect(isPublicPath("/sign-in")).toBe(true);
    expect(isPublicPath("/dev/components")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/routes")).toBe(false);
    expect(isPublicPath("/developer")).toBe(false);
  });
});

describe("sessionRedirect", () => {
  it("sends signed-out people to sign-in, remembering the page", () => {
    expect(
      sessionRedirect({
        pathname: "/routes",
        search: "?status=forming",
        signedIn: false,
        next: null,
      }),
    ).toBe("/sign-in?next=%2Froutes%3Fstatus%3Dforming");
  });

  it("lets signed-out people open public pages", () => {
    expect(
      sessionRedirect({
        pathname: "/sign-in",
        search: "",
        signedIn: false,
        next: null,
      }),
    ).toBeNull();
    expect(
      sessionRedirect({
        pathname: "/dev/components",
        search: "",
        signedIn: false,
        next: null,
      }),
    ).toBeNull();
  });

  it("sends signed-in people from sign-in to a safe next page", () => {
    expect(
      sessionRedirect({
        pathname: "/sign-in",
        search: "?next=%2Froutes",
        signedIn: true,
        next: "/routes",
      }),
    ).toBe("/routes");
    expect(
      sessionRedirect({
        pathname: "/sign-in",
        search: "",
        signedIn: true,
        next: "//evil.example",
      }),
    ).toBe("/");
  });

  it("lets signed-in people through everywhere else", () => {
    expect(
      sessionRedirect({
        pathname: "/routes",
        search: "",
        signedIn: true,
        next: null,
      }),
    ).toBeNull();
  });
});

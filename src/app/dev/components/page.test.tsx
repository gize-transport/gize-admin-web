import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound,
}));

const { default: DevComponentsPage } = await import("./page");

beforeEach(() => {
  notFound.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/dev/components", () => {
  it("is a 404 in a production build without GIZE_DEV_PAGES", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GIZE_DEV_PAGES", "");

    expect(() => DevComponentsPage()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("renders when dev pages are enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GIZE_DEV_PAGES", "1");

    expect(DevComponentsPage()).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });
});

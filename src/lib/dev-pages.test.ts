import { afterEach, describe, expect, it, vi } from "vitest";
import { devPagesEnabled } from "./dev-pages";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("devPagesEnabled", () => {
  it("is on under the dev server", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("GIZE_DEV_PAGES", "");

    expect(devPagesEnabled()).toBe(true);
  });

  it("is off in a production build by default", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GIZE_DEV_PAGES", "");

    expect(devPagesEnabled()).toBe(false);
  });

  it("is on in a production build made for e2e with GIZE_DEV_PAGES=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GIZE_DEV_PAGES", "1");

    expect(devPagesEnabled()).toBe(true);
  });

  it("ignores values other than 1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GIZE_DEV_PAGES", "true");

    expect(devPagesEnabled()).toBe(false);
  });
});

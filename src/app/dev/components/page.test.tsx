import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/en.json";
import { renderWithProviders } from "../../../../tests/utils/render";

const { notFound, nav, mockNavigation } = await vi.hoisted(async () => {
  const helpers = await import("../../../../tests/utils/navigation");
  return {
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
    nav: helpers.createNavigationState(),
    ...helpers,
  };
});
vi.mock("next/navigation", () => ({ ...mockNavigation(nav), notFound }));

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

  it("renders the gallery when dev pages are enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GIZE_DEV_PAGES", "1");

    renderWithProviders(<DevComponentsPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: messages.DevComponents.title,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("table", {
        name: messages.DevComponents.routesLabel,
      }),
    ).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });
});

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../tests/utils/render";
import { StatusPill, type StatusTone } from "./status-pill";

describe("StatusPill", () => {
  it.each<StatusTone>(["success", "waiting", "neutral", "danger"])(
    "shows the status as text for the %s family, so it never relies on colour alone",
    (tone) => {
      renderWithProviders(<StatusPill tone={tone}>Forming</StatusPill>);

      const pill = screen.getByText("Forming");
      expect(pill).toBeVisible();
      expect(pill).toHaveAttribute("data-tone", tone);
    },
  );

  it("puts a dot before the words, for sight only", () => {
    renderWithProviders(<StatusPill tone="success">Active</StatusPill>);

    const pill = screen.getByText("Active").closest("[data-tone]");
    const dot = pill?.querySelector("[data-dot]");
    expect(dot).not.toBeNull();
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(pill).toHaveTextContent(/^Active$/);
  });
});

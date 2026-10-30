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
});

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/en.json";
import { renderWithProviders } from "../../../tests/utils/render";
import OverviewPage from "./page";

describe("OverviewPage (placeholder until /routes and GZW-070)", () => {
  it("has the page title as its only level-1 heading and explains the set-up", () => {
    renderWithProviders(<OverviewPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.Overview.title,
    );
    expect(screen.getByText(messages.Overview.description)).toBeInTheDocument();
  });
});

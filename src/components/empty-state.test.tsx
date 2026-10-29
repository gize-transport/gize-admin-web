import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../tests/utils/render";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("explains why nothing is shown and offers the next action", () => {
    renderWithProviders(
      <EmptyState
        title="No routes yet"
        description="Create the first route for this corridor."
        action={<button>New route</button>}
      />,
    );

    expect(screen.getByText("No routes yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create the first route for this corridor."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New route" }),
    ).toBeInTheDocument();
  });
});

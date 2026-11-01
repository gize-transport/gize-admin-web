import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";
import { renderWithProviders } from "../../tests/utils/render";
import HomePage from "./page";

// The greeting asks the API who is signed in (tested in staff-greeting.test.tsx).
vi.mock("./staff-greeting", () => ({ StaffGreeting: () => null }));

describe("HomePage (temporary placeholder until /routes exists)", () => {
  it("shows the portal name as the only level-1 heading", () => {
    renderWithProviders(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.HomePage.title,
    );
  });

  it("explains that the portal is being set up, using text from messages/en.json", () => {
    renderWithProviders(<HomePage />);

    expect(screen.getByText(messages.HomePage.description)).toBeInTheDocument();
  });

  it("renders inside a main landmark", () => {
    renderWithProviders(<HomePage />);

    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { level: 1 }),
    );
  });
});

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import messages from "../../messages/en.json";
import { renderWithProviders } from "../../tests/utils/render";
import { AuthCard } from "./auth-card";

describe("AuthCard", () => {
  it("names the page and shows its content beside the brand panel, whose routes are for sight only", () => {
    renderWithProviders(
      <AuthCard title="Sign in" description="For the operations team.">
        <button type="button">Continue</button>
      </AuthCard>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Sign in" }),
    ).toBeVisible();
    expect(screen.getByText("For the operations team.")).toBeVisible();
    expect(screen.getByText(messages.SignIn.tagline)).toBeVisible();
    expect(screen.getByText(messages.SignIn.summary)).toBeInTheDocument();
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([
      messages.SignIn.pointRoutes,
      messages.SignIn.pointRequests,
      messages.SignIn.pointPeople,
    ]);
    expect(screen.getByText(messages.Shell.brand)).toBeVisible();
    expect(screen.getByText(messages.Shell.brandTag)).toBeVisible();
    // The name beside the logo says it all: the logo itself is for sight only.
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("button", { name: "Continue" }),
    );
    expect(screen.getByTestId("routes-backdrop")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

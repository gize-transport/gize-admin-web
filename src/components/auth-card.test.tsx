import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import messages from "../../messages/en.json";
import { renderWithProviders } from "../../tests/utils/render";
import { AuthCard } from "./auth-card";

describe("AuthCard", () => {
  it("names the page and shows its content on the routes background, which is for sight only", () => {
    renderWithProviders(
      <AuthCard title="Sign in" description="For the operations team.">
        <button type="button">Continue</button>
      </AuthCard>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Sign in" }),
    ).toBeVisible();
    expect(screen.getByText("For the operations team.")).toBeVisible();
    expect(
      screen.getByRole("img", { name: messages.SignIn.logoAlt }),
    ).toBeVisible();
    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("button", { name: "Continue" }),
    );
    expect(screen.getByTestId("routes-backdrop")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

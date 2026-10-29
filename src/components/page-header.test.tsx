import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../tests/utils/render";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("shows the title as the page's level-1 heading with its summary", () => {
    renderWithProviders(
      <PageHeader title="Routes" description="14 active · 1 paused" />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Routes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("14 active · 1 paused")).toBeInTheDocument();
  });

  it("renders the page's actions", () => {
    renderWithProviders(
      <PageHeader title="Routes" actions={<button>New route</button>} />,
    );

    expect(
      screen.getByRole("button", { name: "New route" }),
    ).toBeInTheDocument();
  });
});

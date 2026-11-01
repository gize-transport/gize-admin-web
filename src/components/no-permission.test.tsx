import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import messages from "../../messages/en.json";
import { renderWithProviders } from "../../tests/utils/render";
import { NoPermission } from "./no-permission";

describe("NoPermission", () => {
  it("explains the 403 and links back to the overview", () => {
    renderWithProviders(<NoPermission />);

    expect(screen.getByText(messages.NoPermission.title)).toBeInTheDocument();
    expect(
      screen.getByText(messages.NoPermission.description),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: messages.NoPermission.backHome }),
    ).toHaveAttribute("href", "/");
  });
});

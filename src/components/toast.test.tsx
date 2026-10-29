import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import messages from "../../messages/en.json";
import { renderWithProviders } from "../../tests/utils/render";
import { showSuccessToast } from "./toast";
import { Toaster } from "./ui/sonner";

describe("success toast", () => {
  it("announces a success confirmation in the labelled notifications region", async () => {
    renderWithProviders(<Toaster label={messages.Common.notifications} />);

    act(() => showSuccessToast("Route R-14 is open."));

    expect(await screen.findByText("Route R-14 is open.")).toBeInTheDocument();
    expect(
      screen.getByRole("region", {
        name: new RegExp(messages.Common.notifications),
      }),
    ).toContainElement(screen.getByText("Route R-14 is open."));
  });
});

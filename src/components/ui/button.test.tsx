import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../tests/utils/render";
import { Button } from "./button";

describe("Button", () => {
  it("runs its action on click and with the keyboard", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(<Button onClick={onClick}>Save changes</Button>);

    const button = screen.getByRole("button", { name: "Save changes" });
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("while pending: stays focusable, is marked disabled and busy, and ignores clicks", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(
      <Button pending onClick={onClick}>
        Save changes
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");

    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");

    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it("does not submit its form while pending", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    renderWithProviders(
      <form
        onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}
        aria-label="Route"
      >
        <label>
          Name
          <input name="name" />
        </label>
        <Button type="submit" pending>
          Save
        </Button>
      </form>,
    );

    await user.type(screen.getByLabelText("Name"), "R-03{Enter}");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("doesn't submit its form unless it is a submit button", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    renderWithProviders(
      <form
        onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}
        aria-label="Route"
      >
        <Button>Copy reference</Button>
        <Button type="submit">Save</Button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Copy reference" }));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});

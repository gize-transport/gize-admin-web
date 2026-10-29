import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";
import { renderWithProviders } from "../../tests/utils/render";
import { ConfirmDialog } from "./confirm-dialog";

function Harness({
  pending = false,
  onConfirm = () => {},
}: {
  pending?: boolean;
  onConfirm?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Delete corridor</button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete corridor CMC → Mexico?"
        description="Its 3 routes keep running, but no new routes can use it."
        confirmLabel="Delete corridor"
        tone="destructive"
        pending={pending}
        onConfirm={onConfirm}
      />
    </>
  );
}

describe("ConfirmDialog", () => {
  it("states the consequence and starts on Cancel, the safe choice", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole("button", { name: "Delete corridor" }));

    const dialog = screen.getByRole("alertdialog", {
      name: "Delete corridor CMC → Mexico?",
    });
    expect(dialog).toHaveAccessibleDescription(
      "Its 3 routes keep running, but no new routes can use it.",
    );
    expect(
      screen.getByRole("button", { name: messages.Common.cancel }),
    ).toHaveFocus();
  });

  it("keeps keyboard focus inside the dialog", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.click(screen.getByRole("button", { name: "Delete corridor" }));
    const dialog = screen.getByRole("alertdialog");

    await user.tab();
    await user.tab();
    await user.tab();

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("closes on Escape and returns focus to the button that opened it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    const opener = screen.getByRole("button", { name: "Delete corridor" });
    await user.click(opener);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("calls onConfirm and leaves closing to the caller, so failures can stay visible", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Delete corridor" }));

    const dialog = screen.getByRole("alertdialog");
    await user.click(
      screen.getAllByRole("button", { name: "Delete corridor" }).at(-1)!,
    );

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(dialog).toBeInTheDocument();
  });

  it("while pending: both buttons are disabled and Escape does not close it", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(<Harness pending onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Delete corridor" }));
    const dialog = screen.getByRole("alertdialog");

    const confirm = screen
      .getAllByRole("button", { name: "Delete corridor" })
      .at(-1)!;
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: messages.Common.cancel }),
    ).toHaveAttribute("aria-disabled", "true");

    await user.click(confirm);
    await user.keyboard("{Escape}");

    expect(onConfirm).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });
});

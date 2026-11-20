import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { renderWithProviders } from "../../../tests/utils/render";
import {
  ActionsMenu,
  ActionsMenuItem,
  ActionsMenuSeparator,
  CopyLinkItem,
} from "./actions-menu";

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

beforeEach(() => {
  toast.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A detail's menu: one item opens a confirmation, as Delete does. */
function Menu({ onRename }: { onRename?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <ActionsMenu name="B-01">
        <ActionsMenuItem onSelect={() => onRename?.()}>Rename</ActionsMenuItem>
        <CopyLinkItem path="/routes/route-1" />
        <ActionsMenuSeparator />
        <ActionsMenuItem tone="danger" onSelect={() => setConfirming(true)}>
          Delete route
        </ActionsMenuItem>
      </ActionsMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete B-01?"
        description="It can't be undone."
        confirmLabel="Delete route"
        tone="destructive"
        onConfirm={() => setConfirming(false)}
      />
    </>
  );
}

describe("ActionsMenu", () => {
  it("is one button named after the record, which opens the actions", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Menu />);

    const button = screen.getByRole("button", { name: "Actions for B-01" });
    expect(button).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(button);

    const menu = await screen.findByRole("menu", {
      name: "Actions for B-01",
    });
    expect(menu).toBeVisible();
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Rename", "Copy link", "Delete route"]);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("runs an item's action once the menu has closed", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    renderWithProviders(<Menu onRename={onRename} />);

    await user.click(screen.getByRole("button", { name: "Actions for B-01" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));

    await waitFor(() => expect(onRename).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("returns focus to the button when a dialog opened from it closes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Menu />);
    const button = screen.getByRole("button", { name: "Actions for B-01" });

    await user.click(button);
    await user.click(
      await screen.findByRole("menuitem", { name: "Delete route" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete B-01?",
    });
    expect(dialog).toBeVisible();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(button).toHaveFocus();
  });

  it("works from the keyboard: Enter opens it, arrows move, Enter picks", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    renderWithProviders(<Menu onRename={onRename} />);
    const button = screen.getByRole("button", { name: "Actions for B-01" });

    button.focus();
    await user.keyboard("{Enter}");
    // The first item takes focus when the menu opens from the keyboard.
    expect(
      await screen.findByRole("menuitem", { name: "Rename" }),
    ).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Copy link" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{Enter}");

    await waitFor(() => expect(onRename).toHaveBeenCalledTimes(1));
    expect(button).toHaveFocus();
  });

  it("marks a destructive item so it reads as one", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Menu />);

    await user.click(screen.getByRole("button", { name: "Actions for B-01" }));

    expect(
      await screen.findByRole("menuitem", { name: "Delete route" }),
    ).toHaveAttribute("data-tone", "danger");
    expect(
      screen.getByRole("menuitem", { name: "Rename" }),
    ).not.toHaveAttribute("data-tone");
  });
});

describe("CopyLinkItem", () => {
  it("copies the record's page address and confirms it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Menu />);

    await user.click(screen.getByRole("button", { name: "Actions for B-01" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Copy link" }),
    );

    await waitFor(() => expect(toast).toHaveBeenCalledWith("Link copied"));
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/routes/route-1`,
    );
  });

  it("says to copy it by hand where there's no clipboard at all", async () => {
    const user = userEvent.setup();
    // No clipboard API (a page served over plain http).
    vi.spyOn(navigator, "clipboard", "get").mockReturnValue(
      undefined as unknown as Clipboard,
    );
    renderWithProviders(<Menu />);

    await user.click(screen.getByRole("button", { name: "Actions for B-01" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Copy link" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't copy the link. Copy it from the address bar instead.",
    );
    expect(toast).not.toHaveBeenCalled();
  });

  it("says to copy it by hand when the clipboard can't be used", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );
    renderWithProviders(<Menu />);

    await user.click(screen.getByRole("button", { name: "Actions for B-01" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Copy link" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't copy the link. Copy it from the address bar instead.",
    );
    expect(toast).not.toHaveBeenCalled();

    // Gone once the menu is used again.
    await user.click(screen.getByRole("button", { name: "Actions for B-01" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

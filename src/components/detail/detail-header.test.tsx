import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../tests/utils/render";
import { ActionsMenu, ActionsMenuItem, CopyLinkItem } from "./actions-menu";
import type { DetailLayout } from "./detail-frame";
import { DetailHeader } from "./detail-header";

function layout(variant: "page" | "panel"): DetailLayout {
  return {
    variant,
    headingId: "record-heading",
    SectionHeading: variant === "page" ? "h2" : "h3",
    backLink:
      variant === "page" ? <Link href="/routes">All routes</Link> : null,
    closeButton:
      variant === "panel" ? <button type="button">Close details</button> : null,
  };
}

function Header({ variant }: { variant: "page" | "panel" }) {
  return (
    <DetailHeader
      layout={layout(variant)}
      title="B-01"
      status={<span>Forming</span>}
      summary="Bole → Piassa · Public"
      actions={<button type="button">Edit</button>}
      menu={
        <ActionsMenu name="B-01">
          <ActionsMenuItem onSelect={() => {}}>Add a van</ActionsMenuItem>
        </ActionsMenu>
      }
    />
  );
}

/** The pinned row: the name, the status and the buttons. */
function pinnedRow() {
  const row = document.querySelector<HTMLElement>(
    "[data-slot='detail-header-row']",
  );
  if (!row) throw new Error("no pinned row");
  return row;
}

describe("DetailHeader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("on a page: the link back, the name as h1, its status, actions and summary", () => {
    renderWithProviders(<Header variant="page" />);

    expect(screen.getByRole("link", { name: "All routes" })).toBeVisible();
    const heading = screen.getByRole("heading", { level: 1, name: "B-01" });
    expect(heading).toHaveAttribute("id", "record-heading");
    expect(screen.getByText("Forming")).toBeVisible();
    expect(screen.getByText("Bole → Piassa · Public")).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Actions for B-01" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Close details" }),
    ).not.toBeInTheDocument();
  });

  it("in a panel: the name as h2, and the close button after the actions", () => {
    renderWithProviders(<Header variant="panel" />);

    expect(
      screen.getByRole("heading", { level: 2, name: "B-01" }),
    ).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    const buttons = Array.from(pinnedRow().querySelectorAll("button")).map(
      (button) => button.textContent || button.getAttribute("aria-label"),
    );
    expect(buttons).toEqual(["Edit", "Actions for B-01", "Close details"]);
  });

  it("keeps the name, status and buttons in the pinned row; the rest scrolls", () => {
    renderWithProviders(<Header variant="page" />);

    const row = pinnedRow();
    expect(row).toContainElement(screen.getByRole("heading", { name: "B-01" }));
    expect(row).toContainElement(screen.getByText("Forming"));
    expect(row).toContainElement(screen.getByRole("button", { name: "Edit" }));
    expect(row).not.toContainElement(
      screen.getByRole("link", { name: "All routes" }),
    );
    expect(row).not.toContainElement(
      screen.getByText("Bole → Piassa · Public"),
    );
  });

  it("marks the row once it's pinned, as the record scrolls under it", () => {
    renderWithProviders(<Header variant="page" />);
    const row = pinnedRow();
    const next = row.nextElementSibling as HTMLElement;
    const place = (element: HTMLElement, top: number, bottom: number) =>
      vi
        .spyOn(element, "getBoundingClientRect")
        .mockReturnValue({ top, bottom } as DOMRect);
    expect(row).not.toHaveAttribute("data-stuck");

    // Scrolled: the row stays at the top, the summary has moved up under it.
    place(row, 0, 52);
    place(next, 10, 30);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(row).toHaveAttribute("data-stuck");

    // Back at the top: the summary starts at the row's bottom again.
    place(row, 120, 172);
    place(next, 172, 192);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(row).not.toHaveAttribute("data-stuck");
  });

  it("says under the row, not in it, when the link can't be copied", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );
    renderWithProviders(
      <DetailHeader
        layout={layout("panel")}
        title="B-01"
        menu={
          <ActionsMenu name="B-01">
            <CopyLinkItem path="/routes/route-1" />
          </ActionsMenu>
        }
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions for B-01" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Copy link" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Couldn't copy the link. Copy it from the address bar instead.",
    );
    expect(pinnedRow()).not.toContainElement(alert);
  });
});

import { renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { renderWithProviders } from "../../../tests/utils/render";
import { SortMenu, useListSort } from "./sort-menu";

// vi.hoisted runs before imports, so the helper is imported inside it.
const { nav, mockNavigation } = await vi.hoisted(async () => {
  const helpers = await import("../../../tests/utils/navigation");
  return { nav: helpers.createNavigationState(), ...helpers };
});
vi.mock("next/navigation", () => mockNavigation(nav));

const options = [
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name A to Z" },
];

function renderMenu() {
  return renderWithProviders(<SortMenu options={options} />);
}

beforeEach(() => {
  nav.pathname = "/riders";
  nav.search = "";
  nav.push.mockClear();
});

describe("SortMenu", () => {
  it("reads Sort on the list's default order", () => {
    renderMenu();

    const button = screen.getByRole("button", {
      name: messages.DataTable.sort,
    });
    expect(button).toHaveAttribute("aria-haspopup", "menu");
    expect(button).not.toHaveAttribute("data-active");
  });

  it("names another order and shows it's on", () => {
    nav.search = "sort=name";
    renderMenu();

    expect(
      screen.getByRole("button", { name: "Sort: Name A to Z" }),
    ).toHaveAttribute("data-active");
  });

  it("treats an order it doesn't know as the default", () => {
    nav.search = "sort=bogus";
    renderMenu();

    expect(
      screen.getByRole("button", { name: messages.DataTable.sort }),
    ).not.toHaveAttribute("data-active");
  });

  it("lists the orders, the current one checked, without an All", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(
      screen.getByRole("button", { name: messages.DataTable.sort }),
    );

    const menu = await screen.findByRole("menu", {
      name: messages.DataTable.sort,
    });
    const items = within(menu).getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual([
      "Newest first",
      "Name A to Z",
    ]);
    expect(items.map((item) => item.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
    ]);
  });

  it("puts the order in the URL and goes back to the first page", async () => {
    const user = userEvent.setup();
    nav.search = "type=adult&cursor=c2";
    renderMenu();

    await user.click(
      screen.getByRole("button", { name: messages.DataTable.sort }),
    );
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Name A to Z" }),
    );

    expect(nav.push).toHaveBeenCalledExactlyOnceWith(
      "/riders?type=adult&sort=name",
      { scroll: false },
    );
    expect(screen.queryByRole("menu")).toBeNull();
    expect(
      screen.getByRole("button", { name: messages.DataTable.sort }),
    ).toHaveFocus();
  });

  it("leaves the default order out of the URL", async () => {
    const user = userEvent.setup();
    nav.search = "sort=name&cursor=name.c2";
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Sort: Name A to Z" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Newest first" }),
    );

    expect(nav.push).toHaveBeenCalledExactlyOnceWith("/riders", {
      scroll: false,
    });
  });

  it("does nothing when the current order is picked again", async () => {
    const user = userEvent.setup();
    nav.search = "sort=name&cursor=c2";
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Sort: Name A to Z" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Name A to Z" }),
    );

    expect(nav.push).not.toHaveBeenCalled();
  });

  it("works with the keyboard alone", async () => {
    const user = userEvent.setup();
    renderMenu();

    screen.getByRole("button", { name: messages.DataTable.sort }).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    expect(
      screen.getByRole("menuitemradio", { name: "Newest first" }),
    ).toHaveFocus();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(nav.push).toHaveBeenCalledExactlyOnceWith("/riders?sort=name", {
      scroll: false,
    });
  });
});

describe("useListSort", () => {
  const values = ["newest", "name"] as const;

  it("is null on the default order, and for one the list doesn't take", () => {
    for (const search of ["", "sort=newest", "sort=bogus", "sort="]) {
      nav.search = search;
      expect(renderHook(() => useListSort(values)).result.current).toBeNull();
    }
  });

  it("is the order the URL asks for", () => {
    nav.search = "sort=name";
    expect(renderHook(() => useListSort(values)).result.current).toBe("name");
  });
});

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { renderWithProviders } from "../../../tests/utils/render";
import { ClearFilters } from "./clear-filters";
import { FilterMenu } from "./filter-menu";
import { ListToolbar } from "./list-toolbar";

// vi.hoisted runs before imports, so the helper is imported inside it.
const { nav, mockNavigation } = await vi.hoisted(async () => {
  const helpers = await import("../../../tests/utils/navigation");
  return { nav: helpers.createNavigationState(), ...helpers };
});
vi.mock("next/navigation", () => mockNavigation(nav));

const options = [
  { value: "public", label: "Public" },
  { value: "student", label: "Student" },
];

function renderMenu() {
  return renderWithProviders(
    <FilterMenu param="type" label="Type" options={options} />,
  );
}

beforeEach(() => {
  nav.pathname = "/routes";
  nav.search = "";
  nav.push.mockClear();
});

describe("FilterMenu", () => {
  it("is a button named by the filter while it's off", () => {
    renderMenu();

    const button = screen.getByRole("button", { name: "Type" });
    expect(button).toHaveAttribute("aria-haspopup", "menu");
    expect(button).not.toHaveAttribute("data-active");
  });

  it("says which choice is on, and treats an empty value as off", () => {
    nav.search = "type=student";
    const { unmount } = renderMenu();
    expect(
      screen.getByRole("button", { name: "Type: Student" }),
    ).toHaveAttribute("data-active");
    unmount();

    nav.search = "type=";
    renderMenu();
    expect(screen.getByRole("button", { name: "Type" })).toBeInTheDocument();
  });

  it("treats a value it doesn't know as off", () => {
    nav.search = "type=bogus";
    renderMenu();

    expect(screen.getByRole("button", { name: "Type" })).not.toHaveAttribute(
      "data-active",
    );
  });

  it("keeps a long menu within the screen, scrolling", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Type" }));

    expect(await screen.findByRole("menu")).toHaveClass("overflow-y-auto");
  });

  it("lists All and the choices, the current one checked", async () => {
    const user = userEvent.setup();
    nav.search = "type=student";
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Type: Student" }));

    const menu = await screen.findByRole("menu", { name: "Type" });
    const items = within(menu).getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual([
      messages.DataTable.all,
      "Public",
      "Student",
    ]);
    expect(items.map((item) => item.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "true",
    ]);
  });

  it("puts the choice in the URL and goes back to the first page", async () => {
    const user = userEvent.setup();
    nav.search = "q=abel&cursor=c2";
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Type" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Student" }),
    );

    expect(nav.push).toHaveBeenCalledExactlyOnceWith(
      "/routes?q=abel&type=student",
      { scroll: false },
    );
    // Closed, focus back on its button.
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Type" })).toHaveFocus();
  });

  it("removes the filter with All", async () => {
    const user = userEvent.setup();
    nav.search = "type=student&cursor=c2";
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Type: Student" }));
    await user.click(
      await screen.findByRole("menuitemradio", {
        name: messages.DataTable.all,
      }),
    );

    expect(nav.push).toHaveBeenCalledExactlyOnceWith("/routes", {
      scroll: false,
    });
  });

  it("works with the keyboard alone", async () => {
    const user = userEvent.setup();
    renderMenu();

    screen.getByRole("button", { name: "Type" }).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu", { name: "Type" });
    // Opening by keyboard focuses All; one down is Public.
    expect(
      screen.getByRole("menuitemradio", { name: messages.DataTable.all }),
    ).toHaveFocus();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(nav.push).toHaveBeenCalledExactlyOnceWith("/routes?type=public", {
      scroll: false,
    });
  });

  it("closes on Escape without changing anything", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Type" }));
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
    expect(nav.push).not.toHaveBeenCalled();
  });
});

describe("ClearFilters", () => {
  it("shows only while one of its filters is on, and clears them all", async () => {
    const user = userEvent.setup();
    nav.search = "q=abel&type=student&status=active&cursor=c2";
    renderWithProviders(<ClearFilters params={["q", "type", "status"]} />);

    await user.click(
      screen.getByRole("button", { name: messages.DataTable.clearFilters }),
    );

    expect(nav.push).toHaveBeenCalledExactlyOnceWith("/routes", {
      scroll: false,
    });
  });

  it("leaves focus on the toolbar's first control as it goes", async () => {
    const user = userEvent.setup();
    nav.search = "type=student";
    renderWithProviders(
      <ListToolbar>
        <label>
          Search
          <input />
        </label>
        <FilterMenu param="type" label="Type" options={options} />
        <ClearFilters params={["type"]} />
      </ListToolbar>,
    );

    await user.click(
      screen.getByRole("button", { name: messages.DataTable.clearFilters }),
    );

    expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();
  });

  it("isn't there when nothing is filtered", () => {
    nav.search = "cursor=c2&other=1";
    renderWithProviders(<ClearFilters params={["q", "type"]} />);

    expect(
      screen.queryByRole("button", { name: messages.DataTable.clearFilters }),
    ).toBeNull();
  });
});

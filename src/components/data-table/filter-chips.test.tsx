import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { renderWithProviders } from "../../../tests/utils/render";
import { FilterChips } from "./filter-chips";

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

function renderChips() {
  return renderWithProviders(
    <FilterChips param="type" label="Route type" options={options} />,
  );
}

beforeEach(() => {
  nav.pathname = "/routes";
  nav.search = "";
  nav.push.mockClear();
});

describe("FilterChips", () => {
  it("is a labelled group with All pressed when the URL has no filter", () => {
    renderChips();

    expect(
      screen.getByRole("group", { name: "Route type" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: messages.DataTable.all }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Public" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reflects the filter in the URL", () => {
    nav.search = "type=student";
    renderChips();

    expect(screen.getByRole("button", { name: "Student" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: messages.DataTable.all }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("puts the chosen filter in the URL and goes back to the first page", async () => {
    const user = userEvent.setup();
    nav.search = "q=abel&cursor=c2";
    renderChips();

    await user.click(screen.getByRole("button", { name: "Student" }));

    expect(nav.push).toHaveBeenCalledExactlyOnceWith(
      "/routes?q=abel&type=student",
      { scroll: false },
    );
  });

  it("removes the filter from the URL with All", async () => {
    const user = userEvent.setup();
    nav.search = "type=student&cursor=c2";
    renderChips();

    await user.click(
      screen.getByRole("button", { name: messages.DataTable.all }),
    );

    expect(nav.push).toHaveBeenCalledExactlyOnceWith("/routes", {
      scroll: false,
    });
  });
});

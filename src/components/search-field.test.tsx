import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../tests/utils/render";
import { SearchField } from "./search-field";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/areas";
  nav.state = state;
  return mockNavigation(state);
});

type Nav = ReturnType<
  typeof import("../../tests/utils/navigation").createNavigationState
>;
const navigation = () => nav.state as Nav;

const field = () => <SearchField param="q" label="Search areas" />;

beforeEach(() => {
  navigation().search = "";
  navigation().replace.mockClear();
  navigation().push.mockClear();
});

describe("SearchField", () => {
  it("writes the trimmed text to the URL after a pause, replacing the history entry", async () => {
    const user = userEvent.setup();
    renderWithProviders(field());

    await user.type(screen.getByLabelText("Search areas"), " me ");

    await waitFor(() =>
      expect(navigation().replace).toHaveBeenCalledWith("/areas?q=me", {
        scroll: false,
      }),
    );
    expect(navigation().replace).toHaveBeenCalledTimes(1);
    expect(navigation().push).not.toHaveBeenCalled();
  });

  it("writes at once when the box loses focus (before a click elsewhere navigates), and only once", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        {field()}
        <button type="button">Elsewhere</button>
      </>,
    );

    await user.type(screen.getByLabelText("Search areas"), "Bole");
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));

    // Right away, without waiting for the pause.
    expect(navigation().replace).toHaveBeenCalledWith("/areas?q=Bole", {
      scroll: false,
    });
    // The pause then finds nothing new to write.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(navigation().replace).toHaveBeenCalledTimes(1);
  });

  it("keeps what was typed while a slow navigation finishes", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(field());
    const input = screen.getByLabelText("Search areas");

    await user.type(input, "Bo");
    await waitFor(() =>
      expect(navigation().replace).toHaveBeenLastCalledWith("/areas?q=Bo", {
        scroll: false,
      }),
    );
    // More typing before the navigation to "Bo" has finished…
    await user.type(input, "l");
    // …then it finishes.
    navigation().search = "?q=Bo";
    rerender(field());

    expect(input).toHaveValue("Bol");
    await waitFor(() =>
      expect(navigation().replace).toHaveBeenLastCalledWith("/areas?q=Bol", {
        scroll: false,
      }),
    );
  });

  it("shows a search that changed elsewhere (Back, Clear search)", async () => {
    navigation().search = "?q=me";
    const { rerender } = renderWithProviders(field());
    const input = screen.getByLabelText("Search areas");
    expect(input).toHaveValue("me");

    navigation().search = "?q=pi";
    rerender(field());
    expect(input).toHaveValue("pi");

    navigation().search = "";
    rerender(field());
    expect(input).toHaveValue("");
    expect(navigation().replace).not.toHaveBeenCalled();
  });
});

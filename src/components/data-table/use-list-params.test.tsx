import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useListParams } from "./use-list-params";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/routes";
  nav.state = state;
  return mockNavigation(state);
});

type Nav = ReturnType<
  typeof import("../../../tests/utils/navigation").createNavigationState
>;
const navigation = () => nav.state as Nav;

beforeEach(() => {
  navigation().search = "?status=active";
  navigation().push.mockClear();
  navigation().replace.mockClear();
});

describe("useListParams", () => {
  it("builds each navigation on the one asked for just before, until the URL catches up", () => {
    const { result } = renderHook(() => useListParams());
    // The search box's write after a pause: set up from this render…
    const writeSearchLater = result.current.setFilter;

    // …a row opens in the side panel meanwhile (the URL hasn't changed yet)…
    act(() => result.current.setParams({ route: "r-1" }));
    // …then the search box writes.
    act(() => writeSearchLater("q", "b-", { replace: true }));

    expect(navigation().push).toHaveBeenLastCalledWith(
      "/routes?status=active&route=r-1",
      { scroll: false },
    );
    // The open route is kept, and a new search starts from the first page.
    expect(navigation().replace).toHaveBeenLastCalledWith(
      "/routes?status=active&route=r-1&q=b-",
      { scroll: false },
    );
  });

  it("goes back to the URL once it changes (a navigation landed, Back)", () => {
    const { result, rerender } = renderHook(() => useListParams());
    act(() => result.current.setParams({ route: "r-1" }));

    navigation().search = "?status=paused";
    rerender();
    act(() => result.current.setFilter("q", "b-"));

    expect(navigation().push).toHaveBeenLastCalledWith(
      "/routes?status=paused&q=b-",
      { scroll: false },
    );
  });
});

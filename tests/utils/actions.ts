import { screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { expect } from "vitest";

/** A detail's "⋯" button (one per detail): "Actions for B-01". */
export function actionsButton() {
  return screen.getByRole("button", { name: /^Actions for / });
}

/** Opens the detail's "⋯" menu and picks an item ("Delete route"). */
export async function chooseAction(user: UserEvent, item: string | RegExp) {
  // Waits for the detail to load.
  await user.click(
    await screen.findByRole("button", { name: /^Actions for / }),
  );
  await user.click(await screen.findByRole("menuitem", { name: item }));
  // The item's action runs once the menu has closed.
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
}

/** The items in the detail's "⋯" menu, in order; closes it again. */
export async function actionItems(user: UserEvent) {
  await user.click(
    await screen.findByRole("button", { name: /^Actions for / }),
  );
  await screen.findByRole("menu");
  const items = screen
    .getAllByRole("menuitem")
    .map((item) => item.textContent ?? "");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  return items;
}

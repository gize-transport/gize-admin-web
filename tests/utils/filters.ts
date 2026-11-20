import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A list toolbar's filter menu button: "Status", or "Status: Active" while that's on. */
export function filterButton(label: string, choice?: string) {
  return screen.getByRole("button", {
    name: choice ? `${label}: ${choice}` : label,
  });
}

/** Opens a filter menu ("Status", whatever it shows now) and picks a choice ("Active"). */
export async function chooseFilter(
  user: UserEvent,
  label: string,
  choice: string,
) {
  await user.click(
    screen.getByRole("button", {
      name: new RegExp(`^${escape(label)}(: .+)?$`),
    }),
  );
  await user.click(await screen.findByRole("menuitemradio", { name: choice }));
}

/**
 * The list's empty state: its "Clear filters" is named like the toolbar's (both clear the
 * filters), so find it in here.
 */
export function emptyState() {
  const element = document.querySelector<HTMLElement>(
    "[data-slot='empty-state']",
  );
  if (!element) throw new Error("no empty state");
  return within(element);
}

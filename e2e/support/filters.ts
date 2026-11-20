import { expect, type Page } from "@playwright/test";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A list toolbar's filter menu button: "Status", or "Status: Active" while that's on. */
export function filterButton(page: Page, label: string, choice?: string) {
  return page.getByRole("button", {
    name: choice ? `${label}: ${choice}` : label,
    exact: true,
  });
}

/** Opens a filter menu ("Status", whatever it shows now) and picks a choice ("Active"). */
export async function chooseFilter(page: Page, label: string, choice: string) {
  const button = page.getByRole("button", {
    name: new RegExp(`^${escape(label)}(: .+)?$`),
  });
  await button.click();
  await page.getByRole("menuitemradio", { name: choice, exact: true }).click();
  // The menu closes and gives focus back to its button: wait, so the next step's focus isn't
  // taken back.
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(button).toBeFocused();
}

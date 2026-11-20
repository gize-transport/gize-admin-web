import { expect, type Locator } from "@playwright/test";

/** Shows one of a record's tabs ("Status and launch"), whatever badge it carries. */
export async function openTab(scope: Locator, name: string) {
  const tab = scope.getByRole("tab", { name: new RegExp(`^${name}`) });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

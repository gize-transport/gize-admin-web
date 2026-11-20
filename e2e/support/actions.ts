import { expect, type Locator, type Page } from "@playwright/test";

/** A detail's "⋯" button ("Actions for B-01"), inside its panel or page. */
export function actionsButton(scope: Locator | Page) {
  return scope.getByRole("button", { name: /^Actions for / });
}

/**
 * Opens a detail's "⋯" menu and picks an item ("Delete route"). With `keyboard`, the way a
 * keyboard user does: Enter on the button, Enter on the item. The menu sits outside the detail
 * (in a portal), so items are found on the page.
 */
export async function chooseAction(
  page: Page,
  scope: Locator | Page,
  item: string,
  { keyboard = false }: { keyboard?: boolean } = {},
) {
  const button = actionsButton(scope);
  const menuItem = page.getByRole("menuitem", { name: item, exact: true });
  if (keyboard) {
    await button.press("Enter");
    await menuItem.press("Enter");
  } else {
    await button.click();
    await menuItem.click();
  }
  await expect(page.getByRole("menu")).toHaveCount(0);
}

/** The items in a detail's "⋯" menu, in order; closes it again. */
export async function actionItems(page: Page, scope: Locator | Page) {
  await actionsButton(scope).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const items = await menu.getByRole("menuitem").allTextContents();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  return items;
}

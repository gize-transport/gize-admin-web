import { expect, test, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";
import { expectNoSeriousA11yViolations } from "./support/axe";

const t = messages.Routes;
const tPicker = messages.DriverPicker;

const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    text,
  );

// Sample data in the stand-in (e2e/support/fake-services.mjs): running routes with the same
// times as B-07, one per Playwright project, and a driver for each. Bereket Tolosa drives B-07.
const SETUPS = {
  desktop: {
    route: { id: "00000000-0000-4000-d000-000000000010", code: "B-31" },
    driver: { name: "Fikru Hailu", plate: "AA 2-A54321" },
  },
  mobile: {
    route: { id: "00000000-0000-4000-d000-000000000011", code: "B-32" },
    driver: { name: "Yared Kebede", plate: "AA 2-A54322" },
  },
};

/** Picks a driver with the keyboard alone: focus the picker, Enter, type, Enter. */
async function pickDriver(page: Page, name: string, plate: string) {
  const picker = page
    .getByRole("dialog")
    .getByRole("combobox", { name: t.driverLabel, exact: true });
  await picker.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("combobox", { name: tPicker.searchLabel })
    .fill(name.slice(0, 4));
  await expect(
    page.getByRole("option", { name: `${name} · ${plate}`, exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(picker).toHaveText(`${name} · ${plate}`);
}

test("staff give a route a driver, are told why a busy one can't drive it, and remove the driver", async ({
  page,
}, testInfo) => {
  const { route, driver } =
    testInfo.project.name === "mobile" ? SETUPS.mobile : SETUPS.desktop;
  await signIn(page, "staff", `/routes/${route.id}`);
  const details = page.getByRole("article", { name: route.code });

  // On a retry (CI) the route may already have this driver: Change instead of Choose.
  await details
    .getByRole("button", { name: /^(Choose|Change) driver$/ })
    .click();
  let dialog = page.getByRole("dialog", {
    name: fill(t.driverTitle, { code: route.code }),
  });
  await pickDriver(page, driver.name, driver.plate);
  await dialog.getByRole("button", { name: t.driverSave }).click();
  await expect(page.getByText(t.driverSavedToast)).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(details.getByRole("link", { name: driver.name })).toBeVisible();

  // Bereket Tolosa drives B-07 at the same times: refused, and said why on the picker.
  await details.getByRole("button", { name: t.changeDriver }).press("Enter");
  dialog = page.getByRole("dialog", {
    name: fill(t.driverTitle, { code: route.code }),
  });
  await pickDriver(page, "Bereket Tolosa", "AA 3-B12341");
  await dialog.getByRole("button", { name: t.driverSave }).click();
  const picker = dialog.getByRole("combobox", {
    name: t.driverLabel,
    exact: true,
  });
  await expect(picker).toHaveAccessibleDescription(
    new RegExp(fill(t.driverBusy, { name: "Bereket Tolosa" }).slice(0, 40)),
  );
  await expect(picker).toBeFocused();
  await expectNoSeriousA11yViolations(page);
  await dialog.getByRole("button", { name: messages.Common.cancel }).click();
  await expect(details.getByRole("link", { name: driver.name })).toBeVisible();

  // Removed again (the sample data stays as it was).
  await details.getByRole("button", { name: t.removeDriver }).press("Enter");
  await page
    .getByRole("alertdialog", {
      name: fill(t.removeDriverTitle, {
        name: driver.name,
        code: route.code,
      }),
    })
    .getByRole("button", { name: t.removeDriver })
    .click();
  await expect(details.getByText(t.driverNone)).toBeVisible();
});

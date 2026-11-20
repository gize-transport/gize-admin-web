import { expect, test, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { chooseFilter } from "./support/filters";
import { signIn } from "./support/auth";

const t = messages.AuditLog;

/** The row of an entry, by its action's words. */
function row(page: Page, action: string) {
  return page
    .getByRole("table", { name: t.tableLabel })
    .getByRole("row")
    .filter({ hasText: action });
}

test.describe("audit log", () => {
  test("an admin reads what changed, hidden personal values shown as hidden", async ({
    page,
  }) => {
    await signIn(page, "admin", "/sign-in?next=%2Faudit-log");
    const company = row(page, t.actions.company.updated);
    await expect(company).toContainText("Selam Staff");
    await company.getByText(t.showChanges).click();
    const changes = company.getByRole("table", { name: t.changesLabel });
    await expect(changes.getByText(t.redacted)).toHaveCount(3);
    await expect(changes).not.toContainText("[redacted]");

    // Made by an operator command, not a staff member.
    await expect(row(page, t.actions.staff.first_admin_created)).toContainText(
      t.operator,
    );
  });

  test("filters by who made a change, and shows one record's history", async ({
    page,
  }) => {
    await signIn(page, "admin", "/sign-in?next=%2Faudit-log");
    await chooseFilter(page, t.actorFilter, "Selam Staff");
    // Her change shows (the filtered list has loaded) before another's is looked for.
    await expect(row(page, t.actions.route.status_changed)).toBeVisible();
    await expect(row(page, t.actions.area.renamed)).toHaveCount(0);

    await chooseFilter(page, t.actorFilter, messages.DataTable.all);
    // Everyone's changes have loaded (another's shows again) before a row is used: the filtered
    // list's rows are replaced as it loads.
    await expect(row(page, t.actions.area.renamed)).toBeVisible();
    const status = row(page, t.actions.route.status_changed);
    await status.getByText(t.showChanges).click();
    await status.getByRole("button", { name: t.recordHistory }).click();

    // Focus moves to the banner that replaced the button's row.
    const banner = page.getByText(t.recordFilter.replace("{type}", "route"));
    await expect(banner).toBeVisible();
    await expect(banner.locator("..")).toBeFocused();
    // B-01's history: its prices and its status.
    await expect(
      page.getByRole("table", { name: t.tableLabel }).getByText(t.showChanges),
    ).toHaveCount(2);
    await page
      .getByRole("link", { name: t.openRecord.replace("{type}", "route") })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "B-01" }),
    ).toBeVisible();
  });

  test("staff don't see the audit log", async ({ page }) => {
    await signIn(page, "staff", "/sign-in?next=%2Faudit-log");
    await expect(page.getByText(messages.NoPermission.title)).toBeVisible();
    await expect(
      page.getByRole("link", { name: messages.Shell.nav.auditLog }),
    ).toHaveCount(0);
  });
});

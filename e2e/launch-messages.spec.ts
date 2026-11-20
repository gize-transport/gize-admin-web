import { expect, test } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";
import { expectNoSeriousA11yViolations } from "./support/axe";

const t = messages.LaunchMessages;

// Sample data in the stand-in (e2e/support/fake-services.mjs): running routes launched on
// 1 November, one per Playwright project (sending again changes them).
const ROUTES = {
  desktop: { id: "00000000-0000-4000-d000-000000000010", code: "B-31" },
  mobile: { id: "00000000-0000-4000-d000-000000000011", code: "B-32" },
};

test("staff see how a launch's texts went and send the failed and unsent ones again", async ({
  page,
}, testInfo) => {
  const route =
    testInfo.project.name === "mobile" ? ROUTES.mobile : ROUTES.desktop;
  await signIn(page, "staff");
  await page.goto(`/routes/${route.id}?tab=status`);

  const list = page.getByRole("list", { name: t.listLabel });
  const item = (name: string) =>
    list.getByRole("listitem").filter({ hasText: name });
  await expect(
    item("Abebe Worku").getByText(t.status.sent, { exact: true }),
  ).toBeVisible();
  // No phone numbers here: the name opens the rider.
  await expect(list).not.toContainText(/\+251/);
  await expect(item("Liya Tadesse")).toContainText(t.unconfirmedHint);

  // Sending again changes the sample data: on a retry (CI) it may be done already.
  const sendAgain = page.getByRole("button", { name: "Send again (2)" });
  await expect(
    sendAgain
      .or(item("Hana Girma").getByText(t.status.sent, { exact: true }))
      .first(),
  ).toBeVisible();
  if (await sendAgain.isVisible()) {
    await expect(
      page.getByText(
        "Launched for Nov 1, 2026 · 4 riders · 1 sent · 1 may have arrived · 1 not delivered · 1 not sent yet",
      ),
    ).toBeVisible();
    await expect(item("Hana Girma")).toContainText("Tried 2 times");
    await sendAgain.click();
    const dialog = page.getByRole("alertdialog", { name: t.retryTitle });
    await expect(dialog).toContainText(
      "It goes to the 2 riders whose text wasn't delivered or wasn't sent yet.",
    );
    await expectNoSeriousA11yViolations(page);
    await dialog.getByRole("button", { name: t.retryConfirm }).click();
    await expect(page.getByText(t.retriedToast)).toBeVisible();
  }

  // The texts go out after the answer; the list follows them until they have.
  await expect(
    item("Hana Girma").getByText(t.status.sent, { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    item("Kidus Mekonnen").getByText(t.status.sent, { exact: true }),
  ).toBeVisible();
  await expect(item("Liya Tadesse")).toContainText(t.status.unconfirmed);
  await expect(
    page.getByRole("button", { name: /Send again/ }),
  ).not.toBeVisible();
});

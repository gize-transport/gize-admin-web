import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import messages from "../messages/en.json";
import { signIn } from "./support/auth";

const t = messages.Offers;
const tr = messages.RouteRequests;

// Sample data in the stand-in (e2e/support/fake-services.mjs): running routes with free seats,
// one per Playwright project (offers change what's free).
const ROUTES = {
  desktop: { id: "00000000-0000-4000-d000-000000000010", code: "B-31" },
  mobile: { id: "00000000-0000-4000-d000-000000000011", code: "B-32" },
};

const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    text,
  );

/** Someone no other test (or worker) records: their own name and phone. */
function caller() {
  const id = randomUUID().slice(0, 6);
  const digits = String(parseInt(id, 16) % 100000000).padStart(8, "0");
  return { name: `E2E Asker ${id}`, phone: `09${digits}` };
}

async function pick(page: Page, picker: Locator, name: string) {
  await picker.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type(name);
  await expect(page.getByRole("option", { name, exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(picker).toHaveText(name);
  await expect(picker).toBeFocused();
}

/** Records an adult's request for a seat on the route, from a phone call. */
async function requestSeat(page: Page, code: string) {
  const who = caller();
  await page.goto("/route-requests");
  await page.getByRole("button", { name: tr.add }).first().click();
  const dialog = page.getByRole("dialog", { name: tr.addTitle });
  await dialog.getByLabel(tr.kindRouteOption).check();
  await pick(page, dialog.getByRole("combobox", { name: tr.routeLabel }), code);
  await dialog.getByLabel(tr.riderNameLabel).fill(who.name);
  await dialog.getByLabel(tr.contactNameLabel).fill(who.name);
  await dialog.getByLabel(tr.contactPhoneLabel).fill(who.phone);
  await dialog.getByRole("button", { name: tr.record }).click();
  await expect(page.getByText(tr.recordedToast)).toBeVisible();
  return who;
}

test("staff offer free seats: ahead of the queue with a reason, then the next in line; withdraw and accept", async ({
  page,
}, testInfo) => {
  const route =
    testInfo.project.name === "mobile" ? ROUTES.mobile : ROUTES.desktop;
  await signIn(page, "staff", "/sign-in?next=%2Froute-requests");
  const first = await requestSeat(page, route.code);
  const second = await requestSeat(page, route.code);

  await page.goto(`/routes/${route.id}`);
  const offersList = page.getByRole("list", { name: t.listLabel });

  // The later request, ahead of the older one: a reason first.
  await page.getByRole("button", { name: t.offer }).click();
  let dialog = page.getByRole("dialog", {
    name: fill(t.offerTitle, { code: route.code }),
  });
  await dialog.getByRole("radio", { name: second.name }).check();
  await dialog.getByRole("button", { name: t.offerSave }).click();
  const reason = dialog.getByLabel(t.reasonLabel);
  await expect(reason).toBeFocused();
  await reason.fill("Their workplace moved next to the stop");
  await dialog.getByRole("button", { name: t.offerSave }).click();
  await expect(page.getByText(t.offeredToast)).toBeVisible();
  const secondOffer = offersList
    .getByRole("listitem")
    .filter({ hasText: second.name });
  await expect(secondOffer).toContainText(
    fill(t.skipped, { reason: "Their workplace moved next to the stop" }),
  );

  // Next in line: the older request.
  await page.getByRole("button", { name: t.offer }).click();
  dialog = page.getByRole("dialog", {
    name: fill(t.offerTitle, { code: route.code }),
  });
  await dialog.getByRole("button", { name: t.offerSave }).click();
  await expect(page.getByText(t.offeredToast).first()).toBeVisible();
  const firstOffer = offersList
    .getByRole("listitem")
    .filter({ hasText: first.name });
  await expect(firstOffer).toContainText(t.sms.sent);

  // The second person said no.
  await secondOffer.getByRole("button", { name: t.withdraw }).click();
  await page
    .getByRole("alertdialog", {
      name: fill(t.withdrawTitle, { name: second.name }),
    })
    .getByRole("button", { name: t.withdraw })
    .click();
  await expect(secondOffer).toContainText(t.status.withdrawn);

  // The first said yes on the phone: they get the seat and a rider record.
  await firstOffer.getByRole("button", { name: t.accept }).click();
  await page
    .getByRole("alertdialog", {
      name: fill(t.acceptTitle, { name: first.name }),
    })
    .getByRole("button", { name: t.accept })
    .click();
  await expect(firstOffer).toContainText(t.status.accepted);
  await firstOffer
    .getByRole("link", { name: fill(t.openRider, { name: first.name }) })
    .click();
  const rider = page.getByRole("article", { name: first.name });
  await expect(rider.getByText(messages.Riders.seatRiding)).toBeVisible();
  await expect(
    rider.getByRole("link", {
      name: fill(messages.Riders.seatRouteLink, { code: route.code }),
    }),
  ).toBeVisible();
});

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import type { Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import {
  actionItems,
  actionsButton,
  chooseAction,
} from "../../../tests/utils/actions";
import { renderWithProviders } from "../../../tests/utils/render";
import {
  fill,
  problemResponse,
  validationResponse,
} from "../routes/test-support";
import { StaffDetail } from "./staff-detail";
import {
  former,
  me,
  otherAdmin,
  pending,
  serveMe,
  serveMember,
  servePatch,
} from "./test-support";

const nav = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/staff";
  nav.state = state;
  return mockNavigation(state);
});
type Nav = ReturnType<
  typeof import("../../../tests/utils/navigation").createNavigationState
>;
const navigation = () => nav.state as Nav;
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.Staff;

startMswServer();

beforeEach(() => {
  toast.mockClear();
  serveMe();
});

function fact(label: string) {
  const facts = screen.getByRole("group", { name: t.detailLabel });
  return within(facts).getByText(label, { selector: "dt" }).nextElementSibling;
}

async function renderPage(person: Schemas["StaffRead"]) {
  serveMember(person);
  const view = renderWithProviders(
    <StaffDetail staffId={person.id} variant="page" />,
  );
  await screen.findByRole("heading", { level: 1, name: person.full_name });
  return view;
}

describe("StaffDetail", () => {
  it("shows a pending member's email, role, status and first sign-in", async () => {
    await renderPage(pending);

    expect(fact(t.email)).toHaveTextContent("hana@gize.test");
    expect(fact(t.role)).toHaveTextContent(t.roleStaff);
    expect(fact(t.status)).toHaveTextContent(t.statusPendingNote);
    expect(fact(t.firstSignedIn)).toHaveTextContent(t.notYet);
    // No personal data in toasts later, and no "This is you" for someone else.
    expect(screen.queryByText(t.you)).toBeNull();
  });

  it("makes someone an admin, confirmed", async () => {
    const seen: Schemas["StaffUpdate"][] = [];
    servePatch(
      () => HttpResponse.json({ ...pending, role: "admin" as const }),
      seen,
    );
    const user = userEvent.setup();
    await renderPage(pending);

    await chooseAction(user, t.makeAdmin);
    const confirm = await screen.findByRole("alertdialog", {
      name: fill(t.makeAdminTitle, { name: "Hana Tesfaye" }),
    });
    await user.click(
      within(confirm).getByRole("button", { name: t.makeAdmin }),
    );

    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.roleChanged));
    expect(seen).toEqual([{ role: "admin" }]);
    expect(fact(t.role)).toHaveTextContent(t.roleAdmin);
    // Focus came back to the menu, which now offers the other way.
    await waitFor(() => expect(actionsButton()).toHaveFocus());
    expect(await actionItems(user)).toContain(t.makeStaff);
  });

  it("warns an admin demoting themselves, and explains the last active admin", async () => {
    servePatch(() => problemResponse(409, "LAST_ACTIVE_ADMIN", "req-409"));
    const user = userEvent.setup();
    await renderPage(me);

    expect(await screen.findByText(t.you)).toBeVisible();
    await chooseAction(user, t.makeStaff);
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent(t.makeStaffSelf);
    await user.click(
      within(confirm).getByRole("button", { name: t.makeStaff }),
    );

    expect(await within(confirm).findByText(t.lastAdmin)).toBeVisible();
    expect(within(confirm).getByText("req-409")).toBeVisible();
  });

  it("sends an admin who made themselves staff back to the overview", async () => {
    servePatch(() => HttpResponse.json({ ...me, role: "staff" as const }));
    const user = userEvent.setup();
    await renderPage(me);

    await screen.findByText(t.you);
    await chooseAction(user, t.makeStaff);
    const confirm = await screen.findByRole("alertdialog");
    await user.click(
      within(confirm).getByRole("button", { name: t.makeStaff }),
    );

    await waitFor(() => expect(navigation().replace).toHaveBeenCalledWith("/"));
  });

  it("deactivates, confirmed, then reactivates", async () => {
    const seen: Schemas["StaffUpdate"][] = [];
    servePatch(
      (change) =>
        HttpResponse.json({ ...otherAdmin, is_active: change.is_active }),
      seen,
    );
    const user = userEvent.setup();
    await renderPage(otherAdmin);

    await chooseAction(user, t.deactivate);
    const confirm = await screen.findByRole("alertdialog", {
      name: fill(t.deactivateTitle, { name: "Meron Admin" }),
    });
    expect(confirm).not.toHaveTextContent(t.deactivateSelf);
    await user.click(
      within(confirm).getByRole("button", { name: t.deactivate }),
    );
    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.deactivated));
    // Focus is back on the menu (not on Reactivate, which a repeated key press could undo it
    // with); Reactivate shows beside Edit name, and Deactivate is gone from the menu.
    await waitFor(() => expect(actionsButton()).toHaveFocus());
    const reactivate = screen.getByRole("button", { name: t.reactivate });
    expect(await actionItems(user)).not.toContain(t.deactivate);

    await user.click(reactivate);
    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.reactivated));
    expect(seen).toEqual([{ is_active: false }, { is_active: true }]);
    // Its button goes away: focus moves to the menu beside it.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: t.reactivate })).toBeNull(),
    );
    expect(actionsButton()).toHaveFocus();
  });

  it("explains a failed reactivation with its reference", async () => {
    servePatch(() => problemResponse(503, "SERVICE_UNAVAILABLE", "req-503"));
    const user = userEvent.setup();
    await renderPage(former);

    await user.click(screen.getByRole("button", { name: t.reactivate }));
    expect(await screen.findByText("req-503")).toBeVisible();
  });

  it("corrects the name, checked first, sending only a change", async () => {
    const seen: Schemas["StaffUpdate"][] = [];
    servePatch((change) => HttpResponse.json({ ...pending, ...change }), seen);
    const user = userEvent.setup();
    await renderPage(pending);

    await user.click(screen.getByRole("button", { name: t.editName }));
    const dialog = await screen.findByRole("dialog", { name: t.nameTitle });
    const name = within(dialog).getByLabelText(t.nameLabel);
    await user.clear(name);
    await user.click(within(dialog).getByRole("button", { name: t.save }));
    expect(await within(dialog).findByText(t.nameRequired)).toBeVisible();
    expect(seen).toHaveLength(0);

    await user.type(name, "  Hana T. Bekele ");
    await user.click(within(dialog).getByRole("button", { name: t.save }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(t.nameSaved));
    expect(seen).toEqual([{ full_name: "Hana T. Bekele" }]);
  });

  it("puts a refused name on the field", async () => {
    servePatch(() => validationResponse("/full_name", "too_long"));
    const user = userEvent.setup();
    await renderPage(pending);

    await user.click(screen.getByRole("button", { name: t.editName }));
    const dialog = await screen.findByRole("dialog", { name: t.nameTitle });
    await user.type(within(dialog).getByLabelText(t.nameLabel), "x");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    expect(
      await within(dialog).findByText(messages.ValidationReasons.too_long),
    ).toBeVisible();
  });

  it("says when the member is gone", async () => {
    serveMember();
    renderWithProviders(<StaffDetail staffId={pending.id} variant="page" />);

    expect(
      await screen.findByRole("heading", { level: 1, name: t.notFoundTitle }),
    ).toBeVisible();
  });
});

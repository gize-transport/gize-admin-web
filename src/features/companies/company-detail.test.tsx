import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { currentStaffQueryKey } from "@/lib/auth/use-current-staff";
import { CompanyDetail } from "./company-detail";
import {
  brewery,
  ceramics,
  fill,
  problemResponse,
  route,
  serveCompany,
  serveRole,
} from "./test-support";

vi.mock("next/navigation", async () => {
  const { createNavigationState, mockNavigation } =
    await import("../../../tests/utils/navigation");
  const state = createNavigationState();
  state.pathname = "/companies";
  return mockNavigation(state);
});
vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.Companies;

startMswServer();

beforeEach(() => {
  toast.mockClear();
  serveRole("staff");
});

function renderDetail(
  found: Schemas["CompanyRead"],
  props: Partial<Parameters<typeof CompanyDetail>[0]> = {},
) {
  return renderWithProviders(
    <CompanyDetail companyId={found.id} variant="page" {...props} />,
  );
}

describe("CompanyDetail", () => {
  it("shows the company's facts, billing and notes", async () => {
    serveCompany(brewery);
    renderDetail(brewery);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Addis Brewery" }),
    ).toBeVisible();
    const facts = screen.getByRole("group", { name: t.detailLabel });
    const fact = (label: string) =>
      within(facts).getByText(label).nextElementSibling;
    expect(fact(t.contactName)).toHaveTextContent("Hana Bekele");
    expect(fact(t.contactPhone)).toHaveTextContent("+251911234567");
    expect(fact(t.contactEmail)).toHaveTextContent("hana@example.test");
    expect(fact(t.billing)).toHaveTextContent(t.billingPostpaid);
    expect(fact(t.notes)).toHaveTextContent("Invoices to the finance office.");
    expect(fact(t.status)).toHaveTextContent(t.active);
  });

  it("lists the company's routes with their corridor and status", async () => {
    serveCompany(brewery, [
      route("R-21", brewery, "active", 1),
      route("R-24", brewery, "draft", 2),
    ]);
    renderDetail(brewery);

    const table = await screen.findByRole("table", {
      name: fill(t.routesLabel, { name: "Addis Brewery" }),
    });
    const rows = await within(table).findAllByRole("row");
    expect(rows).toHaveLength(3); // header + 2
    const first = rows[1];
    if (!first) throw new Error("no first route row");
    expect(within(first).getByRole("link", { name: "R-21" })).toHaveAttribute(
      "href",
      "/routes/00000000-0000-4000-d000-000000000001",
    );
    // Heard as "from Bole to Piassa"; seen as "Bole → Piassa".
    expect(within(first).getByText("→")).toHaveAttribute("aria-hidden", "true");
    expect(first).toHaveTextContent(/Bole.*Piassa/);
    expect(within(first).getByText(messages.RouteStatus.active)).toBeVisible();
  });

  it("says when the company has no routes, and when it has no notes", async () => {
    const plain = { ...brewery, notes: null };
    serveCompany(plain);
    renderDetail(plain);

    expect(await screen.findByText(t.noRoutes)).toBeVisible();
    expect(screen.getByText(t.noNotes)).toBeVisible();
  });

  it("explains a company that no longer exists", async () => {
    serveCompany(ceramics);
    renderDetail(brewery);

    expect(await screen.findByText(t.notFoundTitle)).toBeVisible();
    expect(screen.getByRole("link", { name: t.backToList })).toHaveAttribute(
      "href",
      "/companies",
    );
  });

  it("deactivates the company after confirming", async () => {
    serveCompany(brewery);
    let sent: Schemas["CompanyUpdate"] | undefined;
    server.use(
      http.patch(apiUrl("/v1/companies/{company_id}"), async ({ request }) => {
        sent = (await request.json()) as Schemas["CompanyUpdate"];
        return HttpResponse.json<Schemas["CompanyRead"]>({
          ...brewery,
          is_active: false,
        });
      }),
    );
    const user = userEvent.setup();
    renderDetail(brewery);

    await user.click(await screen.findByRole("button", { name: t.deactivate }));
    const dialog = await screen.findByRole("alertdialog", {
      name: fill(t.deactivateTitle, { name: "Addis Brewery" }),
    });
    await user.click(
      within(dialog).getByRole("button", { name: t.deactivate }),
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        fill(t.deactivated, { name: "Addis Brewery" }),
      ),
    );
    expect(sent).toEqual({ is_active: false });
  });

  it("explains why a company running a route can't be deactivated", async () => {
    serveCompany(brewery);
    server.use(
      http.patch(apiUrl("/v1/companies/{company_id}"), () =>
        problemResponse(409, "COMPANY_IN_USE", "req-in-use"),
      ),
    );
    const user = userEvent.setup();
    renderDetail(brewery);

    await user.click(await screen.findByRole("button", { name: t.deactivate }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: t.deactivate }),
    );

    expect(await within(dialog).findByText(t.inUseDeactivate)).toBeVisible();
    expect(within(dialog).getByText("req-in-use")).toBeVisible();
    expect(toast).not.toHaveBeenCalled();
  });

  it("reactivates an inactive company", async () => {
    serveCompany(ceramics);
    let sent: Schemas["CompanyUpdate"] | undefined;
    server.use(
      http.patch(apiUrl("/v1/companies/{company_id}"), async ({ request }) => {
        sent = (await request.json()) as Schemas["CompanyUpdate"];
        return HttpResponse.json<Schemas["CompanyRead"]>({
          ...ceramics,
          is_active: true,
        });
      }),
    );
    const user = userEvent.setup();
    renderDetail(ceramics);

    expect(await screen.findByText(t.inactive)).toBeVisible();
    await user.click(screen.getByRole("button", { name: t.reactivate }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        fill(t.reactivated, { name: "Ethio Ceramics" }),
      ),
    );
    expect(sent).toEqual({ is_active: true });
  });

  it("shows a failed reactivation with its reference", async () => {
    serveCompany(ceramics);
    server.use(
      http.patch(apiUrl("/v1/companies/{company_id}"), () =>
        problemResponse(503, "SERVICE_UNAVAILABLE", "req-503"),
      ),
    );
    const user = userEvent.setup();
    renderDetail(ceramics);

    await user.click(await screen.findByRole("button", { name: t.reactivate }));

    expect(
      await screen.findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeVisible();
    expect(screen.getByText("req-503")).toBeVisible();
  });

  it("offers Delete to admins only", async () => {
    serveCompany(brewery);
    const { queryClient } = renderDetail(brewery);
    await screen.findByRole("heading", { name: "Addis Brewery" });
    await waitFor(() =>
      expect(queryClient.getQueryState(currentStaffQueryKey)?.status).toBe(
        "success",
      ),
    );

    expect(screen.queryByRole("button", { name: t.delete })).toBeNull();
  });

  it("lets an admin delete the company, then hands back to the list", async () => {
    serveRole("admin");
    serveCompany(brewery);
    let deleted: string | undefined;
    server.use(
      http.delete(apiUrl("/v1/companies/{company_id}"), ({ params }) => {
        deleted = String(params.company_id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    renderDetail(brewery, { onDeleted });

    await user.click(await screen.findByRole("button", { name: t.delete }));
    const dialog = await screen.findByRole("alertdialog", {
      name: fill(t.deleteTitle, { name: "Addis Brewery" }),
    });
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleted).toBe(brewery.id);
    expect(toast).toHaveBeenCalledWith(
      fill(t.deleted, { name: "Addis Brewery" }),
    );
  });

  it("explains why a company with routes can't be deleted", async () => {
    serveRole("admin");
    serveCompany(brewery);
    server.use(
      http.delete(apiUrl("/v1/companies/{company_id}"), () =>
        problemResponse(409, "COMPANY_IN_USE", "req-in-use"),
      ),
    );
    const user = userEvent.setup();
    renderDetail(brewery);

    await user.click(await screen.findByRole("button", { name: t.delete }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    expect(await within(dialog).findByText(t.inUseDelete)).toBeVisible();
    expect(within(dialog).getByText("req-in-use")).toBeVisible();
  });

  it("opens the edit form filled in", async () => {
    serveCompany(brewery);
    const user = userEvent.setup();
    renderDetail(brewery);

    await user.click(await screen.findByRole("button", { name: t.edit }));

    const dialog = await screen.findByRole("dialog", {
      name: fill(t.editTitle, { name: "Addis Brewery" }),
    });
    expect(within(dialog).getByLabelText(t.nameLabel)).toHaveValue(
      "Addis Brewery",
    );
    expect(within(dialog).getByLabelText(t.contactPhoneLabel)).toHaveValue(
      "+251911234567",
    );
  });

  it("in a panel, has a close button and a level-2 heading", async () => {
    serveCompany(brewery);
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CompanyDetail
        companyId={brewery.id}
        variant="panel"
        onClose={onClose}
      />,
    );

    expect(
      await screen.findByRole("heading", { level: 2, name: "Addis Brewery" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: t.closeDetail }));
    expect(onClose).toHaveBeenCalled();
  });
  it("shows NoPermission when the API refuses this role", async () => {
    server.use(
      http.get(apiUrl("/v1/companies/{company_id}"), () =>
        problemResponse(403, "FORBIDDEN"),
      ),
    );
    renderDetail(brewery);

    expect(await screen.findByText(messages.NoPermission.title)).toBeVisible();
  });

  it("shows a failed load with its reference and a retry", async () => {
    server.use(
      http.get(apiUrl("/v1/companies/{company_id}"), () =>
        problemResponse(500, "INTERNAL_ERROR", "req-500"),
      ),
    );
    renderDetail(brewery);

    expect(
      await screen.findByText(messages.Errors.INTERNAL_ERROR),
    ).toBeVisible();
    expect(screen.getByText("req-500")).toBeVisible();
    expect(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    ).toBeVisible();
  });

  it("treats an id the API can't read as not found", async () => {
    server.use(
      http.get(apiUrl("/v1/companies/{company_id}"), () =>
        HttpResponse.json<Schemas["ValidationProblem"]>(
          {
            type: "about:blank",
            title: "VALIDATION_FAILED",
            status: 422,
            code: "VALIDATION_FAILED",
            request_id: "req-422",
            errors: [
              {
                location: "path",
                field: "/company_id",
                reason: "invalid_format",
              },
            ],
            errors_truncated: false,
          },
          {
            status: 422,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      ),
    );
    renderDetail(brewery);

    expect(await screen.findByText(t.notFoundTitle)).toBeVisible();
  });

  it("in a panel, a company not found offers to close the panel", async () => {
    serveCompany(ceramics);
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CompanyDetail
        companyId={brewery.id}
        variant="panel"
        onClose={onClose}
      />,
    );

    expect(await screen.findByText(t.notFoundTitle)).toBeVisible();
    expect(screen.queryByRole("link", { name: t.backToList })).toBeNull();
    const closes = screen.getAllByRole("button", { name: t.closeDetail });
    const last = closes.at(-1);
    if (!last) throw new Error("no close button");
    await user.click(last);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a failed routes load with its reference", async () => {
    serveCompany(brewery);
    server.use(
      http.get(apiUrl("/v1/routes"), () =>
        problemResponse(503, "SERVICE_UNAVAILABLE", "req-routes"),
      ),
    );
    renderDetail(brewery);

    expect(await screen.findByText("req-routes")).toBeVisible();
  });

  it("says when the company has more routes than it shows", async () => {
    serveCompany(brewery);
    server.use(
      http.get(apiUrl("/v1/routes"), () =>
        HttpResponse.json<Schemas["RoutePage"]>({
          items: [route("R-21", brewery, "active", 1)],
          next_cursor: "more",
        }),
      ),
    );
    renderDetail(brewery);

    expect(
      await screen.findByText(fill(t.moreRoutes, { count: "1" })),
    ).toBeVisible();
  });

  it("keeps Deactivate disabled until Retry-After has passed", async () => {
    serveCompany(brewery);
    server.use(
      http.patch(apiUrl("/v1/companies/{company_id}"), () =>
        problemResponse(429, "RATE_LIMITED", "req-429", { "Retry-After": "1" }),
      ),
    );
    const user = userEvent.setup();
    renderDetail(brewery);

    await user.click(await screen.findByRole("button", { name: t.deactivate }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: t.deactivate });
    await user.click(confirm);

    expect(
      await within(dialog).findByText(messages.Errors.RATE_LIMITED),
    ).toBeVisible();
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    await waitFor(() => expect(confirm).not.toHaveAttribute("aria-disabled"), {
      timeout: 2500,
    });
  });

  it("keeps Reactivate disabled until Retry-After has passed", async () => {
    serveCompany(ceramics);
    server.use(
      http.patch(apiUrl("/v1/companies/{company_id}"), () =>
        problemResponse(429, "RATE_LIMITED", "req-429", { "Retry-After": "1" }),
      ),
    );
    const user = userEvent.setup();
    renderDetail(ceramics);

    const reactivate = await screen.findByRole("button", {
      name: t.reactivate,
    });
    await user.click(reactivate);

    expect(await screen.findByText(messages.Errors.RATE_LIMITED)).toBeVisible();
    expect(reactivate).toHaveAttribute("aria-disabled", "true");
    await waitFor(
      () => expect(reactivate).not.toHaveAttribute("aria-disabled"),
      { timeout: 2500 },
    );
  });

  it("explains a delete the API refuses for this role", async () => {
    serveRole("admin");
    serveCompany(brewery);
    server.use(
      http.delete(apiUrl("/v1/companies/{company_id}"), () =>
        problemResponse(403, "FORBIDDEN", "req-403"),
      ),
    );
    const user = userEvent.setup();
    renderDetail(brewery);

    await user.click(await screen.findByRole("button", { name: t.delete }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: t.delete }));

    expect(
      await within(dialog).findByText(messages.Errors.FORBIDDEN),
    ).toBeVisible();
    expect(within(dialog).getByText("req-403")).toBeVisible();
  });

  it("refetches the routes when deactivating is refused for a running route", async () => {
    let routeCalls = 0;
    serveCompany(brewery);
    server.use(
      http.get(apiUrl("/v1/routes"), () => {
        routeCalls += 1;
        return HttpResponse.json<Schemas["RoutePage"]>({
          items: [],
          next_cursor: null,
        });
      }),
      http.patch(apiUrl("/v1/companies/{company_id}"), () =>
        problemResponse(409, "COMPANY_IN_USE"),
      ),
    );
    const user = userEvent.setup();
    renderDetail(brewery);
    await screen.findByText(t.noRoutes);

    await user.click(screen.getByRole("button", { name: t.deactivate }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: t.deactivate }),
    );

    await within(dialog).findByText(t.inUseDeactivate);
    await waitFor(() => expect(routeCalls).toBe(2));
  });
});

import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { RouteVanDialog } from "./route-van-dialog";
import {
  corporate,
  fill,
  forming,
  problemResponse,
  route,
  student,
  validationResponse,
} from "./test-support";

vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.Routes;

startMswServer();

beforeEach(() => toast.mockClear());

function renderDialog(original: Schemas["RouteRead"]) {
  const onOpenChange = vi.fn();
  const onAdded = vi.fn();
  const view = renderWithProviders(
    <RouteVanDialog
      open
      onOpenChange={onOpenChange}
      route={original}
      onAdded={onAdded}
    />,
  );
  return { ...view, onOpenChange, onAdded, dialog: screen.getByRole("dialog") };
}

const field = (dialog: HTMLElement, label: string) =>
  within(dialog).getByLabelText(label);
const save = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: t.addVan });

function serveCopy(
  answer: (body: Schemas["RouteCopy"]) => Response,
  seen?: { body: Schemas["RouteCopy"]; key: string | null }[],
) {
  server.use(
    http.post(apiUrl("/v1/routes/{route_id}/copies"), async ({ request }) => {
      const body = (await request.json()) as Schemas["RouteCopy"];
      seen?.push({ body, key: request.headers.get("Idempotency-Key") });
      return answer(body);
    }),
  );
}

async function setCode(user: UserEvent, dialog: HTMLElement, code: string) {
  await user.type(field(dialog, t.codeLabel), code);
}

describe("RouteVanDialog", () => {
  it("says what the van copies, and starts from the route's seats and launch minimum", () => {
    const { dialog } = renderDialog(forming);

    expect(dialog).toHaveAccessibleName(fill(t.vanTitle, { code: "B-01" }));
    expect(dialog).toHaveTextContent(
      fill(t.vanCopiesCorridor, { origin: "Bole", destination: "Piassa" }),
    );
    expect(dialog).toHaveTextContent(t.vanCopiesAreas);
    expect(dialog).toHaveTextContent(t.vanCopiesPrices);
    // The list is announced with the dialog.
    expect(dialog).toHaveAccessibleDescription(
      expect.stringContaining(t.vanCopiesPrices),
    );
    expect(field(dialog, t.seatsLabel)).toHaveValue(14);
    expect(field(dialog, t.launchMinimumLabel)).toHaveValue(10);
  });

  it("adds a van with one Idempotency-Key, reused on retry, and opens it", async () => {
    const seen: { body: Schemas["RouteCopy"]; key: string | null }[] = [];
    let fail = true;
    const van = route("B-01A", 9, {
      status: "forming",
      copied_from_route_id: forming.id,
    });
    serveCopy(() => {
      if (fail) {
        fail = false;
        return problemResponse(503, "SERVICE_UNAVAILABLE");
      }
      return HttpResponse.json<Schemas["RouteRead"]>(van, { status: 201 });
    }, seen);
    const user = userEvent.setup();
    const { dialog, onAdded, onOpenChange } = renderDialog(forming);

    await setCode(user, dialog, " b-01a ");
    await user.click(save(dialog));
    expect(
      await within(dialog).findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeVisible();
    await user.click(save(dialog));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        fill(t.vanAdded, { code: "B-01A", start: t.vanStartsForming }),
      ),
    );
    expect(seen[0]?.body).toEqual({
      code: "B-01A",
      seats: 14,
      launch_minimum: 10,
    });
    expect(seen[0]?.key).toBeTruthy();
    expect(seen[1]?.key).toBe(seen[0]?.key);
    expect(onAdded).toHaveBeenCalledWith(van);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("copies a corporate route without a launch minimum; it starts as a draft", async () => {
    const seen: { body: Schemas["RouteCopy"]; key: string | null }[] = [];
    serveCopy(
      () =>
        HttpResponse.json<Schemas["RouteRead"]>(
          {
            ...corporate,
            id: "00000000-0000-4000-d000-000000000010",
            code: "R-21B",
            status: "draft",
          },
          { status: 201 },
        ),
      seen,
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog(corporate);

    expect(dialog).toHaveTextContent(
      fill(t.vanCopiesCompany, { company: "Addis Brewery" }),
    );
    expect(within(dialog).queryByLabelText(t.launchMinimumLabel)).toBeNull();
    await setCode(user, dialog, "R-21B");
    await user.click(save(dialog));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        fill(t.vanAdded, { code: "R-21B", start: t.vanStartsDraft }),
      ),
    );
    expect(seen[0]?.body).toEqual({ code: "R-21B", seats: 14 });
  });

  it("doesn't promise areas served when the route has none", () => {
    const { dialog } = renderDialog(route("B-09", 9));

    expect(dialog).not.toHaveTextContent(t.vanCopiesAreas);
  });

  it("names a student route's school among what's copied", () => {
    const { dialog } = renderDialog(student);

    expect(dialog).toHaveTextContent(
      fill(t.vanCopiesSchool, { school: "Lycée Guebre-Mariam" }),
    );
  });

  it("checks the fields before sending and focuses the first problem", async () => {
    const seen: { body: Schemas["RouteCopy"]; key: string | null }[] = [];
    serveCopy(() => problemResponse(500, "INTERNAL_ERROR"), seen);
    const user = userEvent.setup();
    const { dialog } = renderDialog(forming);

    await setCode(user, dialog, "-x");
    await user.clear(field(dialog, t.seatsLabel));
    await user.type(field(dialog, t.seatsLabel), "8");
    await user.click(save(dialog));

    const code = field(dialog, t.codeLabel);
    await waitFor(() => expect(code).toHaveFocus());
    expect(code).toHaveAccessibleDescription(`${t.codeHint} ${t.codeInvalid}`);
    expect(field(dialog, t.launchMinimumLabel)).toHaveAccessibleDescription(
      `${t.launchMinimumHint} ${t.launchMinimumAboveSeats}`,
    );
    expect(seen).toHaveLength(0);
  });

  it("explains a taken code on the code field", async () => {
    serveCopy(() => problemResponse(409, "ROUTE_CODE_TAKEN"));
    const user = userEvent.setup();
    const { dialog } = renderDialog(forming);

    await setCode(user, dialog, "B-02");
    await user.click(save(dialog));

    const code = field(dialog, t.codeLabel);
    await waitFor(() => expect(code).toHaveAttribute("aria-invalid", "true"));
    expect(code).toHaveAccessibleDescription(`${t.codeHint} ${t.codeTaken}`);
    expect(code).toHaveFocus();
  });

  it("explains a corporate route whose company isn't active, and field refusals", async () => {
    serveCopy(() => problemResponse(409, "ROUTE_NOT_READY", "req-ready"));
    const user = userEvent.setup();
    const { dialog, unmount, queryClient } = renderDialog(corporate);
    queryClient.setQueryData(["routes", "detail", corporate.id], corporate);
    await setCode(user, dialog, "R-21B");
    await user.click(save(dialog));
    expect(await within(dialog).findByText(t.vanCompanyInactive)).toBeVisible();
    expect(within(dialog).getByText("req-ready")).toBeVisible();
    // Closing reloads the route, so its company shows as it is now.
    await user.click(
      within(dialog).getByRole("button", { name: messages.Common.cancel }),
    );
    await waitFor(() =>
      expect(
        queryClient.getQueryState(["routes", "detail", corporate.id])
          ?.isInvalidated,
      ).toBe(true),
    );
    unmount();

    serveCopy(() => validationResponse("/seats", "out_of_range"));
    const again = renderDialog(forming);
    await setCode(user, again.dialog, "B-01B");
    await user.click(save(again.dialog));
    const seats = field(again.dialog, t.seatsLabel);
    await waitFor(() =>
      expect(seats).toHaveAccessibleDescription(
        `${t.seatsHint} ${messages.ValidationReasons.out_of_range}`,
      ),
    );
    expect(seats).toHaveFocus();
  });

  it("shows a refusal on a field the dialog doesn't have as an alert", async () => {
    serveCopy(() => validationResponse("/launch_minimum", "not_allowed"));
    const user = userEvent.setup();
    const { dialog } = renderDialog(corporate);

    await setCode(user, dialog, "R-21B");
    await user.click(save(dialog));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      messages.Errors.VALIDATION_FAILED,
    );
  });

  it("keeps the button disabled until Retry-After has passed after a 429", async () => {
    serveCopy(() =>
      problemResponse(429, "RATE_LIMITED", "req-429", { "Retry-After": "1" }),
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog(forming);

    await setCode(user, dialog, "B-01B");
    await user.click(save(dialog));

    expect(
      await within(dialog).findByText(messages.Errors.RATE_LIMITED),
    ).toBeVisible();
    expect(save(dialog)).toHaveAttribute("aria-disabled", "true");
    await waitFor(
      () => expect(save(dialog)).not.toHaveAttribute("aria-disabled"),
      { timeout: 2500 },
    );
  });

  it("reloads a route deleted meanwhile once the dialog closes", async () => {
    serveCopy(() => problemResponse(404, "NOT_FOUND"));
    const user = userEvent.setup();
    const { dialog, queryClient } = renderDialog(forming);
    queryClient.setQueryData(["routes", "detail", forming.id], forming);

    await setCode(user, dialog, "B-01B");
    await user.click(save(dialog));
    await within(dialog).findByText(messages.Errors.NOT_FOUND);
    await user.click(
      within(dialog).getByRole("button", { name: messages.Common.cancel }),
    );

    await waitFor(() =>
      expect(
        queryClient.getQueryState(["routes", "detail", forming.id])
          ?.isInvalidated,
      ).toBe(true),
    );
  });
});

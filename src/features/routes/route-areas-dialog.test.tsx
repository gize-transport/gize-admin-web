import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { RouteAreasDialog } from "./route-areas-dialog";
import {
  areas,
  fill,
  forming,
  problemResponse,
  servePlaces,
  validationResponse,
} from "./test-support";

vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ showSuccessToast: toast }));

const t = messages.Routes;
const ends = { origin: "Bole", destination: "Piassa" };

startMswServer();

beforeEach(() => {
  toast.mockClear();
  servePlaces();
});

/** B-01: Bole → CMC → Mexico → Piassa. */
function renderDialog(existing: Schemas["RouteRead"] = forming) {
  const onOpenChange = vi.fn();
  const view = renderWithProviders(
    <RouteAreasDialog open onOpenChange={onOpenChange} route={existing} />,
  );
  return { ...view, onOpenChange, dialog: screen.getByRole("dialog") };
}

const list = (dialog: HTMLElement) =>
  within(dialog).getByRole("list", { name: fill(t.areasListLabel, ends) });
const names = (dialog: HTMLElement) =>
  within(list(dialog))
    .queryAllByRole("listitem")
    .map((item) => item.getAttribute("data-area-name"));
const save = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: t.save });

async function add(user: UserEvent, dialog: HTMLElement, name: string) {
  await user.click(
    within(dialog).getByRole("combobox", { name: t.addAreaLabel }),
  );
  await user.type(
    await screen.findByRole("combobox", {
      name: messages.AreaPicker.searchLabel,
    }),
    name.slice(0, 3),
  );
  await user.click(await screen.findByRole("option", { name }));
}

function servePut(answer: (ids: string[]) => Response, sent?: string[][]) {
  server.use(
    http.put(apiUrl("/v1/routes/{route_id}/areas"), async ({ request }) => {
      const body = (await request.json()) as Schemas["RouteAreasSet"];
      sent?.push(body.area_ids);
      return answer(body.area_ids);
    }),
  );
}

describe("RouteAreasDialog", () => {
  it("shows the areas between the route's ends, in order", () => {
    const { dialog } = renderDialog();

    expect(dialog).toHaveAccessibleName(fill(t.areasTitle, { code: "B-01" }));
    expect(names(dialog)).toEqual(["CMC", "Mexico"]);
    expect(
      within(dialog).getByText(t.areasPreview).nextElementSibling,
    ).toHaveTextContent(/Bole.*CMC.*Mexico.*Piassa/);
  });

  it("adds, moves and removes areas with the keyboard, and saves the whole list", async () => {
    const sent: string[][] = [];
    servePut(() => HttpResponse.json<Schemas["RouteRead"]>(forming), sent);
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderDialog();

    await add(user, dialog, "Megenagna");
    expect(names(dialog)).toEqual(["CMC", "Mexico", "Megenagna"]);
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      fill(t.areaAdded, { name: "Megenagna", position: 3, count: 3 }),
    );

    const up = within(dialog).getByRole("button", {
      name: fill(t.moveUp, { name: "Megenagna" }),
    });
    await user.click(up);
    expect(names(dialog)).toEqual(["CMC", "Megenagna", "Mexico"]);
    // Focus stays on the area that moved, and the move is announced.
    expect(
      within(dialog).getByRole("button", {
        name: fill(t.moveUp, { name: "Megenagna" }),
      }),
    ).toHaveFocus();
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      fill(t.areaMoved, { name: "Megenagna", position: 2, count: 3 }),
    );
    await user.keyboard("{Enter}");
    expect(names(dialog)).toEqual(["Megenagna", "CMC", "Mexico"]);
    // At the top: Move up can't be used, and still holds focus.
    const top = within(dialog).getByRole("button", {
      name: fill(t.moveUp, { name: "Megenagna" }),
    });
    expect(top).toHaveAttribute("aria-disabled", "true");
    expect(top).toHaveFocus();

    await user.click(
      within(dialog).getByRole("button", {
        name: fill(t.removeArea, { name: "CMC" }),
      }),
    );
    expect(names(dialog)).toEqual(["Megenagna", "Mexico"]);
    // Focus moves to the next area's Remove.
    expect(
      within(dialog).getByRole("button", {
        name: fill(t.removeArea, { name: "Mexico" }),
      }),
    ).toHaveFocus();

    await user.click(save(dialog));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(fill(t.areasSaved, { code: "B-01" })),
    );
    expect(sent).toEqual([[areas.megenagna.id, areas.mexico.id]]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("won't add the route's ends or an area twice, and says why", async () => {
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    const picker = () =>
      within(dialog).getByRole("combobox", { name: t.addAreaLabel });
    await add(user, dialog, "Bole");
    expect(picker()).toHaveAccessibleDescription(
      fill(t.areaIsOrigin, { name: "Bole" }),
    );
    await add(user, dialog, "Piassa");
    expect(picker()).toHaveAccessibleDescription(
      fill(t.areaIsDestination, { name: "Piassa" }),
    );
    await add(user, dialog, "Mexico");
    expect(picker()).toHaveAccessibleDescription(
      fill(t.areaAlreadyListed, { name: "Mexico" }),
    );
    // Announced too, not only shown.
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      fill(t.areaAlreadyListed, { name: "Mexico" }),
    );

    expect(names(dialog)).toEqual(["CMC", "Mexico"]);
  });

  it("clears the list", async () => {
    const sent: string[][] = [];
    servePut(() => HttpResponse.json<Schemas["RouteRead"]>(forming), sent);
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    for (const name of ["CMC", "Mexico"]) {
      await user.click(
        within(dialog).getByRole("button", {
          name: fill(t.removeArea, { name }),
        }),
      );
    }
    expect(within(dialog).getByText(t.areasEmpty)).toBeVisible();
    // Nothing left to focus in the list: the picker.
    expect(
      within(dialog).getByRole("combobox", { name: t.addAreaLabel }),
    ).toHaveFocus();
    await user.click(save(dialog));

    await waitFor(() => expect(sent).toEqual([[]]));
  });

  it("closes without a request when the list didn't change", async () => {
    const sent: string[][] = [];
    servePut(() => HttpResponse.json<Schemas["RouteRead"]>(forming), sent);
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderDialog();

    await user.click(save(dialog));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(sent).toHaveLength(0);
  });

  it("stops adding at 20 areas, and says why", () => {
    const full = {
      ...forming,
      served_areas: Array.from({ length: 20 }, (_, index) => ({
        id: `00000000-0000-4000-a100-${String(index).padStart(12, "0")}`,
        name: `Area ${index + 1}`,
      })),
    };
    const { dialog } = renderDialog(full);

    // The picker stays (it may hold focus), can't be used, and says why.
    const picker = within(dialog).getByRole("combobox", {
      name: t.addAreaLabel,
    });
    expect(picker).toHaveAttribute("aria-disabled", "true");
    expect(picker).toHaveAccessibleDescription(t.areasFull);
  });

  it("keeps focus on the picker when the 20th area is added, and says the list is full", async () => {
    const nineteen = {
      ...forming,
      served_areas: Array.from({ length: 19 }, (_, index) => ({
        id: `00000000-0000-4000-a100-${String(index).padStart(12, "0")}`,
        name: `Area ${index + 1}`,
      })),
    };
    const user = userEvent.setup();
    const { dialog } = renderDialog(nineteen);

    await add(user, dialog, "Megenagna");

    const picker = within(dialog).getByRole("combobox", {
      name: t.addAreaLabel,
    });
    await waitFor(() => expect(picker).toHaveFocus());
    expect(picker).toHaveAttribute("aria-disabled", "true");
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      `${fill(t.areaAdded, { name: "Megenagna", position: 20, count: 20 })} ${t.areasFull}`,
    );
  });

  it("moves focus to the area before when the last one is removed, and announces it", async () => {
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await user.click(
      within(dialog).getByRole("button", {
        name: fill(t.removeArea, { name: "Mexico" }),
      }),
    );

    expect(
      within(dialog).getByRole("button", {
        name: fill(t.removeArea, { name: "CMC" }),
      }),
    ).toHaveFocus();
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      fill(t.areaRemoved, { name: "Mexico" }),
    );
  });

  it("puts the API's refusal of an area on the list and focuses it", async () => {
    servePut(() => validationResponse("/area_ids/2", "invalid_format"));
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await add(user, dialog, "Megenagna");
    await user.click(save(dialog));

    const listed = list(dialog);
    await waitFor(() => expect(listed).toHaveFocus());
    expect(listed).toHaveAccessibleDescription(
      `${t.areasRefused} ${fill(t.reference, { id: "req-422" })}`,
    );
  });

  it("reloads the route once the dialog closes after the API refused the list", async () => {
    servePut(() => validationResponse("/area_ids", "invalid"));
    const user = userEvent.setup();
    const { dialog, queryClient } = renderDialog();
    queryClient.setQueryData(["routes", "detail", forming.id], forming);

    await add(user, dialog, "Megenagna");
    await user.click(save(dialog));
    await within(dialog).findByText(t.areasRefused);
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

  it("reloads a route deleted meanwhile even when closing with the list as it was", async () => {
    servePut(() => problemResponse(404, "NOT_FOUND"));
    const user = userEvent.setup();
    const { dialog, queryClient } = renderDialog();
    queryClient.setQueryData(["routes", "detail", forming.id], forming);

    await add(user, dialog, "Megenagna");
    await user.click(save(dialog));
    await within(dialog).findByText(messages.Errors.NOT_FOUND);
    // Put the list back as it was, and save: nothing to send, but the route is gone.
    await user.click(
      within(dialog).getByRole("button", {
        name: fill(t.removeArea, { name: "Megenagna" }),
      }),
    );
    await user.click(save(dialog));

    await waitFor(() =>
      expect(
        queryClient.getQueryState(["routes", "detail", forming.id])
          ?.isInvalidated,
      ).toBe(true),
    );
  });

  it("explains a list the API refuses", async () => {
    const answers: [Response, string][] = [
      [validationResponse("/area_ids", "too_long"), t.areasTooMany],
      [validationResponse("/area_ids", "invalid"), t.areasRefused],
      [problemResponse(403, "FORBIDDEN", "req-403"), messages.Errors.FORBIDDEN],
    ];
    for (const [answer, text] of answers) {
      servePut(() => answer.clone());
      const user = userEvent.setup();
      const { dialog, unmount } = renderDialog();
      await add(user, dialog, "Megenagna");
      await user.click(save(dialog));
      expect(await within(dialog).findByText(text)).toBeVisible();
      unmount();
    }
  });

  it("keeps Save disabled until Retry-After has passed after a 429", async () => {
    servePut(() =>
      problemResponse(429, "RATE_LIMITED", "req-429", { "Retry-After": "1" }),
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await add(user, dialog, "Megenagna");
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

  it("refreshes the route when it was deleted meanwhile, once the dialog closes", async () => {
    servePut(() => problemResponse(404, "NOT_FOUND"));
    const user = userEvent.setup();
    const { dialog, queryClient } = renderDialog();
    queryClient.setQueryData(["routes", "detail", forming.id], forming);

    await add(user, dialog, "Megenagna");
    await user.click(save(dialog));
    expect(
      await within(dialog).findByText(messages.Errors.NOT_FOUND),
    ).toBeVisible();
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

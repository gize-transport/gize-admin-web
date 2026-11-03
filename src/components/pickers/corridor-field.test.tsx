import { screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import {
  areas,
  bolePiassa,
  fill,
  mexicoBole,
  problemResponse,
  servePlaces,
} from "@/features/routes/test-support";
import { CorridorField } from "./corridor-field";

vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));

const t = messages.CorridorField;
type CorridorRef = Schemas["CorridorRef"];

startMswServer();

beforeEach(() => servePlaces());

async function pick(user: UserEvent, label: string, name: string) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.type(
    await screen.findByRole("combobox", {
      name: messages.AreaPicker.searchLabel,
    }),
    name.slice(0, 3),
  );
  await user.click(await screen.findByRole("option", { name }));
}

/** Holds the value like a form does; `lag` delays the value coming back, like a URL. */
function Field({
  onChange,
  initial = null,
}: {
  onChange?: (corridor: CorridorRef | null) => void;
  initial?: CorridorRef | null;
}) {
  const [value, setValue] = useState<CorridorRef | null>(initial);
  return (
    <>
      <CorridorField
        id="corridor"
        legend="Corridor"
        value={value}
        onChange={(corridor) => {
          onChange?.(corridor);
          setValue(corridor);
        }}
      />
      <button type="button" onClick={() => setValue(mexicoBole)}>
        Change from outside
      </button>
    </>
  );
}

describe("CorridorField", () => {
  it("finds the corridor between the two areas and confirms it", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Field onChange={onChange} />);

    await pick(user, t.originLabel, "Bole");
    await pick(user, t.destinationLabel, "Piassa");

    expect(
      await screen.findByText(
        fill(t.found, { origin: "Bole", destination: "Piassa" }),
      ),
    ).toBeVisible();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: bolePiassa.id }),
    );
  });

  it("shows a failed lookup with its reference, and retries", async () => {
    let fail = true;
    server.use(
      http.get(apiUrl("/v1/corridors"), () => {
        if (fail) {
          fail = false;
          return problemResponse(503, "SERVICE_UNAVAILABLE", "req-lookup");
        }
        return HttpResponse.json<Schemas["CorridorPage"]>({
          items: [
            {
              ...bolePiassa,
              created_at: "2026-10-01T06:00:00Z",
              updated_at: "2026-10-01T06:00:00Z",
            },
          ],
          next_cursor: null,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Field />);

    await pick(user, t.originLabel, "Bole");
    await pick(user, t.destinationLabel, "Piassa");
    expect(await screen.findByText("req-lookup")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    );
    expect(
      await screen.findByText(
        fill(t.found, { origin: "Bole", destination: "Piassa" }),
      ),
    ).toBeVisible();
  });

  it("reports only the latest pair when an earlier lookup answers later", async () => {
    server.use(
      http.get(apiUrl("/v1/corridors"), async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const destination = params.get("destination_area_id");
        // Bole → Piassa answers slowly (after the next pick); Bole → Mexico (none) at once.
        if (destination === areas.piassa.id) await delay(2500);
        return HttpResponse.json<Schemas["CorridorPage"]>({
          items:
            destination === areas.piassa.id
              ? [
                  {
                    ...bolePiassa,
                    created_at: "2026-10-01T06:00:00Z",
                    updated_at: "2026-10-01T06:00:00Z",
                  },
                ]
              : [],
          next_cursor: null,
        });
      }),
    );
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Field onChange={onChange} />);

    await pick(user, t.originLabel, "Bole");
    await pick(user, t.destinationLabel, "Piassa");
    await pick(user, t.destinationLabel, "Mexico");

    expect(
      await screen.findByText(
        fill(t.none, { origin: "Bole", destination: "Mexico" }),
      ),
    ).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 2600));
    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: bolePiassa.id }),
    );
    expect(
      screen.getByRole("combobox", { name: t.destinationLabel }),
    ).toHaveTextContent("Mexico");
  });

  it("keeps its areas while the value it reported comes back late", async () => {
    // Like a filter in the URL: the value comes back a moment after it was reported.
    function Lagging() {
      const [value, setValue] = useState<CorridorRef | null>(null);
      return (
        <CorridorField
          id="corridor"
          legend="Corridor"
          value={value}
          onChange={(corridor) => setTimeout(() => setValue(corridor), 50)}
        />
      );
    }
    const user = userEvent.setup();
    renderWithProviders(<Lagging />);

    await pick(user, t.originLabel, "Bole");
    await pick(user, t.destinationLabel, "Piassa");
    await screen.findByText(
      fill(t.found, { origin: "Bole", destination: "Piassa" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(
      screen.getByRole("combobox", { name: t.originLabel }),
    ).toHaveTextContent("Bole");
    expect(
      screen.getByRole("combobox", { name: t.destinationLabel }),
    ).toHaveTextContent("Piassa");
  });

  it("shows a change from outside and drops a lookup still running", async () => {
    server.use(
      http.get(apiUrl("/v1/corridors"), async () => {
        await delay(1500);
        return HttpResponse.json<Schemas["CorridorPage"]>({
          items: [
            {
              ...bolePiassa,
              created_at: "2026-10-01T06:00:00Z",
              updated_at: "2026-10-01T06:00:00Z",
            },
          ],
          next_cursor: null,
        });
      }),
    );
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Field initial={bolePiassa} onChange={onChange} />);
    expect(
      screen.getByRole("combobox", { name: t.originLabel }),
    ).toHaveTextContent("Bole");

    await pick(user, t.destinationLabel, "Mexico");
    await pick(user, t.destinationLabel, "Piassa"); // a slow lookup starts
    await user.click(
      screen.getByRole("button", { name: "Change from outside" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: t.originLabel }),
      ).toHaveTextContent("Mexico"),
    );
    // The slow Bole → Piassa lookup answers after the change: it must not report.
    await new Promise((resolve) => setTimeout(resolve, 1600));
    expect(onChange).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ id: bolePiassa.id }),
    );
    expect(
      screen.getByRole("combobox", { name: t.originLabel }),
    ).toHaveTextContent("Mexico");
  });
});

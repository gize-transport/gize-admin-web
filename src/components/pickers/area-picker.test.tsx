import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import type { AreaSearchResult } from "@/features/areas/queries";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { AreaPicker } from "./area-picker";

vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));

type AreaRef = components["schemas"]["AreaRef"];
const t = messages.AreaPicker;

const areas: AreaRef[] = [
  { id: "a1", name: "Megenagna" },
  { id: "a2", name: "Mexico" },
  { id: "a3", name: "Piassa" },
];

startMswServer();

/** Stands in for the API: names starting with q, ignoring case. */
function searchAreas(q: string): Promise<AreaSearchResult> {
  return Promise.resolve({
    items: areas.filter((area) =>
      area.name.toLowerCase().startsWith(q.toLowerCase()),
    ),
    hasMore: false,
  });
}

function Field({
  search,
  initial = null,
  onChange,
}: {
  search?: (q: string) => Promise<AreaSearchResult>;
  initial?: AreaRef | null;
  onChange?: (area: AreaRef | null) => void;
}) {
  const [value, setValue] = useState<AreaRef | null>(initial);
  return (
    <div>
      <label id="origin-label" htmlFor="origin">
        Origin area
      </label>
      <AreaPicker
        id="origin"
        value={value}
        onChange={(area) => {
          setValue(area);
          onChange?.(area);
        }}
        search={search ?? searchAreas}
      />
    </div>
  );
}

describe("AreaPicker", () => {
  it("is a labelled button that shows the placeholder until an area is chosen", () => {
    renderWithProviders(<Field />);

    const trigger = screen.getByRole("combobox", { name: "Origin area" });
    expect(trigger).toHaveTextContent(t.placeholder);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("searches the API as you type and picks with the keyboard", async () => {
    const search = vi.fn(searchAreas);
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Field search={search} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Origin area" }));
    expect(screen.getByRole("dialog", { name: t.searchLabel })).toBeVisible();
    const input = screen.getByRole("combobox", { name: t.searchLabel });
    expect(input).toHaveFocus();
    await user.type(input, "me");
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("me"));
    expect(
      await screen.findByRole("option", { name: "Megenagna" }),
    ).toBeVisible();
    expect(screen.getByRole("listbox", { name: t.listLabel })).toBeVisible();
    expect(screen.getByRole("option", { name: "Mexico" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "Piassa" })).toBeNull();

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith({ id: "a2", name: "Mexico" });
    const trigger = screen.getByRole("combobox", { name: "Origin area" });
    expect(trigger).toHaveTextContent("Mexico");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("never offers the previous results while a new search is pending", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Field />);

    await user.click(screen.getByRole("combobox", { name: "Origin area" }));
    expect(await screen.findByRole("option", { name: "Piassa" })).toBeVisible();
    await user.type(
      screen.getByRole("combobox", { name: t.searchLabel }),
      "me",
    );

    // Straight after typing: no stale "Piassa", only the searching state.
    expect(screen.queryByRole("option", { name: "Piassa" })).toBeNull();
    expect(screen.getByRole("progressbar", { name: t.loading })).toBeVisible();
    expect(await screen.findByRole("option", { name: "Mexico" })).toBeVisible();
  });

  it("says when nothing starts with the text", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Field />);

    await user.click(screen.getByRole("combobox", { name: "Origin area" }));
    await user.type(
      screen.getByRole("combobox", { name: t.searchLabel }),
      "zz",
    );

    expect(await screen.findByText(t.noResults)).toBeInTheDocument();
  });

  it("explains a failed search with its reference, outside the list, and retries", async () => {
    let calls = 0;
    const failingOnce = (q: string) => {
      calls += 1;
      if (calls > 1) return searchAreas(q);
      return Promise.reject(
        ApiError.fromResponse(new Response(null, { status: 503 }), {
          type: "about:blank",
          title: "SERVICE_UNAVAILABLE",
          status: 503,
          code: "SERVICE_UNAVAILABLE",
          request_id: "req-picker",
        }),
      );
    };
    const user = userEvent.setup();
    renderWithProviders(<Field search={failingOnce} />);

    await user.click(screen.getByRole("combobox", { name: "Origin area" }));

    expect(
      await screen.findByText(messages.Errors.SERVICE_UNAVAILABLE),
    ).toBeInTheDocument();
    expect(screen.getByText("req-picker")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: messages.ProblemAlert.retry }),
    );
    expect(await screen.findByRole("option", { name: "Piassa" })).toBeVisible();
  });

  it("says when more areas match than it shows", async () => {
    const many = async (): Promise<AreaSearchResult> => ({
      items: areas,
      hasMore: true,
    });
    const user = userEvent.setup();
    renderWithProviders(<Field search={many} />);

    await user.click(screen.getByRole("combobox", { name: "Origin area" }));

    expect(await screen.findByText(t.moreHint)).toBeInTheDocument();
  });

  it("asks the API for the first 20 areas starting with the trimmed text", async () => {
    const seen: URL[] = [];
    server.use(
      http.get(apiUrl("/v1/areas"), ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json<Schemas["AreaPage"]>({
          items: [
            {
              id: "00000000-0000-4000-a000-000000000004",
              name: "Megenagna",
              created_at: "2026-10-01T06:00:00Z",
              updated_at: "2026-10-01T06:00:00Z",
            },
          ],
          next_cursor: "more",
        });
      }),
    );
    const user = userEvent.setup();
    // No `search`: the real one, calling `areas_list`.
    renderWithProviders(
      <AreaPicker id="origin" value={null} onChange={vi.fn()} />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(
      screen.getByRole("combobox", { name: t.searchLabel }),
      " me",
    );

    expect(
      await screen.findByRole("option", { name: "Megenagna" }),
    ).toBeVisible();
    expect(screen.getByText(t.moreHint)).toBeInTheDocument();
    expect(seen[0]?.searchParams.get("limit")).toBe("20");
    expect(seen[0]?.searchParams.has("q")).toBe(false);
    expect(seen.at(-1)?.searchParams.get("q")).toBe("me");
    // A to Z, every time.
    expect(seen.every((url) => url.searchParams.get("sort") === "name")).toBe(
      true,
    );
  });

  it("can clear a chosen area", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <Field initial={{ id: "a3", name: "Piassa" }} onChange={onChange} />,
    );

    await user.click(
      screen.getByRole("button", { name: t.clear.replace("{name}", "Piassa") }),
    );

    expect(onChange).toHaveBeenCalledWith(null);
    expect(
      screen.getByRole("combobox", { name: "Origin area" }),
    ).toHaveTextContent(t.placeholder);
  });
});

describe("AreaPicker in a toolbar", () => {
  it("shows its short label, then the label with the choice, marked active", async () => {
    const user = userEvent.setup();
    function Toolbar() {
      const [value, setValue] = useState<AreaRef | null>(null);
      return (
        <>
          <label htmlFor="from" className="sr-only">
            From (origin area)
          </label>
          <AreaPicker
            id="from"
            toolbarLabel="From"
            value={value}
            onChange={setValue}
            search={searchAreas}
          />
        </>
      );
    }
    renderWithProviders(<Toolbar />);

    // Named by its label; the button shows the short one.
    const trigger = screen.getByRole("combobox", {
      name: "From (origin area)",
    });
    expect(trigger).toHaveTextContent(/^From$/);
    expect(trigger).not.toHaveAttribute("data-active");

    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "Piassa" }));

    expect(trigger).toHaveTextContent(/^From: Piassa$/);
    expect(trigger).toHaveAttribute("data-active");
  });
});

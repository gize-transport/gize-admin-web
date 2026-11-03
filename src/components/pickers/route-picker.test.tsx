import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { forming } from "@/features/routes/test-support";
import { RoutePicker } from "./route-picker";

vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));

const t = messages.RoutePicker;

startMswServer();

describe("RoutePicker", () => {
  it("finds routes by the start of their code and hands back the reference", async () => {
    const seen: URL[] = [];
    server.use(
      http.get(apiUrl("/v1/routes"), ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json<Schemas["RoutePage"]>({
          items: [forming],
          next_cursor: null,
        });
      }),
    );
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <label htmlFor="route">Route</label>
        <RoutePicker id="route" value={null} onChange={onChange} />
      </>,
    );

    const trigger = screen.getByRole("combobox", { name: "Route" });
    expect(trigger).toHaveTextContent(t.placeholder);
    await user.click(trigger);
    await user.type(
      screen.getByRole("combobox", { name: t.searchLabel }),
      "b-",
    );
    await user.click(await screen.findByRole("option", { name: "B-01" }));

    expect(onChange).toHaveBeenCalledWith({ id: forming.id, code: "B-01" });
    expect(seen.at(-1)?.searchParams.get("q")).toBe("b-");
    expect(seen.at(-1)?.searchParams.get("limit")).toBe("20");
  });
});

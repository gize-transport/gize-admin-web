import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { startMswServer } from "../../../tests/msw/start-msw-server";
import { renderWithProviders } from "../../../tests/utils/render";
import { CompanyPicker } from "./company-picker";

vi.mock("@/lib/auth/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }),
  getAccessToken: async () => "access-token",
}));

const t = messages.CompanyPicker;

startMswServer();

describe("CompanyPicker", () => {
  it("offers active companies only, found by the start of their name", async () => {
    const seen: URL[] = [];
    server.use(
      http.get(apiUrl("/v1/companies"), ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json<Schemas["CompanyPage"]>({
          items: [
            {
              id: "00000000-0000-4000-c000-000000000001",
              name: "Addis Brewery",
              contact_name: "Hana Bekele",
              contact_phone: "+251911234567",
              contact_email: "hana@addisbrewery.test",
              billing: "postpaid",
              notes: null,
              is_active: true,
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
    renderWithProviders(
      <>
        <label htmlFor="company">Company</label>
        <CompanyPicker id="company" value={null} onChange={onChange} />
      </>,
    );

    const trigger = screen.getByRole("combobox", { name: "Company" });
    expect(trigger).toHaveTextContent(t.placeholder);
    await user.click(trigger);
    await user.type(
      screen.getByRole("combobox", { name: t.searchLabel }),
      "add",
    );
    await user.click(
      await screen.findByRole("option", { name: "Addis Brewery" }),
    );

    // Only the reference is handed back: the contact details stay out of the form.
    expect(onChange).toHaveBeenCalledWith({
      id: "00000000-0000-4000-c000-000000000001",
      name: "Addis Brewery",
    });
    expect(
      seen.every((url) => url.searchParams.get("is_active") === "true"),
    ).toBe(true);
    expect(seen.at(-1)?.searchParams.get("q")).toBe("add");
    expect(seen.at(-1)?.searchParams.get("limit")).toBe("20");
  });
});

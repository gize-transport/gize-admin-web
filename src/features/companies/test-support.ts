// Shared by the companies tests: made-up companies and routes, and MSW handlers for them.
import { http, HttpResponse } from "msw";
import {
  apiUrl,
  problem,
  problemHeaders,
  server,
  type Schemas,
} from "../../../tests/msw/server";

const at = "2026-10-31T21:30:00Z";

export function company(
  name: string,
  index: number,
  overrides: Partial<Schemas["CompanyRead"]> = {},
): Schemas["CompanyRead"] {
  return {
    id: `00000000-0000-4000-c000-${String(index).padStart(12, "0")}`,
    name,
    contact_name: "Hana Bekele",
    contact_phone: "+251911234567",
    contact_email: "hana@example.test",
    billing: "postpaid",
    notes: null,
    is_active: true,
    created_at: at,
    updated_at: at,
    ...overrides,
  };
}

export const brewery = company("Addis Brewery", 1, {
  notes: "Invoices to the finance office.",
});
export const ceramics = company("Ethio Ceramics", 2, {
  contact_name: "Dawit Alemu",
  is_active: false,
});

export function route(
  code: string,
  owner: Schemas["CompanyRead"],
  status: Schemas["RouteStatus"],
  index: number,
): Schemas["RouteRead"] {
  return {
    id: `00000000-0000-4000-d000-${String(index).padStart(12, "0")}`,
    code,
    corridor: {
      id: "00000000-0000-4000-b000-000000000001",
      origin_area: { id: "00000000-0000-4000-a000-000000000001", name: "Bole" },
      destination_area: {
        id: "00000000-0000-4000-a000-000000000002",
        name: "Piassa",
      },
    },
    route_type: "corporate",
    school_name: null,
    company: { id: owner.id, name: owner.name },
    morning_time: "06:30",
    morning_arrival_time: "07:15",
    return_time: "17:30",
    return_arrival_time: "18:15",
    served_areas: [],
    seats: 14,
    launch_minimum: null,
    prices: null,
    status,
    copied_from_route_id: null,
    seats_taken: { this_month: 9, next_month: 9 },
    seats_free: { this_month: 5, next_month: 5 },
    reserved: 0,
    status_changes: [],
    created_at: at,
    updated_at: at,
  };
}

export function serveRole(role: Schemas["StaffRole"]) {
  server.use(
    http.get(apiUrl("/v1/staff/me"), () =>
      HttpResponse.json<Schemas["StaffMe"]>({
        id: "00000000-0000-4000-8000-000000000001",
        full_name: "Test",
        email: "t@gize.test",
        role,
      }),
    ),
  );
}

export function serveCompanies(
  items: Schemas["CompanyRead"][],
  seen?: URL[],
  nextCursor: string | null = null,
) {
  server.use(
    http.get(apiUrl("/v1/companies"), ({ request }) => {
      seen?.push(new URL(request.url));
      return HttpResponse.json<Schemas["CompanyPage"]>({
        items,
        next_cursor: nextCursor,
      });
    }),
  );
}

/** One company (its detail) and its routes; unknown ids get a 404. */
export function serveCompany(
  found: Schemas["CompanyRead"],
  routes: Schemas["RouteRead"][] = [],
) {
  server.use(
    http.get(apiUrl("/v1/companies/{company_id}"), ({ params }) =>
      params.company_id === found.id
        ? HttpResponse.json<Schemas["CompanyRead"]>(found)
        : HttpResponse.json(problem(404, "NOT_FOUND"), {
            status: 404,
            headers: problemHeaders,
          }),
    ),
    http.get(apiUrl("/v1/routes"), ({ request }) => {
      const companyId = new URL(request.url).searchParams.get("company_id");
      return HttpResponse.json<Schemas["RoutePage"]>({
        items: routes.filter((r) => r.company?.id === companyId),
        next_cursor: null,
      });
    }),
  );
}

export function problemResponse(
  status: number,
  code: Schemas["ErrorCode"],
  requestId = "req-123",
  headers: Record<string, string> = {},
) {
  return HttpResponse.json(problem(status, code, requestId), {
    status,
    headers: { ...problemHeaders, ...headers },
  });
}

export const fill = (text: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    text,
  );

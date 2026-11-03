// Shared by the routes tests: made-up routes, areas, corridors and MSW handlers for them.
import { http, HttpResponse } from "msw";
import {
  apiUrl,
  problem,
  problemHeaders,
  server,
  type Schemas,
} from "../../../tests/msw/server";

const at = "2026-10-31T21:30:00Z";

export const areas = {
  bole: { id: "00000000-0000-4000-a000-000000000001", name: "Bole" },
  piassa: { id: "00000000-0000-4000-a000-000000000002", name: "Piassa" },
  mexico: { id: "00000000-0000-4000-a000-000000000003", name: "Mexico" },
  cmc: { id: "00000000-0000-4000-a000-000000000004", name: "CMC" },
  megenagna: { id: "00000000-0000-4000-a000-000000000005", name: "Megenagna" },
} satisfies Record<string, Schemas["AreaRef"]>;

export const bolePiassa: Schemas["CorridorRef"] = {
  id: "00000000-0000-4000-b000-000000000001",
  origin_area: areas.bole,
  destination_area: areas.piassa,
};
export const mexicoBole: Schemas["CorridorRef"] = {
  id: "00000000-0000-4000-b000-000000000002",
  origin_area: areas.mexico,
  destination_area: areas.bole,
};

export const brewery: Schemas["CompanyRef"] = {
  id: "00000000-0000-4000-c000-000000000001",
  name: "Addis Brewery",
};

export function route(
  code: string,
  index: number,
  overrides: Partial<Schemas["RouteRead"]> = {},
): Schemas["RouteRead"] {
  return {
    id: `00000000-0000-4000-d000-${String(index).padStart(12, "0")}`,
    code,
    corridor: bolePiassa,
    route_type: "public",
    school_name: null,
    company: null,
    morning_time: "06:30",
    morning_arrival_time: "07:15",
    return_time: "17:30",
    return_arrival_time: "18:15",
    served_areas: [],
    seats: 14,
    launch_minimum: 10,
    prices: { round_trip: null, one_way: null, saturday: null },
    status: "draft",
    copied_from_route_id: null,
    seats_taken: { this_month: 9, next_month: 4 },
    seats_free: { this_month: 5, next_month: 10 },
    reserved: 0,
    status_changes: [],
    created_at: at,
    updated_at: at,
    ...overrides,
  };
}

/** Forming, priced, two areas served, 7 of 10 reserved. */
export const forming = route("B-01", 1, {
  status: "forming",
  reserved: 7,
  served_areas: [areas.cmc, areas.mexico],
  prices: { round_trip: 2400, one_way: 1400, saturday: 300 },
});
/** A student route made before arrival times existed. */
export const student = route("S-03", 2, {
  route_type: "student",
  school_name: "Lycée Guebre-Mariam",
  corridor: mexicoBole,
  morning_arrival_time: null,
  return_arrival_time: null,
});
export const corporate = route("R-21", 3, {
  route_type: "corporate",
  company: brewery,
  launch_minimum: null,
  prices: null,
  status: "active",
});

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

export function serveRoutes(
  items: Schemas["RouteRead"][],
  seen?: URL[],
  nextCursor: string | null = null,
) {
  server.use(
    http.get(apiUrl("/v1/routes"), ({ request }) => {
      seen?.push(new URL(request.url));
      return HttpResponse.json<Schemas["RoutePage"]>({
        items,
        next_cursor: nextCursor,
      });
    }),
  );
}

/** One route by id from `known`; others get a 404. */
export function serveRoute(...known: Schemas["RouteRead"][]) {
  server.use(
    http.get(apiUrl("/v1/routes/{route_id}"), ({ params }) => {
      const found = known.find((r) => r.id === params.route_id);
      return found
        ? HttpResponse.json<Schemas["RouteRead"]>(found)
        : problemResponse(404, "NOT_FOUND");
    }),
  );
}

/** The area pickers' list, the corridor lookup by its two areas, and the company picker. */
export function servePlaces(
  corridors: Schemas["CorridorRef"][] = [bolePiassa],
) {
  server.use(
    http.get(apiUrl("/v1/areas"), ({ request }) => {
      const q = (
        new URL(request.url).searchParams.get("q") ?? ""
      ).toLowerCase();
      return HttpResponse.json<Schemas["AreaPage"]>({
        items: Object.values(areas)
          .filter((a) => a.name.toLowerCase().startsWith(q))
          .map((a) => ({ ...a, created_at: at, updated_at: at })),
        next_cursor: null,
      });
    }),
    http.get(apiUrl("/v1/corridors"), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const items = corridors
        .filter(
          (c) =>
            c.origin_area.id === params.get("origin_area_id") &&
            c.destination_area.id === params.get("destination_area_id"),
        )
        .map((c) => ({ ...c, created_at: at, updated_at: at }));
      return HttpResponse.json<Schemas["CorridorPage"]>({
        items,
        next_cursor: null,
      });
    }),
    http.get(apiUrl("/v1/corridors/{corridor_id}"), ({ params }) => {
      const found = corridors.find((c) => c.id === params.corridor_id);
      return found
        ? HttpResponse.json<Schemas["CorridorRead"]>({
            ...found,
            created_at: at,
            updated_at: at,
          })
        : problemResponse(404, "NOT_FOUND");
    }),
    http.get(apiUrl("/v1/companies"), () =>
      HttpResponse.json<Schemas["CompanyPage"]>({
        items: [
          {
            ...brewery,
            contact_name: "Hana Bekele",
            contact_phone: "+251911234567",
            contact_email: "hana@example.test",
            billing: "postpaid",
            notes: null,
            is_active: true,
            created_at: at,
            updated_at: at,
          },
        ],
        next_cursor: null,
      }),
    ),
    http.get(apiUrl("/v1/companies/{company_id}"), ({ params }) =>
      params.company_id === brewery.id
        ? HttpResponse.json<Schemas["CompanyRead"]>({
            ...brewery,
            contact_name: "Hana Bekele",
            contact_phone: "+251911234567",
            contact_email: "hana@example.test",
            billing: "postpaid",
            notes: null,
            is_active: true,
            created_at: at,
            updated_at: at,
          })
        : problemResponse(404, "NOT_FOUND"),
    ),
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

export function validationResponse(
  field: string,
  reason: Schemas["ValidationReason"] = "invalid",
) {
  return HttpResponse.json<Schemas["ValidationProblem"]>(
    {
      type: "about:blank",
      title: "VALIDATION_FAILED",
      status: 422,
      code: "VALIDATION_FAILED",
      request_id: "req-422",
      errors: [{ location: "body", field, reason }],
      errors_truncated: false,
    },
    { status: 422, headers: problemHeaders },
  );
}

export const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    text,
  );

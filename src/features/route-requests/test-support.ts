// Shared by the route request tests: made-up requests (invented names and phones) and MSW handlers.
import { http, HttpResponse } from "msw";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { areas, route } from "../routes/test-support";

const at = "2026-10-10T07:00:00Z";

export const running = route("B-07", 7, { status: "active" });
export const schoolRoute = route("S-06", 6, {
  status: "active",
  route_type: "student",
  school_name: "Lycée Guebre-Mariam",
  launch_minimum: 8,
});

export function routeRequest(
  index: number,
  overrides: Partial<Schemas["RouteRequestRead"]> = {},
): Schemas["RouteRequestRead"] {
  return {
    id: `00000000-0000-4000-e000-${String(index).padStart(12, "0")}`,
    kind: "new_areas",
    from_area: areas.bole,
    from_area_name: null,
    to_area: null,
    to_area_name: "Lebu",
    route: null,
    rider_type: "adult",
    rider_name: "Selam Bekele",
    school_name: null,
    preferred_morning_time: "07:00",
    preferred_return_time: "17:30",
    contact_name: "Selam Bekele",
    contact_phone: "+251911000101",
    notes: null,
    source: "staff",
    status: "new",
    matched_route: null,
    decline_reason: null,
    created_at: at,
    updated_at: at,
    ...overrides,
  };
}

export const newAreas = routeRequest(1);
export const forRoute = routeRequest(2, {
  kind: "route",
  from_area: null,
  to_area_name: null,
  route: { id: running.id, code: "B-07" },
  rider_name: "Dawit Alemu",
  contact_name: "Dawit Alemu",
  contact_phone: "+251911000102",
  preferred_morning_time: null,
  preferred_return_time: null,
  notes: "Works near Piassa.",
});
export const matchedStudent = routeRequest(3, {
  from_area: areas.megenagna,
  to_area: areas.mexico,
  to_area_name: null,
  rider_type: "student",
  rider_name: "Liya Girma",
  school_name: "Lycée Guebre-Mariam",
  contact_name: "Meron Girma",
  contact_phone: "+251711000103",
  status: "matched",
  matched_route: { id: schoolRoute.id, code: "S-06" },
});
export const declined = routeRequest(4, {
  from_area: null,
  from_area_name: "Summit",
  to_area: areas.piassa,
  to_area_name: null,
  rider_name: "Kidus Tadesse",
  contact_name: "Kidus Tadesse",
  contact_phone: "+251911000104",
  status: "declined",
  decline_reason: "Too far from our corridors for now.",
});

export function serveRequests(
  items: Schemas["RouteRequestRead"][],
  seen?: URL[],
) {
  server.use(
    http.get(apiUrl("/v1/route-requests"), ({ request }) => {
      seen?.push(new URL(request.url));
      return HttpResponse.json<Schemas["RouteRequestPage"]>({
        items,
        next_cursor: null,
      });
    }),
  );
}

/** One request by id from `known`; others get a 404. */
export function serveRequest(...known: Schemas["RouteRequestRead"][]) {
  server.use(
    http.get(apiUrl("/v1/route-requests/{request_id}"), ({ params }) => {
      const found = known.find((r) => r.id === params.request_id);
      return found
        ? HttpResponse.json<Schemas["RouteRequestRead"]>(found)
        : HttpResponse.json(
            {
              type: "about:blank",
              title: "NOT_FOUND",
              status: 404,
              code: "NOT_FOUND",
              request_id: "req-404",
            },
            {
              status: 404,
              headers: { "Content-Type": "application/problem+json" },
            },
          );
    }),
  );
}

/** The route pickers' list: `items` for any search; what was asked for goes to `seen`. */
export function servePickerRoutes(items: Schemas["RouteRead"][], seen?: URL[]) {
  server.use(
    http.get(apiUrl("/v1/routes"), ({ request }) => {
      const url = new URL(request.url);
      seen?.push(url);
      const status = url.searchParams.get("status");
      const type = url.searchParams.get("route_type");
      return HttpResponse.json<Schemas["RoutePage"]>({
        items: items.filter(
          (r) =>
            (status === null || r.status === status) &&
            (type === null || r.route_type === type),
        ),
        next_cursor: null,
      });
    }),
  );
}

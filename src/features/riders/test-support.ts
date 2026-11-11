// Shared by the rider tests: made-up riders (invented names and phones) and MSW handlers.
import { http, HttpResponse } from "msw";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";
import { areas, brewery, problemResponse } from "../routes/test-support";

const at = "2026-09-20T07:00:00Z";

export const riderId = (index: number) =>
  `00000000-0000-4000-f000-${String(index).padStart(12, "0")}`;

const routeId = (index: number) =>
  `00000000-0000-4000-d000-${String(index).padStart(12, "0")}`;

export function rider(
  index: number,
  overrides: Partial<Schemas["RiderRead"]> = {},
): Schemas["RiderRead"] {
  return {
    id: riderId(index),
    rider_type: "adult",
    full_name: "Abel Tesfaye",
    phone: "+251911000412",
    home_area: areas.cmc,
    destination_area: areas.mexico,
    plan: "round_trip",
    saturday_addon: false,
    source: "staff",
    company: null,
    seat: null,
    next_seat: null,
    open_requests: 0,
    created_at: at,
    updated_at: at,
    ...overrides,
  };
}

/** The list's shape: the phone masked, as `riders_list` sends it. */
export function listed(read: Schemas["RiderRead"]): Schemas["RiderListItem"] {
  const { phone, ...rest } = read;
  return {
    ...rest,
    phone_masked: phone ? `${phone.slice(0, 5)}****${phone.slice(-4)}` : null,
  };
}

export const riding = rider(1, {
  seat: {
    route_id: routeId(3),
    route_code: "R-03",
    status: "active",
    start_date: "2026-09-01",
    end_date: null,
  },
});
export const reservedSat = rider(2, {
  full_name: "Kidus Alemu",
  phone: "+251911000208",
  plan: "morning",
  saturday_addon: true,
  source: "app",
  seat: {
    route_id: routeId(7),
    route_code: "R-07",
    status: "reserved",
    start_date: "2099-12-01",
    end_date: null,
  },
});
export const companyRider = rider(3, {
  rider_type: "corporate",
  full_name: "Hirut Bekele",
  phone: "+251911000303",
  destination_area: null,
  plan: null,
  company: brewery,
  home_area: areas.bole,
});
export const moving = rider(4, {
  full_name: "Mahlet Bekele",
  phone: "+251711000377",
  open_requests: 1,
  seat: {
    route_id: routeId(3),
    route_code: "R-03",
    status: "active",
    start_date: "2026-09-01",
    end_date: "2099-11-30",
  },
  next_seat: {
    route_id: routeId(7),
    route_code: "R-07",
    status: "active",
    start_date: "2099-12-01",
    end_date: null,
  },
});
export const noSeat = rider(5, { full_name: "Selam Girma" });

export function serveRiders(
  items: Schemas["RiderRead"][],
  seen?: URL[],
  nextCursor: string | null = null,
) {
  server.use(
    http.get(apiUrl("/v1/riders"), ({ request }) => {
      seen?.push(new URL(request.url));
      return HttpResponse.json<Schemas["RiderPage"]>({
        items: items.map(listed),
        next_cursor: nextCursor,
      });
    }),
  );
}

/** `riders_lookup`: riders whose phone is the one asked for; the bodies go to `seen`. */
export function serveLookup(
  known: Schemas["RiderRead"][],
  seen?: Schemas["RiderLookup"][],
) {
  server.use(
    http.post(apiUrl("/v1/riders/lookup"), async ({ request }) => {
      const body = (await request.json()) as Schemas["RiderLookup"];
      seen?.push(body);
      return HttpResponse.json<Schemas["RiderMatches"]>({
        items: known.filter((r) => r.phone === body.phone).map(listed),
      });
    }),
  );
}

/** One rider by id from `known`; others get a 404. */
export function serveRider(...known: Schemas["RiderRead"][]) {
  server.use(
    http.get(apiUrl("/v1/riders/{rider_id}"), ({ params }) => {
      const found = known.find((r) => r.id === params.rider_id);
      return found
        ? HttpResponse.json<Schemas["RiderRead"]>(found)
        : problemResponse(404, "NOT_FOUND");
    }),
  );
}

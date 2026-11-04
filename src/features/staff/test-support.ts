// Shared by the staff tests: made-up staff members (invented names and emails) and MSW handlers.
import { http, HttpResponse } from "msw";
import { apiUrl, server, type Schemas } from "../../../tests/msw/server";

const at = "2026-10-01T08:00:00Z";

export function member(
  index: number,
  overrides: Partial<Schemas["StaffRead"]> = {},
): Schemas["StaffRead"] {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    full_name: "Meron Admin",
    email: "meron@gize.test",
    role: "admin",
    is_active: true,
    first_signed_in_at: at,
    created_at: at,
    updated_at: at,
    ...overrides,
  };
}

/** The signed-in admin (`staff_me`). */
export const me = member(1, {
  full_name: "Abebe Admin",
  email: "admin@gize.test",
});
export const otherAdmin = member(3);
export const pending = member(4, {
  full_name: "Hana Tesfaye",
  email: "hana@gize.test",
  role: "staff",
  first_signed_in_at: null,
});
export const former = member(5, {
  full_name: "Dawit Former",
  email: "dawit@gize.test",
  role: "staff",
  is_active: false,
});

export function serveMe(role: Schemas["StaffRole"] = "admin") {
  server.use(
    http.get(apiUrl("/v1/staff/me"), () =>
      HttpResponse.json<Schemas["StaffMe"]>({
        id: me.id,
        full_name: me.full_name,
        email: me.email,
        role,
      }),
    ),
  );
}

export function serveMembers(items: Schemas["StaffRead"][], seen?: URL[]) {
  server.use(
    http.get(apiUrl("/v1/staff"), ({ request }) => {
      const url = new URL(request.url);
      seen?.push(url);
      const active = url.searchParams.get("is_active");
      return HttpResponse.json<Schemas["StaffPage"]>({
        items: items.filter(
          (m) => active === null || m.is_active === (active === "true"),
        ),
        next_cursor: null,
      });
    }),
  );
}

/** One member by id from `known`; others get a 404. */
export function serveMember(...known: Schemas["StaffRead"][]) {
  server.use(
    http.get(apiUrl("/v1/staff/{staff_id}"), ({ params }) => {
      // `/v1/staff/me` matches this path too: leave it to its own handler.
      if (params.staff_id === "me") return undefined;
      const found = known.find((m) => m.id === params.staff_id);
      return found
        ? HttpResponse.json<Schemas["StaffRead"]>(found)
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

export function servePatch(
  answer: (change: Schemas["StaffUpdate"]) => Response,
  seen?: Schemas["StaffUpdate"][],
) {
  server.use(
    http.patch(apiUrl("/v1/staff/{staff_id}"), async ({ request }) => {
      const change = (await request.json()) as Schemas["StaffUpdate"];
      seen?.push(change);
      return answer(change);
    }),
  );
}

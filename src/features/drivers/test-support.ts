// Shared by the drivers tests: made-up drivers (invented names, phones and plates) and MSW handlers.
import { http, HttpResponse } from "msw";
import {
  apiUrl,
  problem,
  problemHeaders,
  server,
  type Schemas,
} from "../../../tests/msw/server";

const at = "2026-11-05T07:30:00Z";

export function driver(
  name: string,
  index: number,
  overrides: Partial<Schemas["DriverRead"]> = {},
): Schemas["DriverRead"] {
  return {
    id: `00000000-0000-4000-9900-${String(index).padStart(12, "0")}`,
    full_name: name,
    phone: `+2519110002${String(index).padStart(2, "0")}`,
    address: "Bole, near Edna Mall",
    plate: `AA 3-B1234${index}`,
    is_active: true,
    created_at: at,
    updated_at: at,
    ...overrides,
  };
}

export const bereket = driver("Bereket Tolosa", 1);
export const sara = driver("Sara Mohammed", 2, {
  is_active: false,
  address: "Megenagna",
  updated_at: "2026-11-08T09:00:00Z",
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

export function serveDrivers(
  items: Schemas["DriverRead"][],
  seen?: URL[],
  nextCursor: string | null = null,
) {
  server.use(
    http.get(apiUrl("/v1/drivers"), ({ request }) => {
      seen?.push(new URL(request.url));
      return HttpResponse.json<Schemas["DriverPage"]>({
        items,
        next_cursor: nextCursor,
      });
    }),
  );
}

/** One driver (their detail); unknown ids get a 404. */
export function serveDriver(found: Schemas["DriverRead"]) {
  server.use(
    http.get(apiUrl("/v1/drivers/{driver_id}"), ({ params }) =>
      params.driver_id === found.id
        ? HttpResponse.json<Schemas["DriverRead"]>(found)
        : HttpResponse.json(problem(404, "NOT_FOUND"), {
            status: 404,
            headers: problemHeaders,
          }),
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

export const fill = (text: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    text,
  );

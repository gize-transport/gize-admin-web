// @vitest-environment node
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  apiUrl,
  problem,
  problemHeaders,
  server,
  testApiBaseUrl,
  type Schemas,
} from "../../../tests/msw/server";
import { useMswServer } from "../../../tests/msw/use-msw-server";
import { createApiClient, unwrap } from "./client";
import { ApiError } from "./problem";

useMswServer();

const area: Schemas["AreaRead"] = {
  id: "0b6a3a52-7c1a-4f5e-9a39-3d1c1c8c1f10",
  name: "Bole",
  created_at: "2026-10-31T07:00:00Z",
  updated_at: "2026-10-31T07:00:00Z",
};

function client(token: string | null = "access-token") {
  return createApiClient({
    baseUrl: testApiBaseUrl,
    getAccessToken: async () => token,
  });
}

describe("createApiClient", () => {
  it("sends the access token as a bearer header", async () => {
    let authorization: string | null = null;
    server.use(
      http.get(apiUrl("/v1/areas"), ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json<Schemas["AreaPage"]>({
          items: [area],
          next_cursor: null,
        });
      }),
    );

    const page = await unwrap(
      client().GET("/v1/areas", { params: { query: { limit: 25 } } }),
    );

    expect(authorization).toBe("Bearer access-token");
    expect(page.items).toEqual([area]);
  });

  it("sends no Authorization header without a session", async () => {
    let hasAuthorization = true;
    server.use(
      http.get(apiUrl("/v1/areas"), ({ request }) => {
        hasAuthorization = request.headers.has("Authorization");
        return HttpResponse.json<Schemas["AreaPage"]>({
          items: [],
          next_cursor: null,
        });
      }),
    );

    await unwrap(client(null).GET("/v1/areas"));

    expect(hasAuthorization).toBe(false);
  });

  it("passes the Idempotency-Key a create is given", async () => {
    let key: string | null = null;
    server.use(
      http.post(apiUrl("/v1/areas"), ({ request }) => {
        key = request.headers.get("Idempotency-Key");
        return HttpResponse.json<Schemas["AreaRead"]>(area, { status: 201 });
      }),
    );

    await unwrap(
      client().POST("/v1/areas", {
        params: { header: { "Idempotency-Key": "key-1" } },
        body: { name: "Bole" },
      }),
    );

    expect(key).toBe("key-1");
  });

  it("resolves a 204 to undefined", async () => {
    server.use(
      http.delete(
        apiUrl("/v1/areas/{area_id}"),
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const result = await unwrap(
      client().DELETE("/v1/areas/{area_id}", {
        params: { path: { area_id: area.id } },
      }),
    );

    // Typed as undefined (not never), so a mutation's data type stays honest.
    const typed: undefined = result;
    expect(typed).toBeUndefined();
  });
});

describe("unwrap", () => {
  it("throws an ApiError with the problem's code and request ID", async () => {
    server.use(
      http.post(apiUrl("/v1/areas"), () =>
        HttpResponse.json(problem(409, "AREA_NAME_TAKEN", "req-409"), {
          status: 409,
          headers: problemHeaders,
        }),
      ),
    );

    const error = await unwrap(
      client().POST("/v1/areas", {
        params: { header: { "Idempotency-Key": "key-1" } },
        body: { name: "Bole" },
      }),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "AREA_NAME_TAKEN",
      requestId: "req-409",
    });
  });

  it("reads Retry-After on a 429", async () => {
    server.use(
      http.get(apiUrl("/v1/areas"), () =>
        HttpResponse.json(problem(429, "RATE_LIMITED"), {
          status: 429,
          headers: { ...problemHeaders, "Retry-After": "12" },
        }),
      ),
    );

    await expect(unwrap(client().GET("/v1/areas"))).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 12,
    });
  });

  it("turns a failed connection into a network ApiError", async () => {
    server.use(http.get(apiUrl("/v1/areas"), () => HttpResponse.error()));

    await expect(unwrap(client().GET("/v1/areas"))).rejects.toMatchObject({
      kind: "network",
      status: 0,
    });
  });

  it("lets a cancelled request's AbortError through", async () => {
    server.use(
      http.get(apiUrl("/v1/areas"), () =>
        HttpResponse.json<Schemas["AreaPage"]>({
          items: [],
          next_cursor: null,
        }),
      ),
    );
    const controller = new AbortController();
    controller.abort();

    const error = await unwrap(
      client().GET("/v1/areas", { signal: controller.signal }),
    ).catch((caught: unknown) => caught);

    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).name).toBe("AbortError");
  });

  it("asks for the token on every request (the session refreshes it)", async () => {
    const getAccessToken = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    const seen: (string | null)[] = [];
    server.use(
      http.get(apiUrl("/v1/areas"), ({ request }) => {
        seen.push(request.headers.get("Authorization"));
        return HttpResponse.json<Schemas["AreaPage"]>({
          items: [],
          next_cursor: null,
        });
      }),
    );
    const api = createApiClient({ baseUrl: testApiBaseUrl, getAccessToken });

    await unwrap(api.GET("/v1/areas"));
    await unwrap(api.GET("/v1/areas"));

    expect(seen).toEqual(["Bearer first", "Bearer second"]);
  });
});

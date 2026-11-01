import { describe, expect, it } from "vitest";
import { ApiError, fieldPath, parseRetryAfter } from "./problem";

function response(status: number, headers: Record<string, string> = {}) {
  return new Response(null, { status, headers });
}

describe("ApiError.fromResponse", () => {
  it("reads a problem+json body", () => {
    const error = ApiError.fromResponse(response(409), {
      type: "about:blank",
      title: "Area name taken",
      status: 409,
      code: "AREA_NAME_TAKEN",
      request_id: "req-1",
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: "http",
      status: 409,
      code: "AREA_NAME_TAKEN",
      requestId: "req-1",
      retryAfterSeconds: null,
      fieldErrors: [],
    });
  });

  it("keeps validation errors with their field paths", () => {
    const error = ApiError.fromResponse(response(422), {
      type: "about:blank",
      title: "Validation failed",
      status: 422,
      code: "VALIDATION_FAILED",
      request_id: "req-2",
      errors: [
        { location: "body", field: "/name", reason: "too_long" },
        { location: "body", field: "/area_ids/2", reason: "invalid" },
      ],
      errors_truncated: false,
    });

    expect(error.fieldErrors).toEqual([
      { location: "body", field: "/name", path: "name", reason: "too_long" },
      {
        location: "body",
        field: "/area_ids/2",
        path: "area_ids.2",
        reason: "invalid",
      },
    ]);
  });

  it("falls back to the X-Request-ID header and a code from the status", () => {
    const error = ApiError.fromResponse(
      response(503, { "X-Request-ID": "req-hdr", "Retry-After": "7" }),
      "<html>Bad gateway</html>",
    );

    expect(error).toMatchObject({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      requestId: "req-hdr",
      retryAfterSeconds: 7,
    });
  });

  it.each([
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [413, "PAYLOAD_TOO_LARGE"],
    [429, "RATE_LIMITED"],
    [500, "INTERNAL_ERROR"],
    [502, "INTERNAL_ERROR"],
    [418, null],
  ])("a %i without a problem body has code %s", (status, code) => {
    expect(ApiError.fromResponse(response(status), undefined).code).toBe(code);
  });
});

describe("ApiError.network", () => {
  it("marks a request that never got a response", () => {
    const cause = new TypeError("Failed to fetch");
    const error = ApiError.network(cause);

    expect(error).toMatchObject({
      kind: "network",
      status: 0,
      code: null,
      requestId: null,
    });
    expect(error.cause).toBe(cause);
  });
});

describe("parseRetryAfter", () => {
  const now = Date.parse("2026-11-01T10:00:00Z");

  it("reads seconds and HTTP dates, never below zero", () => {
    expect(parseRetryAfter("30", now)).toBe(30);
    expect(parseRetryAfter("Sun, 01 Nov 2026 10:00:45 GMT", now)).toBe(45);
    expect(parseRetryAfter("Sun, 01 Nov 2026 09:00:00 GMT", now)).toBe(0);
  });

  it("ignores a missing or unreadable value", () => {
    expect(parseRetryAfter(null, now)).toBeNull();
    expect(parseRetryAfter("soon", now)).toBeNull();
    expect(parseRetryAfter("-5", now)).toBeNull();
  });
});

describe("fieldPath", () => {
  it("turns a JSON pointer into a form field path", () => {
    expect(fieldPath("/contact_phone")).toBe("contact_phone");
    expect(fieldPath("/area_ids/2")).toBe("area_ids.2");
    expect(fieldPath("/a~1b/c~0d")).toBe("a/b.c~d");
    expect(fieldPath("")).toBe("");
    expect(fieldPath("name")).toBe("name");
  });
});

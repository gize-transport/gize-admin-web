import type { components } from "./schema";

export type ErrorCode = components["schemas"]["ErrorCode"];
export type ValidationReason = components["schemas"]["ValidationReason"];
type FieldError = components["schemas"]["FieldError"];

/** A validation error with `field` (a JSON pointer) also as a form field path. */
export type ApiFieldError = FieldError & {
  /** `/area_ids/2` → `area_ids.2`; `""` for the whole request. */
  path: string;
};

/** What a status means when the response has no problem+json body (e.g. a proxy's error page). */
function codeForStatus(status: number): ErrorCode | null {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  if (status >= 500) return "INTERNAL_ERROR";
  return null;
}

/** `/a~1b/c` → `a/b.c` (RFC 6901 unescaping, dots between parts). */
export function fieldPath(pointer: string): string {
  if (pointer === "") return "";
  return (pointer.startsWith("/") ? pointer.slice(1) : pointer)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .join(".");
}

/** Seconds to wait from a `Retry-After` header (seconds or an HTTP date), or null. */
export function parseRetryAfter(
  value: string | null,
  now: number = Date.now(),
): number | null {
  if (value === null || value.trim() === "") return null;
  if (/^\d+$/.test(value.trim())) return Number(value.trim());
  // Otherwise an HTTP date ("Sun, 01 Nov 2026 10:00:45 GMT"); Date.parse alone would read "-5" as a year.
  if (!/[a-z]/i.test(value)) return null;
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readFieldErrors(body: Record<string, unknown>): ApiFieldError[] {
  if (!Array.isArray(body.errors)) return [];
  return body.errors.filter(isRecord).flatMap((item) =>
    typeof item.field === "string" &&
    typeof item.location === "string" &&
    typeof item.reason === "string"
      ? [
          {
            location: item.location as FieldError["location"],
            field: item.field,
            path: fieldPath(item.field),
            reason: item.reason as ValidationReason,
          },
        ]
      : [],
  );
}

/**
 * A failed API call. Screens show `code` through `useApiErrorMessages` (errors.ts) and always
 * show `requestId` (ProblemAlert), and wait `retryAfterSeconds` on 429/503.
 */
export class ApiError extends Error {
  /** `network`: no response at all (offline, DNS, CORS). `http`: the API answered with an error. */
  readonly kind: "network" | "http";
  /** HTTP status; 0 for a network error. */
  readonly status: number;
  /**
   * The problem's code: one of the contract's, or a newer one the pinned contract doesn't
   * know yet (errors.ts then falls back to a general message).
   */
  readonly code: ErrorCode | (string & {}) | null;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;
  readonly fieldErrors: ApiFieldError[];

  private constructor(
    message: string,
    fields: {
      kind: "network" | "http";
      status: number;
      code: ErrorCode | (string & {}) | null;
      requestId: string | null;
      retryAfterSeconds: number | null;
      fieldErrors: ApiFieldError[];
    },
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
    this.kind = fields.kind;
    this.status = fields.status;
    this.code = fields.code;
    this.requestId = fields.requestId;
    this.retryAfterSeconds = fields.retryAfterSeconds;
    this.fieldErrors = fields.fieldErrors;
  }

  /** From an error response and its parsed body (problem+json, or anything else). */
  static fromResponse(response: Response, body: unknown): ApiError {
    const problem = isRecord(body) ? body : {};
    const code =
      typeof problem.code === "string"
        ? problem.code
        : codeForStatus(response.status);
    const requestId =
      typeof problem.request_id === "string"
        ? problem.request_id
        : response.headers.get("X-Request-ID");
    // The message carries only the status and code: no URLs, bodies or personal data.
    return new ApiError(`API error ${response.status} ${code ?? "UNKNOWN"}`, {
      kind: "http",
      status: response.status,
      code,
      requestId,
      retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
      fieldErrors: readFieldErrors(problem),
    });
  }

  /** A request that got no response. */
  static network(cause: unknown): ApiError {
    return new ApiError(
      "API unreachable",
      {
        kind: "network",
        status: 0,
        code: null,
        requestId: null,
        retryAfterSeconds: null,
        fieldErrors: [],
      },
      { cause },
    );
  }
}

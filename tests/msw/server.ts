import { setupServer } from "msw/node";
import type { components, paths } from "@/lib/api/schema";

/** The API base URL the tests run with (vitest.config.ts `test.env`). */
export const testApiBaseUrl = "http://api.test";

/**
 * MSW URL for a path from the generated contract: `{area_id}` becomes `:area_id`, so a
 * handler can only be written for a path that exists in openapi.json.
 */
export function apiUrl(path: keyof paths) {
  return `${testApiBaseUrl}${path.replace(/\{(\w+)\}/g, ":$1")}`;
}

export type Schemas = components["schemas"];

/** A problem+json body as the API sends it. */
export function problem(
  status: number,
  code: Schemas["ErrorCode"],
  requestId: string | null = "req-123",
): Schemas["Problem"] {
  return {
    type: "about:blank",
    title: code,
    status,
    code,
    request_id: requestId,
  };
}

export const problemHeaders = { "Content-Type": "application/problem+json" };

/** Shared MSW server: start it in a test file with `startMswServer()`. */
export const server = setupServer();

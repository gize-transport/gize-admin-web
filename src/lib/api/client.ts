import createClient from "openapi-fetch";
import { getAccessToken } from "@/lib/auth/supabase-browser";
import { env } from "@/lib/env";
import { ApiError } from "./problem";
import type { paths } from "./schema";

type ApiClientOptions = {
  baseUrl: string;
  /** The current Supabase access token, or null when signed out. Asked on every request. */
  getAccessToken: () => Promise<string | null>;
};

/**
 * A typed client for the Gize Admin API: paths, parameters and bodies come from the generated
 * contract (schema.d.ts), so no endpoint URL or API type is written by hand.
 */
export function createApiClient({
  baseUrl,
  getAccessToken: readToken,
}: ApiClientOptions) {
  const client = createClient<paths>({
    baseUrl,
    // Looked up per request, so instrumentation (Sentry, MSW in tests) that wraps fetch later still applies.
    fetch: (request) => globalThis.fetch(request),
  });
  client.use({
    async onRequest({ request }) {
      let token: string | null = null;
      try {
        token = await readToken();
      } catch {
        // No session we can read: send the request without a token; the API answers 401.
      }
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
  });
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The app's API client (browser): base URL from the env, token from the Supabase session. */
export const api = createApiClient({
  baseUrl: env.apiBaseUrl,
  getAccessToken,
});

type FetchResult = { data?: unknown; error?: unknown; response: Response };

/** The data an operation returns; `undefined` for one without a body (204). */
type DataOf<T extends FetchResult> = [NonNullable<T["data"]>] extends [never]
  ? undefined
  : NonNullable<T["data"]>;

/**
 * Awaits an API call and returns its data, or throws an `ApiError` (problem+json parsed,
 * request ID and Retry-After read). Use it in TanStack Query functions:
 * `queryFn: () => unwrap(api.GET("/v1/areas", { params: { query } }))`.
 */
export async function unwrap<T extends FetchResult>(
  request: Promise<T>,
): Promise<DataOf<T>> {
  let result: T;
  try {
    result = await request;
  } catch (cause) {
    // fetch rejects with a TypeError when no response arrives (offline, DNS, CORS). Anything
    // else (a cancelled query's AbortError, a body that isn't JSON, a bug) stays as it is, so
    // it isn't retried or explained as a lost connection.
    if (cause instanceof TypeError) throw ApiError.network(cause);
    throw cause;
  }
  if (!result.response.ok) {
    throw ApiError.fromResponse(result.response, result.error);
  }
  // A 204 has no body: callers of such operations get undefined.
  return result.data as DataOf<T>;
}

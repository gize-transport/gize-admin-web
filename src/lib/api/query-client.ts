import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./problem";

const MAX_QUERY_RETRIES = 2;

/**
 * Reads retry a lost connection or a gateway error up to twice (with TanStack's backoff).
 * Never a 4xx, a 500 or a 503: 429 and 503 wait for `Retry-After` in ProblemAlert, where the
 * user retries.
 */
export function shouldRetryQuery(failureCount: number, error: unknown) {
  if (failureCount >= MAX_QUERY_RETRIES || !(error instanceof ApiError)) {
    return false;
  }
  return (
    error.kind === "network" || error.status === 502 || error.status === 504
  );
}

type QueryClientOptions = {
  /** Called when the API answers 401 (session ended): send the user to sign in. */
  onUnauthenticated: () => void;
};

/** The app's TanStack Query client: retry rules, and 401 handled once for every call. */
export function createQueryClient({ onUnauthenticated }: QueryClientOptions) {
  const onError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) onUnauthenticated();
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: { retry: shouldRetryQuery, staleTime: 30_000 },
      // A mutation is retried only by the user, with the same Idempotency-Key.
      mutations: { retry: false },
    },
  });
}

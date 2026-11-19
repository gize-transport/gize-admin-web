import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";

export const overviewKeys = { all: ["overview"] as const };

/**
 * The home page's counts (`overview_get`), as of today in Addis Ababa. A snapshot of records that
 * change everywhere else: read again each time the page is opened or its tab comes back.
 */
export function useOverview() {
  return useQuery({
    queryKey: overviewKeys.all,
    queryFn: fetchOverview,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** How often the sidebar's count is read again while the tab is visible. */
const COUNT_REFRESH_MS = 60_000;

/**
 * The open route requests, for the sidebar on every page (GZW-073). Shares the overview's cache:
 * read again once a minute while the tab is visible, when the tab comes back, and at once after a
 * change that can open or close a request (route requests, seats, offers). After a 429 it waits
 * out `Retry-After` first. Undefined while unknown and after a failed read: the count is only a
 * hint, and the Route requests page shows its own errors.
 */
export function useOpenRequestCount() {
  const { data, isError } = useQuery({
    queryKey: overviewKeys.all,
    queryFn: fetchOverview,
    staleTime: COUNT_REFRESH_MS,
    refetchInterval: (query) =>
      Math.max(COUNT_REFRESH_MS, retryAfterLeftMs(query.state)),
    refetchOnWindowFocus: (query) => retryAfterLeftMs(query.state) === 0,
    select: (overview) => overview.route_requests.open,
  });
  return isError ? undefined : data;
}

/** What's left of a 429's (or 503's) `Retry-After`, in ms; 0 when there's nothing to wait for. */
function retryAfterLeftMs(state: { error: unknown; errorUpdatedAt: number }) {
  const { error } = state;
  if (!(error instanceof ApiError) || error.retryAfterSeconds === null) {
    return 0;
  }
  return Math.max(
    0,
    state.errorUpdatedAt + error.retryAfterSeconds * 1000 - Date.now(),
  );
}

function fetchOverview() {
  return unwrap(api.GET("/v1/overview"));
}

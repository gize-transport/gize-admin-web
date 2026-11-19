import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";

export const overviewKeys = { all: ["overview"] as const };

/**
 * The home page's counts (`overview_get`), as of today in Addis Ababa. A snapshot of records that
 * change everywhere else: read again each time the page is opened or its tab comes back.
 */
export function useOverview() {
  return useQuery({
    queryKey: overviewKeys.all,
    queryFn: () => unwrap(api.GET("/v1/overview")),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

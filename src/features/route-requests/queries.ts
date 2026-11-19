import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PickerResult } from "@/components/pickers/search-picker";
import { overviewKeys } from "@/features/overview/queries";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";

type RouteRequestCreate = components["schemas"]["RouteRequestCreate"];
type RouteRequestUpdate = components["schemas"]["RouteRequestUpdate"];
type RouteRequestStatusSet = components["schemas"]["RouteRequestStatusSet"];
type RouteType = components["schemas"]["RouteType"];
type RouteStatus = components["schemas"]["RouteStatus"];
export type RequestStatus = components["schemas"]["RequestStatus"];
export type RequestKind = components["schemas"]["RequestKind"];
export type RiderType =
  components["schemas"]["gize_api__route_requests__models__RiderType"];

export const REQUESTS_PAGE_SIZE = 25;
const PICKER_LIMIT = 20;

export type RequestFilters = {
  status: RequestStatus | null;
  kind: RequestKind | null;
  open: boolean | null;
  routeId: string | null;
  /** Each end of a new-areas request: a listed area's id or a name typed as not listed (never both). */
  fromAreaId: string | null;
  fromAreaName: string | null;
  toAreaId: string | null;
  toAreaName: string | null;
  cursor: string | null;
};

export const requestKeys = {
  all: ["route-requests"] as const,
  list: (filters: RequestFilters) =>
    ["route-requests", "list", filters] as const,
  detail: (id: string) => ["route-requests", "detail", id] as const,
  summary: ["route-requests", "summary"] as const,
};

/** Open demand per area pair and per route (`route_requests_summary`), busiest first. */
export function useDemandSummary() {
  return useQuery({
    queryKey: requestKeys.summary,
    queryFn: () => unwrap(api.GET("/v1/route-requests/summary")),
    // Routes and areas change elsewhere (status, seats, names): fresh each time it's opened.
    staleTime: 0,
  });
}

/** One page of route requests (`route_requests_list`), oldest first; the filters combine (AND). */
export function useRouteRequests(filters: RequestFilters) {
  return useQuery({
    queryKey: requestKeys.list(filters),
    queryFn: () =>
      unwrap(
        api.GET("/v1/route-requests", {
          params: {
            query: {
              limit: REQUESTS_PAGE_SIZE,
              status: filters.status ?? undefined,
              kind: filters.kind ?? undefined,
              open: filters.open ?? undefined,
              // An empty value in the address means no filter.
              route_id: filters.routeId || undefined,
              from_area_id: filters.fromAreaId || undefined,
              from_area_name: filters.fromAreaName || undefined,
              to_area_id: filters.toAreaId || undefined,
              to_area_name: filters.toAreaName || undefined,
              cursor: filters.cursor || undefined,
            },
          },
        }),
      ),
  });
}

/** One route request (`route_requests_get`); off while `id` is null. */
export function useRouteRequest(id: string | null) {
  return useQuery({
    queryKey: requestKeys.detail(id ?? ""),
    queryFn: () =>
      unwrap(
        api.GET("/v1/route-requests/{request_id}", {
          params: { path: { request_id: id ?? "" } },
        }),
      ),
    enabled: id !== null,
  });
}

/**
 * For the request pickers: routes of one type whose code starts with `q`, in the given statuses
 * (all when omitted). The list filters one status at a time, so several are asked for side by side
 * and merged by code.
 */
export function routeSearch(routeType: RouteType, statuses?: RouteStatus[]) {
  return async (
    q: string,
  ): Promise<PickerResult<{ id: string; name: string }>> => {
    const pages = await Promise.all(
      (statuses ?? [undefined]).map((status) =>
        unwrap(
          api.GET("/v1/routes", {
            params: {
              query: {
                limit: PICKER_LIMIT,
                q: q.trim() || undefined,
                route_type: routeType,
                status,
              },
            },
          }),
        ),
      ),
    );
    const items = pages
      .flatMap((page) => page.items)
      .sort((a, b) => a.code.localeCompare(b.code))
      .slice(0, PICKER_LIMIT)
      .map(({ id, code }) => ({ id, name: code }));
    const found = pages.reduce((count, page) => count + page.items.length, 0);
    return {
      items,
      hasMore:
        found > PICKER_LIMIT || pages.some((page) => page.next_cursor !== null),
    };
  };
}

/**
 * After a change: every request query. After a 404 on one request (deleted meanwhile), everything
 * but that request's detail, which the open form shows; it refetches when the form closes
 * (`refetchRequest`).
 */
function refetchRequests(
  queryClient: ReturnType<typeof useQueryClient>,
  exceptId?: string,
) {
  // The open count in the sidebar and on the overview.
  void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
  return queryClient.invalidateQueries({
    queryKey: requestKeys.all,
    predicate: ({ queryKey }) =>
      exceptId === undefined || queryKey[2] !== exceptId,
  });
}

export function refetchRequest(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  void queryClient.invalidateQueries({ queryKey: requestKeys.detail(id) });
}

/** `route_requests_create` (a `new` request); the caller keeps one Idempotency-Key per record. */
export function useCreateRouteRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      request,
      idempotencyKey,
    }: {
      request: RouteRequestCreate;
      idempotencyKey: string;
    }) =>
      unwrap(
        api.POST("/v1/route-requests", {
          params: { header: { "Idempotency-Key": idempotencyKey } },
          body: request,
        }),
      ),
    onSuccess: (added) => {
      queryClient.setQueryData(requestKeys.detail(added.id), added);
      return refetchRequests(queryClient, added.id);
    },
  });
}

/** `route_requests_update`: who and when, only what changes. */
export function useUpdateRouteRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: RouteRequestUpdate }) =>
      unwrap(
        api.PATCH("/v1/route-requests/{request_id}", {
          params: { path: { request_id: id } },
          body: change,
        }),
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData(requestKeys.detail(saved.id), saved);
      return refetchRequests(queryClient, saved.id);
    },
    onError: (error, { id }) => {
      if (error instanceof ApiError && error.status === 404) {
        void refetchRequests(queryClient, id);
      }
    },
  });
}

/**
 * `route_requests_set_status`: match, fulfil or decline. A 409 means the request moved meanwhile:
 * it reloads, so its actions show where it is now.
 */
export function useSetRequestStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      change,
    }: {
      id: string;
      change: RouteRequestStatusSet;
    }) =>
      unwrap(
        api.PUT("/v1/route-requests/{request_id}/status", {
          params: { path: { request_id: id } },
          body: change,
        }),
      ),
    onSuccess: (moved) => {
      queryClient.setQueryData(requestKeys.detail(moved.id), moved);
      return refetchRequests(queryClient, moved.id);
    },
    onError: (error, { id }) => {
      if (!(error instanceof ApiError)) return;
      if (error.status === 409) {
        void refetchRequests(queryClient);
      } else if (error.status === 404) {
        void refetchRequests(queryClient, id);
      }
    },
  });
}

/**
 * `route_requests_delete` (admins): lists refetch; the deleted request's own detail doesn't (it
 * would only find a 404 while the screen leaves it).
 */
export function useDeleteRouteRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/v1/route-requests/{request_id}", {
          params: { path: { request_id: id } },
        }),
      ),
    onSuccess: (_, id) => refetchRequests(queryClient, id),
    onError: (error, id) => {
      if (error instanceof ApiError && error.status === 404) {
        void refetchRequests(queryClient, id);
      }
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PickerResult } from "@/components/pickers/search-picker";
import { companyKeys } from "@/features/companies/queries";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";

type RouteCreate = components["schemas"]["RouteCreate"];
type RouteUpdate = components["schemas"]["RouteUpdate"];
type RoutePricesSet = components["schemas"]["RoutePricesSet"];
export type RouteType = components["schemas"]["RouteType"];
export type RouteStatus = components["schemas"]["RouteStatus"];

export const ROUTES_PAGE_SIZE = 25;
const PICKER_LIMIT = 20;

export type RouteFilters = {
  q: string | null;
  routeType: RouteType | null;
  status: RouteStatus | null;
  corridorId: string | null;
  companyId: string | null;
  cursor: string | null;
};

export const routeKeys = {
  all: ["routes"] as const,
  list: (filters: RouteFilters) => ["routes", "list", filters] as const,
  detail: (id: string) => ["routes", "detail", id] as const,
};

/** One page of routes (`routes_list`), newest first; the filters combine (AND). */
export function useRoutes(filters: RouteFilters) {
  return useQuery({
    queryKey: routeKeys.list(filters),
    queryFn: () =>
      unwrap(
        api.GET("/v1/routes", {
          params: {
            query: {
              limit: ROUTES_PAGE_SIZE,
              // An empty value in the address means no filter.
              q: filters.q || undefined,
              route_type: filters.routeType ?? undefined,
              status: filters.status ?? undefined,
              corridor_id: filters.corridorId || undefined,
              company_id: filters.companyId || undefined,
              cursor: filters.cursor || undefined,
            },
          },
        }),
      ),
  });
}

/** One route (`routes_get`); off while `id` is null. */
export function useRoute(id: string | null) {
  return useQuery({
    queryKey: routeKeys.detail(id ?? ""),
    queryFn: () =>
      unwrap(
        api.GET("/v1/routes/{route_id}", {
          params: { path: { route_id: id ?? "" } },
        }),
      ),
    enabled: id !== null,
  });
}

/** For RoutePicker: the first routes whose code starts with `q` (shown by their code). */
export async function searchRoutes(
  q: string,
): Promise<PickerResult<{ id: string; name: string }>> {
  const page = await unwrap(
    api.GET("/v1/routes", {
      params: { query: { limit: PICKER_LIMIT, q: q.trim() || undefined } },
    }),
  );
  return {
    items: page.items.map(({ id, code }) => ({ id, name: code })),
    hasMore: page.next_cursor !== null,
  };
}

/**
 * After a change: every route query, and the companies' route lists (a corporate route shows on
 * its company). After a 404 on one route (deleted meanwhile), everything but that route's detail,
 * which the open form shows; it refetches when the form closes (`refetchRoute`).
 */
function refetchRoutes(
  queryClient: ReturnType<typeof useQueryClient>,
  exceptId?: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: routeKeys.all,
      predicate: ({ queryKey }) =>
        exceptId === undefined || queryKey[2] !== exceptId,
    }),
    queryClient.invalidateQueries({ queryKey: companyKeys.all }),
  ]);
}

export function refetchRoute(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  void queryClient.invalidateQueries({ queryKey: routeKeys.detail(id) });
}

/** `routes_create` (a draft route); the caller keeps one Idempotency-Key per add. */
export function useCreateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      route,
      idempotencyKey,
    }: {
      route: RouteCreate;
      idempotencyKey: string;
    }) =>
      unwrap(
        api.POST("/v1/routes", {
          params: { header: { "Idempotency-Key": idempotencyKey } },
          body: route,
        }),
      ),
    onSuccess: () => refetchRoutes(queryClient),
  });
}

/** `routes_update`: only what changes (the type is fixed). */
export function useUpdateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: RouteUpdate }) =>
      unwrap(
        api.PATCH("/v1/routes/{route_id}", {
          params: { path: { route_id: id } },
          body: change,
        }),
      ),
    onSuccess: () => refetchRoutes(queryClient),
    onError: (error, { id }) => {
      if (error instanceof ApiError && error.status === 404) {
        void refetchRoutes(queryClient, id);
      }
    },
  });
}

/** `routes_set_prices` (admins): all prices at once; a PUT, so no Idempotency-Key. */
export function useSetRoutePrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, prices }: { id: string; prices: RoutePricesSet }) =>
      unwrap(
        api.PUT("/v1/routes/{route_id}/prices", {
          params: { path: { route_id: id } },
          body: prices,
        }),
      ),
    // The route's status moves can change too (prices unblock "Start forming").
    onSuccess: () => refetchRoutes(queryClient),
    onError: (error, { id }) => {
      if (error instanceof ApiError && error.status === 404) {
        void refetchRoutes(queryClient, id);
      }
    },
  });
}

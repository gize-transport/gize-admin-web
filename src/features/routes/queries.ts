import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { PickerResult } from "@/components/pickers/search-picker";
import { companyKeys } from "@/features/companies/queries";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";

type RouteCreate = components["schemas"]["RouteCreate"];
type RouteUpdate = components["schemas"]["RouteUpdate"];
type RoutePricesSet = components["schemas"]["RoutePricesSet"];
type RouteStatusSet = components["schemas"]["RouteStatusSet"];
type RouteSortValue = components["schemas"]["RouteSort"];

/** The orders `routes_list` takes (GZ-081), its default first. */
export const ROUTE_SORTS = [
  "newest",
  "code",
  "morning_time",
] as const satisfies readonly RouteSortValue[];
type RouteCopy = components["schemas"]["RouteCopy"];
export type RouteType = components["schemas"]["RouteType"];
export type RouteStatus = components["schemas"]["RouteStatus"];

export const ROUTES_PAGE_SIZE = 25;
const PICKER_LIMIT = 20;

/** A status, or `ready`: the forming routes ready to launch (GZ-083), as the Overview counts them. */
export type RouteStatusFilter = RouteStatus | "ready";

export type RouteFilters = {
  q: string | null;
  routeType: RouteType | null;
  status: RouteStatusFilter | null;
  corridorId: string | null;
  companyId: string | null;
  /** The order, or null for the list's default (newest first). */
  sort: RouteSortValue | null;
  cursor: string | null;
};

export const routeKeys = {
  all: ["routes"] as const,
  list: (filters: RouteFilters) => ["routes", "list", filters] as const,
  detail: (id: string) => ["routes", "detail", id] as const,
  launchMonths: (id: string) => ["routes", "launch-months", id] as const,
  driver: (driverId: string) => ["routes", "driver", driverId] as const,
};

/** The most routes one driver's list shows (the API's page limit). */
export const DRIVER_ROUTES_LIMIT = 100;

/**
 * The routes a driver drives (`routes_list` by `driver_id`, GZ-076): any status, not deleted; the
 * same routes a 409 DRIVER_ASSIGNED counts. Under the routes' key, so changing a route's driver
 * reads it again.
 */
export function useDriverRoutes(driverId: string) {
  return useQuery({
    queryKey: routeKeys.driver(driverId),
    queryFn: () =>
      unwrap(
        api.GET("/v1/routes", {
          params: {
            query: { limit: DRIVER_ROUTES_LIMIT, driver_id: driverId },
          },
        }),
      ),
  });
}

/** One page of routes (`routes_list`), newest first or in `sort`'s order; the filters combine (AND). */
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
              // `ready` is its own filter: the API keeps it to forming routes.
              status:
                filters.status === "ready"
                  ? undefined
                  : (filters.status ?? undefined),
              ready_to_launch: filters.status === "ready" ? true : undefined,
              corridor_id: filters.corridorId || undefined,
              company_id: filters.companyId || undefined,
              sort: filters.sort ?? undefined,
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

/** One route, from the cache when fresh, else `routes_get` (e.g. before adding a van to it). */
export function fetchRoute(queryClient: QueryClient, id: string) {
  return queryClient.fetchQuery({
    queryKey: routeKeys.detail(id),
    queryFn: () =>
      unwrap(
        api.GET("/v1/routes/{route_id}", {
          params: { path: { route_id: id } },
        }),
      ),
  });
}

/** For RoutePicker: the first routes, A to Z, whose code starts with `q` (shown by their code). */
export async function searchRoutes(
  q: string,
): Promise<PickerResult<{ id: string; name: string }>> {
  const page = await unwrap(
    api.GET("/v1/routes", {
      params: {
        query: { limit: PICKER_LIMIT, q: q.trim() || undefined, sort: "code" },
      },
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

/** `routes_set_areas` (staff): the whole ordered list; a PUT, so no Idempotency-Key. */
export function useSetRouteAreas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, areaIds }: { id: string; areaIds: string[] }) =>
      unwrap(
        api.PUT("/v1/routes/{route_id}/areas", {
          params: { path: { route_id: id } },
          body: { area_ids: areaIds },
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

/**
 * `routes_set_driver` (staff): an active driver, or null for none; a PUT, so no Idempotency-Key.
 * The route comes back with its driver. Refused because the driver can't be chosen any more (422)
 * or drives another route at the same time (409): the drivers picker searches afresh.
 */
export function useSetRouteDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, driverId }: { id: string; driverId: string | null }) =>
      unwrap(
        api.PUT("/v1/routes/{route_id}/driver", {
          params: { path: { route_id: id } },
          body: { driver_id: driverId },
        }),
      ),
    onSuccess: (route) => {
      queryClient.setQueryData(routeKeys.detail(route.id), route);
      return refetchRoutes(queryClient, route.id);
    },
    onError: (error, { id }) => {
      if (!(error instanceof ApiError)) return;
      if (error.status === 404) void refetchRoutes(queryClient, id);
      if (error.status === 409 || error.status === 422) {
        void queryClient.invalidateQueries({ queryKey: ["drivers"] });
      }
    },
  });
}

/** The months a launch may name (`routes_launch_months`), with riders reserved; off until needed. */
export function useLaunchMonths(id: string, enabled: boolean) {
  return useQuery({
    queryKey: routeKeys.launchMonths(id),
    queryFn: () =>
      unwrap(
        api.GET("/v1/routes/{route_id}/launch-months", {
          params: { path: { route_id: id } },
        }),
      ),
    enabled,
    // A snapshot that changes as riders reserve: fresh each time the dialog opens.
    staleTime: 0,
  });
}

/**
 * `routes_set_status` (staff): a move, or a launch with its `launch_date`. The answer is the
 * updated route. A 409 means readiness changed meanwhile: the route (and its launch months)
 * reload, so its moves show what's possible now.
 */
export function useSetRouteStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: RouteStatusSet }) =>
      unwrap(
        api.PUT("/v1/routes/{route_id}/status", {
          params: { path: { route_id: id } },
          body: change,
        }),
      ),
    onSuccess: (route) => {
      queryClient.setQueryData(routeKeys.detail(route.id), route);
      return refetchRoutes(queryClient, route.id);
    },
    onError: (error, { id }) => {
      if (!(error instanceof ApiError)) return;
      if (error.status === 409 || error.status === 422) {
        void queryClient.invalidateQueries({ queryKey: routeKeys.detail(id) });
        void queryClient.invalidateQueries({
          queryKey: routeKeys.launchMonths(id),
        });
      } else if (error.status === 404) {
        void refetchRoutes(queryClient, id);
      }
    },
  });
}

/**
 * `routes_delete` (admins): lists and pickers refetch; the deleted route's own detail doesn't
 * (it would only find a 404 while the screen leaves it).
 */
export function useDeleteRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/v1/routes/{route_id}", {
          params: { path: { route_id: id } },
        }),
      ),
    onSuccess: (_, id) => refetchRoutes(queryClient, id),
    onError: (error, id) => {
      if (error instanceof ApiError && error.status === 404) {
        void refetchRoutes(queryClient, id);
      }
    },
  });
}

/** `routes_copy` (add a van, staff); the caller keeps one Idempotency-Key per add. */
export function useCopyRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      van,
      idempotencyKey,
    }: {
      id: string;
      van: RouteCopy;
      idempotencyKey: string;
    }) =>
      unwrap(
        api.POST("/v1/routes/{route_id}/copies", {
          params: {
            path: { route_id: id },
            header: { "Idempotency-Key": idempotencyKey },
          },
          body: van,
        }),
      ),
    // The new van opens next: shown at once from the answer, the rest reloads.
    onSuccess: (added) => {
      queryClient.setQueryData(routeKeys.detail(added.id), added);
      return refetchRoutes(queryClient, added.id);
    },
    onError: (error, { id }) => {
      if (error instanceof ApiError && error.status === 404) {
        void refetchRoutes(queryClient, id);
      }
    },
  });
}

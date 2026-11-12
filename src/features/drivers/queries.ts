import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PickerResult } from "@/components/pickers/search-picker";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";

type DriverCreate = components["schemas"]["DriverCreate"];
type DriverUpdate = components["schemas"]["DriverUpdate"];

export const DRIVERS_PAGE_SIZE = 25;
const PICKER_LIMIT = 20;

/** A driver as DriverPicker offers them: "Name · Plate", and the name alone for sentences. */
export type DriverOption = { id: string; name: string; fullName: string };

export type DriverFilters = {
  /** The start of a name or plate; it stays on the page, never in its address. */
  q: string | null;
  isActive: boolean | null;
  cursor: string | null;
};

export const driverKeys = {
  all: ["drivers"] as const,
  list: (filters: DriverFilters) => ["drivers", "list", filters] as const,
  detail: (id: string) => ["drivers", "detail", id] as const,
};

/** One page of drivers (`drivers_list`), newest first. */
export function useDrivers(filters: DriverFilters) {
  return useQuery({
    queryKey: driverKeys.list(filters),
    queryFn: () =>
      unwrap(
        api.GET("/v1/drivers", {
          params: {
            query: {
              limit: DRIVERS_PAGE_SIZE,
              q: filters.q || undefined,
              is_active: filters.isActive ?? undefined,
              cursor: filters.cursor || undefined,
            },
          },
        }),
      ),
  });
}

/** One driver (`drivers_get`), with their phone in full. */
export function useDriver(id: string) {
  return useQuery({
    queryKey: driverKeys.detail(id),
    queryFn: () =>
      unwrap(
        api.GET("/v1/drivers/{driver_id}", {
          params: { path: { driver_id: id } },
        }),
      ),
  });
}

/** For DriverPicker: the first active drivers whose name or plate starts with `q`. */
export async function searchDrivers(
  q: string,
): Promise<PickerResult<DriverOption>> {
  const page = await unwrap(
    api.GET("/v1/drivers", {
      params: {
        query: {
          limit: PICKER_LIMIT,
          is_active: true,
          q: q.trim() || undefined,
        },
      },
    }),
  );
  return {
    items: page.items.map(({ id, full_name, plate }) => ({
      id,
      name: `${full_name} · ${plate}`,
      fullName: full_name,
    })),
    hasMore: page.next_cursor !== null,
  };
}

/**
 * The driver queries except one driver's detail: after they're deleted, or when a dialog on
 * their detail got a 404 (it shows that; the detail refetches once it closes, `refetchDriver`).
 */
function refetchDriversExcept(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  return queryClient.invalidateQueries({
    queryKey: driverKeys.all,
    predicate: ({ queryKey }) => queryKey[2] !== id,
  });
}

/** A driver's detail, e.g. when a dialog that got a 404 closes. */
export function refetchDriver(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  void queryClient.invalidateQueries({ queryKey: driverKeys.detail(id) });
}

const isNotFound = (error: Error) =>
  error instanceof ApiError && error.status === 404;

/** `drivers_create`; the caller keeps one Idempotency-Key per add, reused on retry. */
export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      driver,
      idempotencyKey,
    }: {
      driver: DriverCreate;
      idempotencyKey: string;
    }) =>
      unwrap(
        api.POST("/v1/drivers", {
          params: { header: { "Idempotency-Key": idempotencyKey } },
          body: driver,
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: driverKeys.all }),
  });
}

/** `drivers_update`: only what changes (also `is_active` to deactivate or reactivate). */
export function useUpdateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: DriverUpdate }) =>
      unwrap(
        api.PATCH("/v1/drivers/{driver_id}", {
          params: { path: { driver_id: id } },
          body: change,
        }),
      ),
    // Routes show their driver's name and plate.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: driverKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["routes"] }),
      ]),
    onError: (error, { id }) => {
      if (isNotFound(error)) void refetchDriversExcept(queryClient, id);
    },
  });
}

/**
 * `drivers_delete` (admins; the API refuses others, and drivers who drive a route). The lists
 * refetch; the deleted driver's own detail doesn't (it would only find a 404 as the screen leaves).
 */
export function useDeleteDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/v1/drivers/{driver_id}", {
          params: { path: { driver_id: id } },
        }),
      ),
    onSuccess: (_, id) => refetchDriversExcept(queryClient, id),
    onError: (error, id) => {
      if (isNotFound(error)) void refetchDriversExcept(queryClient, id);
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";

type RiderCreate = components["schemas"]["RiderCreate"];
type RiderUpdate = components["schemas"]["RiderUpdate"];
export type RiderType =
  components["schemas"]["gize_api__riders__models__RiderType"];
export type SeatState = components["schemas"]["SeatState"];
export type RiderPlan = components["schemas"]["RiderPlan"];

export const RIDERS_PAGE_SIZE = 25;

export type RiderFilters = {
  /** The start of a name. Typed on the page, never kept in its URL (personal data). */
  name: string | null;
  riderType: RiderType | null;
  seat: SeatState | null;
  routeId: string | null;
  cursor: string | null;
};

export const riderKeys = {
  all: ["riders"] as const,
  list: (filters: RiderFilters) => ["riders", "list", filters] as const,
  detail: (id: string) => ["riders", "detail", id] as const,
  // Only in the query cache (memory), never in a URL or a log.
  byPhone: (phone: string) => ["riders", "by-phone", phone] as const,
};

/** One page of riders (`riders_list`), newest first; the filters combine (AND). */
export function useRiders(filters: RiderFilters, enabled = true) {
  return useQuery({
    queryKey: riderKeys.list(filters),
    queryFn: () =>
      unwrap(
        api.GET("/v1/riders", {
          params: {
            query: {
              limit: RIDERS_PAGE_SIZE,
              q: filters.name || undefined,
              rider_type: filters.riderType ?? undefined,
              seat: filters.seat ?? undefined,
              // An empty value in the address means no filter.
              route_id: filters.routeId || undefined,
              cursor: filters.cursor || undefined,
            },
          },
        }),
      ),
    enabled,
  });
}

/**
 * Live riders with this phone (`riders_lookup`): a POST, so the number stays out of URLs and
 * logs. Off while `phone` is null.
 */
export function useRidersByPhone(phone: string | null) {
  return useQuery({
    queryKey: riderKeys.byPhone(phone ?? ""),
    queryFn: () => findRidersByPhone(phone ?? ""),
    enabled: phone !== null,
  });
}

export function findRidersByPhone(phone: string) {
  return unwrap(api.POST("/v1/riders/lookup", { body: { phone } }));
}

/** One rider (`riders_get`), with the phone in full; off while `id` is null. */
export function useRider(id: string | null) {
  return useQuery({
    queryKey: riderKeys.detail(id ?? ""),
    queryFn: () =>
      unwrap(
        api.GET("/v1/riders/{rider_id}", {
          params: { path: { rider_id: id ?? "" } },
        }),
      ),
    enabled: id !== null,
  });
}

/**
 * After a change: every rider query. After a 404 on one rider (deleted meanwhile), everything but
 * that rider's detail, which the open form shows; it refetches when the form closes
 * (`refetchRider`).
 */
function refetchRiders(
  queryClient: ReturnType<typeof useQueryClient>,
  exceptId?: string,
) {
  return queryClient.invalidateQueries({
    queryKey: riderKeys.all,
    predicate: ({ queryKey }) =>
      exceptId === undefined ||
      !(queryKey[1] === "detail" && queryKey[2] === exceptId),
  });
}

export function refetchRider(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  void queryClient.invalidateQueries({ queryKey: riderKeys.detail(id) });
}

/** `riders_create` (an adult from a phone call, or a company rider); one Idempotency-Key per record. */
export function useCreateRider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      rider,
      idempotencyKey,
    }: {
      rider: RiderCreate;
      idempotencyKey: string;
    }) =>
      unwrap(
        api.POST("/v1/riders", {
          params: { header: { "Idempotency-Key": idempotencyKey } },
          body: rider,
        }),
      ),
    onSuccess: (added) => {
      queryClient.setQueryData(riderKeys.detail(added.id), added);
      return refetchRiders(queryClient, added.id);
    },
  });
}

/** `riders_update`: only what changes. */
export function useUpdateRider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: RiderUpdate }) =>
      unwrap(
        api.PATCH("/v1/riders/{rider_id}", {
          params: { path: { rider_id: id } },
          body: change,
        }),
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData(riderKeys.detail(saved.id), saved);
      return refetchRiders(queryClient, saved.id);
    },
    onError: (error, { id }) => {
      if (error instanceof ApiError && error.status === 404) {
        void refetchRiders(queryClient, id);
      }
    },
  });
}

/**
 * `riders_delete` (admins). Lists refetch; the deleted rider's own detail doesn't (it would only
 * find a 404 while the screen leaves it). A 409 (they hold a seat now) reloads the rider.
 */
export function useDeleteRider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/v1/riders/{rider_id}", {
          params: { path: { rider_id: id } },
        }),
      ),
    onSuccess: (_, id) => refetchRiders(queryClient, id),
    onError: (error, id) => {
      if (!(error instanceof ApiError)) return;
      if (error.status === 404) void refetchRiders(queryClient, id);
      else if (error.status === 409) void refetchRiders(queryClient);
    },
  });
}

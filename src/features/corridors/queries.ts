import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";

type CorridorUpdate = components["schemas"]["CorridorUpdate"];
type NameSortValue = components["schemas"]["NameSort"];

/** The orders `corridors_list` takes (GZ-081), its default first. */
export const CORRIDOR_SORTS = [
  "newest",
  "name",
] as const satisfies readonly NameSortValue[];

export const CORRIDORS_PAGE_SIZE = 25;

export type CorridorFilters = {
  originAreaId: string | null;
  destinationAreaId: string | null;
  /** The order, or null for the list's default (newest first). */
  sort: NameSortValue | null;
  cursor: string | null;
};

export const corridorKeys = {
  all: ["corridors"] as const,
  list: (filters: CorridorFilters) => ["corridors", "list", filters] as const,
  detail: (id: string) => ["corridors", "detail", id] as const,
  between: (originAreaId: string, destinationAreaId: string) =>
    ["corridors", "between", originAreaId, destinationAreaId] as const,
};

/** One corridor (`corridors_get`), e.g. to name a corridor whose id is in the URL. */
export function useCorridor(id: string | null) {
  return useQuery({
    queryKey: corridorKeys.detail(id ?? ""),
    queryFn: () =>
      unwrap(
        api.GET("/v1/corridors/{corridor_id}", {
          params: { path: { corridor_id: id ?? "" } },
        }),
      ),
    enabled: id !== null,
  });
}

/**
 * The corridor from one area to the other (`corridors_list` filtered by both: a pair has at most
 * one), or null when there is none yet. Cached like any query, under "corridors".
 */
export function fetchCorridorBetween(
  queryClient: QueryClient,
  originAreaId: string,
  destinationAreaId: string,
) {
  return queryClient.fetchQuery({
    queryKey: corridorKeys.between(originAreaId, destinationAreaId),
    queryFn: async () => {
      const page = await unwrap(
        api.GET("/v1/corridors", {
          params: {
            query: {
              limit: 1,
              origin_area_id: originAreaId,
              destination_area_id: destinationAreaId,
            },
          },
        }),
      );
      const [corridor] = page.items;
      return corridor ?? null;
    },
    staleTime: 30_000,
  });
}

/** One page of corridors (`corridors_list`), newest first or in `sort`'s order; both filters together (AND). */
export function useCorridors(filters: CorridorFilters) {
  return useQuery({
    queryKey: corridorKeys.list(filters),
    queryFn: () =>
      unwrap(
        api.GET("/v1/corridors", {
          params: {
            query: {
              limit: CORRIDORS_PAGE_SIZE,
              // An empty value in the address means no filter.
              origin_area_id: filters.originAreaId || undefined,
              destination_area_id: filters.destinationAreaId || undefined,
              sort: filters.sort ?? undefined,
              cursor: filters.cursor || undefined,
            },
          },
        }),
      ),
  });
}

/** After a change, or a 404 (someone else deleted the corridor): refetch every corridor list. */
function refetchCorridorsAfter(queryClient: ReturnType<typeof useQueryClient>) {
  return {
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: corridorKeys.all }),
    onError: (error: Error) => {
      if (error instanceof ApiError && error.status === 404) {
        void queryClient.invalidateQueries({ queryKey: corridorKeys.all });
      }
    },
  };
}

/** `corridors_create`; the caller keeps one Idempotency-Key per add, reused on retry. */
export function useCreateCorridor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      originAreaId,
      destinationAreaId,
      idempotencyKey,
    }: {
      originAreaId: string;
      destinationAreaId: string;
      idempotencyKey: string;
    }) =>
      unwrap(
        api.POST("/v1/corridors", {
          params: { header: { "Idempotency-Key": idempotencyKey } },
          body: {
            origin_area_id: originAreaId,
            destination_area_id: destinationAreaId,
          },
        }),
      ),
    ...refetchCorridorsAfter(queryClient),
  });
}

/** `corridors_update`: send only the end that changes (an end left out stays). */
export function useUpdateCorridor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: CorridorUpdate }) =>
      unwrap(
        api.PATCH("/v1/corridors/{corridor_id}", {
          params: { path: { corridor_id: id } },
          body: change,
        }),
      ),
    ...refetchCorridorsAfter(queryClient),
    // Routes show their corridor's areas (literal key: features/routes reaches here).
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: corridorKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["routes"] }),
      ]),
  });
}

/** `corridors_delete` (admins; the API refuses others and corridors a route runs on). */
export function useDeleteCorridor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/v1/corridors/{corridor_id}", {
          params: { path: { corridor_id: id } },
        }),
      ),
    ...refetchCorridorsAfter(queryClient),
  });
}

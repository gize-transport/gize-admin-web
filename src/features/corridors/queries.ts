import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";

type CorridorUpdate = components["schemas"]["CorridorUpdate"];

export const CORRIDORS_PAGE_SIZE = 25;

export type CorridorFilters = {
  originAreaId: string | null;
  destinationAreaId: string | null;
  cursor: string | null;
};

export const corridorKeys = {
  all: ["corridors"] as const,
  list: (filters: CorridorFilters) => ["corridors", "list", filters] as const,
};

/** One page of corridors (`corridors_list`), newest first; both filters together (AND). */
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

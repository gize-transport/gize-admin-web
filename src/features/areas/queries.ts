import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { corridorKeys } from "@/features/corridors/queries";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";

type AreaRef = components["schemas"]["AreaRef"];

/** What a picker search returns: the first matches, and whether more areas match. */
export type AreaSearchResult = { items: AreaRef[]; hasMore: boolean };

const PICKER_LIMIT = 20;

export const AREAS_PAGE_SIZE = 25;

export const areaKeys = {
  all: ["areas"] as const,
  list: (params: { q: string | null; cursor: string | null }) =>
    ["areas", "list", params] as const,
  detail: (id: string) => ["areas", "detail", id] as const,
};

/** One page of areas (`areas_list`): `q` matches the start of a name, newest first. */
export function useAreas({
  q,
  cursor,
}: {
  q: string | null;
  cursor: string | null;
}) {
  return useQuery({
    queryKey: areaKeys.list({ q, cursor }),
    queryFn: () =>
      unwrap(
        api.GET("/v1/areas", {
          params: {
            query: {
              limit: AREAS_PAGE_SIZE,
              // An empty `?q=` or `?cursor=` in the address means none.
              q: q || undefined,
              cursor: cursor || undefined,
            },
          },
        }),
      ),
  });
}

/** One area (`areas_get`), e.g. to name an area whose id is in the URL; off while `id` is null. */
export function useArea(id: string | null) {
  return useQuery({
    queryKey: areaKeys.detail(id ?? ""),
    queryFn: () =>
      unwrap(
        api.GET("/v1/areas/{area_id}", {
          params: { path: { area_id: id ?? "" } },
        }),
      ),
    enabled: id !== null,
  });
}

/** For pickers: the first areas whose name starts with `q` (all areas when it's empty). */
export async function searchAreas(q: string): Promise<AreaSearchResult> {
  const page = await unwrap(
    api.GET("/v1/areas", {
      params: { query: { limit: PICKER_LIMIT, q: q.trim() || undefined } },
    }),
  );
  return {
    items: page.items.map(({ id, name }) => ({ id, name })),
    hasMore: page.next_cursor !== null,
  };
}

/** After a change, or a 404 (someone else deleted the area): refetch every area list. */
function refetchAreasAfter(queryClient: ReturnType<typeof useQueryClient>) {
  return {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: areaKeys.all }),
    onError: (error: Error) => {
      if (error instanceof ApiError && error.status === 404) {
        void queryClient.invalidateQueries({ queryKey: areaKeys.all });
      }
    },
  };
}

/** `areas_create`; the caller keeps one Idempotency-Key per add, reused on retry. */
export function useCreateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      idempotencyKey,
    }: {
      name: string;
      idempotencyKey: string;
    }) =>
      unwrap(
        api.POST("/v1/areas", {
          params: { header: { "Idempotency-Key": idempotencyKey } },
          body: { name },
        }),
      ),
    ...refetchAreasAfter(queryClient),
  });
}

/** `areas_update` (rename). Corridors show their areas' names, so their lists refetch too. */
export function useRenameArea() {
  const queryClient = useQueryClient();
  const refetch = refetchAreasAfter(queryClient);
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      unwrap(
        api.PATCH("/v1/areas/{area_id}", {
          params: { path: { area_id: id } },
          body: { name },
        }),
      ),
    onSuccess: () =>
      Promise.all([
        refetch.onSuccess(),
        queryClient.invalidateQueries({ queryKey: corridorKeys.all }),
      ]),
    onError: refetch.onError,
  });
}

/** `areas_delete` (admins; the API refuses others and areas in use). */
export function useDeleteArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/v1/areas/{area_id}", {
          params: { path: { area_id: id } },
        }),
      ),
    ...refetchAreasAfter(queryClient),
  });
}

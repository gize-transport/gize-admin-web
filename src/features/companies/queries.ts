import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PickerResult } from "@/components/pickers/search-picker";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";

type CompanyRef = components["schemas"]["CompanyRef"];
type CompanyCreate = components["schemas"]["CompanyCreate"];
type CompanyUpdate = components["schemas"]["CompanyUpdate"];

export const COMPANIES_PAGE_SIZE = 25;
const PICKER_LIMIT = 20;
/** A company's routes on its detail: one page, enough for any company Gize serves. */
const COMPANY_ROUTES_LIMIT = 100;

export type CompanyFilters = {
  q: string | null;
  /** "true" / "false" from the URL; anything else is no filter. */
  isActive: boolean | null;
  cursor: string | null;
};

export const companyKeys = {
  all: ["companies"] as const,
  list: (filters: CompanyFilters) => ["companies", "list", filters] as const,
  detail: (id: string) => ["companies", "detail", id] as const,
  routes: (id: string) => ["companies", "routes", id] as const,
};

/** One page of companies (`companies_list`), newest first. */
export function useCompanies(filters: CompanyFilters) {
  return useQuery({
    queryKey: companyKeys.list(filters),
    queryFn: () =>
      unwrap(
        api.GET("/v1/companies", {
          params: {
            query: {
              limit: COMPANIES_PAGE_SIZE,
              // An empty value in the address means no filter.
              q: filters.q || undefined,
              is_active: filters.isActive ?? undefined,
              cursor: filters.cursor || undefined,
            },
          },
        }),
      ),
  });
}

/** One company (`companies_get`); off while `id` is null. */
export function useCompany(id: string | null) {
  return useQuery({
    queryKey: companyKeys.detail(id ?? ""),
    queryFn: () =>
      unwrap(
        api.GET("/v1/companies/{company_id}", {
          params: { path: { company_id: id ?? "" } },
        }),
      ),
    enabled: id !== null,
  });
}

/** The company's routes (`routes_list?company_id=`), for its detail. */
export function useCompanyRoutes(id: string) {
  return useQuery({
    queryKey: companyKeys.routes(id),
    queryFn: () =>
      unwrap(
        api.GET("/v1/routes", {
          params: { query: { company_id: id, limit: COMPANY_ROUTES_LIMIT } },
        }),
      ),
  });
}

/** For CompanyPicker: the first companies whose name starts with `q` (active ones only, or all). */
export async function searchCompanies(
  q: string,
  { activeOnly }: { activeOnly: boolean },
): Promise<PickerResult<CompanyRef>> {
  const page = await unwrap(
    api.GET("/v1/companies", {
      params: {
        query: {
          limit: PICKER_LIMIT,
          is_active: activeOnly ? true : undefined,
          q: q.trim() || undefined,
        },
      },
    }),
  );
  return {
    items: page.items.map(({ id, name }) => ({ id, name })),
    hasMore: page.next_cursor !== null,
  };
}

/**
 * Refetch the company queries, except one company's detail and routes: after it is deleted, or
 * when a dialog on its detail got a 404 (the dialog shows that; its detail refetches once the
 * dialog closes, see `refetchCompany`).
 */
function refetchCompaniesExcept(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  return queryClient.invalidateQueries({
    queryKey: companyKeys.all,
    predicate: ({ queryKey }) => queryKey[2] !== id,
  });
}

/** A company's detail and routes, e.g. when a dialog that got a 404 closes. */
export function refetchCompany(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  void queryClient.invalidateQueries({ queryKey: companyKeys.detail(id) });
  void queryClient.invalidateQueries({ queryKey: companyKeys.routes(id) });
}

const isNotFound = (error: Error) =>
  error instanceof ApiError && error.status === 404;

/** `companies_create`; the caller keeps one Idempotency-Key per add, reused on retry. */
export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      company,
      idempotencyKey,
    }: {
      company: CompanyCreate;
      idempotencyKey: string;
    }) =>
      unwrap(
        api.POST("/v1/companies", {
          params: { header: { "Idempotency-Key": idempotencyKey } },
          body: company,
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: companyKeys.all }),
  });
}

/** `companies_update`: only what changes (also `is_active` to deactivate or reactivate). */
export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: CompanyUpdate }) =>
      unwrap(
        api.PATCH("/v1/companies/{company_id}", {
          params: { path: { company_id: id } },
          body: change,
        }),
      ),
    // Routes show their company's name (by the literal key: features/routes imports from here).
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: companyKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["routes"] }),
      ]),
    onError: (error, { id }) => {
      if (isNotFound(error)) void refetchCompaniesExcept(queryClient, id);
    },
  });
}

/**
 * `companies_delete` (admins; the API refuses others and companies with a route). The lists and
 * pickers refetch; the deleted company's own detail doesn't (it would only find a 404 while the
 * screen leaves it).
 */
export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/v1/companies/{company_id}", {
          params: { path: { company_id: id } },
        }),
      ),
    onSuccess: (_, id) => refetchCompaniesExcept(queryClient, id),
    onError: (error, id) => {
      if (isNotFound(error)) void refetchCompaniesExcept(queryClient, id);
    },
  });
}

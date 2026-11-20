import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";

export const AUDIT_PAGE_SIZE = 25;

export type AuditFilters = {
  /** A record: its type and ID together, or neither (the API refuses one alone). */
  entity: { type: string; id: string } | null;
  actorId: string | null;
  cursor: string | null;
};

export const auditKeys = {
  all: ["audit-log"] as const,
  list: (filters: AuditFilters) => ["audit-log", "list", filters] as const,
};

/** One page of the audit log (`audit_log_list`, admins), newest first; the filters combine. */
export function useAuditLog(filters: AuditFilters) {
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () =>
      unwrap(
        api.GET("/v1/audit-log", {
          params: {
            query: {
              limit: AUDIT_PAGE_SIZE,
              entity_type: filters.entity?.type,
              entity_id: filters.entity?.id,
              actor_staff_id: filters.actorId ?? undefined,
              cursor: filters.cursor || undefined,
            },
          },
        }),
      ),
    // A log of changes made elsewhere: fresh each time it's opened.
    staleTime: 0,
  });
}

/** Staff members for the "Done by" filter (the first 100 A to Z, deactivated ones included). */
export function useAuditActors() {
  return useQuery({
    queryKey: ["staff", "audit-actors"],
    queryFn: () =>
      unwrap(
        api.GET("/v1/staff", {
          params: { query: { limit: 100, sort: "name" } },
        }),
      ),
  });
}

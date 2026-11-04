import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";

type StaffInvite = components["schemas"]["StaffInvite"];
type StaffUpdate = components["schemas"]["StaffUpdate"];
export type StaffRole = components["schemas"]["StaffRole"];

export const STAFF_PAGE_SIZE = 25;

export type StaffFilters = {
  role: StaffRole | null;
  isActive: boolean | null;
  cursor: string | null;
};

/** Under "staff", like the signed-in member (`["staff", "me"]`): a change refreshes that too. */
export const staffKeys = {
  all: ["staff"] as const,
  list: (filters: StaffFilters) => ["staff", "list", filters] as const,
  detail: (id: string) => ["staff", "detail", id] as const,
  byEmail: (email: string) => ["staff", "by-email", email] as const,
};

/** One page of staff members (`staff_list`, admins), newest first; the filters combine (AND). */
export function useStaffMembers(filters: StaffFilters) {
  return useQuery({
    queryKey: staffKeys.list(filters),
    queryFn: () =>
      unwrap(
        api.GET("/v1/staff", {
          params: {
            query: {
              limit: STAFF_PAGE_SIZE,
              role: filters.role ?? undefined,
              is_active: filters.isActive ?? undefined,
              cursor: filters.cursor || undefined,
            },
          },
        }),
      ),
  });
}

/** One staff member (`staff_get`); off while `id` is null. */
export function useStaffMember(id: string | null) {
  return useQuery({
    queryKey: staffKeys.detail(id ?? ""),
    queryFn: () =>
      unwrap(
        api.GET("/v1/staff/{staff_id}", {
          params: { path: { staff_id: id ?? "" } },
        }),
      ),
    enabled: id !== null,
  });
}

/**
 * The member with this email (lower case), active or not, or null: the list has no email search,
 * so its pages (100 at a time, at most 20) are read until it shows. For an invite refused as
 * STAFF_EMAIL_TAKEN. Off while `email` is null.
 */
export function useStaffByEmail(email: string | null) {
  return useQuery({
    queryKey: staffKeys.byEmail(email ?? ""),
    queryFn: async () => {
      let cursor: string | undefined;
      for (let page = 0; page < 20; page += 1) {
        const result = await unwrap(
          api.GET("/v1/staff", { params: { query: { limit: 100, cursor } } }),
        );
        const found = result.items.find((member) => member.email === email);
        if (found) return found;
        if (result.next_cursor === null) return null;
        cursor = result.next_cursor;
      }
      return null;
    },
    enabled: email !== null,
    staleTime: 0,
  });
}

/** After a change: every staff query (lists, details, and the signed-in member's own role). */
function refetchStaff(
  queryClient: ReturnType<typeof useQueryClient>,
  exceptId?: string,
) {
  return queryClient.invalidateQueries({
    queryKey: staffKeys.all,
    predicate: ({ queryKey }) =>
      exceptId === undefined || queryKey[2] !== exceptId,
  });
}

export function refetchStaffMember(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  void queryClient.invalidateQueries({ queryKey: staffKeys.detail(id) });
}

/** `staff_invite` (admins): Supabase emails a link; the caller keeps one Idempotency-Key per invite. */
export function useInviteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      invite,
      idempotencyKey,
    }: {
      invite: StaffInvite;
      idempotencyKey: string;
    }) =>
      unwrap(
        api.POST("/v1/staff", {
          params: { header: { "Idempotency-Key": idempotencyKey } },
          body: invite,
        }),
      ),
    onSuccess: (member) => {
      queryClient.setQueryData(staffKeys.detail(member.id), member);
      return refetchStaff(queryClient, member.id);
    },
  });
}

/** `staff_update` (admins): name, role and/or status, only what changes. */
export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: StaffUpdate }) =>
      unwrap(
        api.PATCH("/v1/staff/{staff_id}", {
          params: { path: { staff_id: id } },
          body: change,
        }),
      ),
    onSuccess: (member) => {
      queryClient.setQueryData(staffKeys.detail(member.id), member);
      return refetchStaff(queryClient, member.id);
    },
    onError: (error, { id }) => {
      if (!(error instanceof ApiError)) return;
      // Refused (the last admin) or gone: show the member as they are now.
      if (error.status === 409) refetchStaffMember(queryClient, id);
      else if (error.status === 404) void refetchStaff(queryClient, id);
    },
  });
}

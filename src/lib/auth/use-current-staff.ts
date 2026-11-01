import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";

export const currentStaffQueryKey = ["staff", "me"] as const;

/**
 * The signed-in staff member and their role (`staff_me`). The role only decides what the UI
 * shows; the API enforces every permission. A 401 is handled by the query client (sign-in);
 * a 403 means the person isn't (active) staff and must be signed out (see `useSignOut`).
 */
export function useCurrentStaff() {
  return useQuery({
    queryKey: currentStaffQueryKey,
    queryFn: () => unwrap(api.GET("/v1/staff/me")),
    staleTime: 5 * 60_000,
  });
}

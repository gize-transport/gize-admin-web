import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { SIGN_IN_PATH } from "./paths";
import { getSupabaseBrowserClient } from "./supabase-browser";

/** Why the sign-in page is shown after signing out (`?reason=`); never personal data. */
export type SignOutReason = "signed_out" | "not_staff";

/**
 * Signs out this browser: ends its Supabase session (revoked on the server; removed here even if
 * Supabase can't be reached), drops all cached API data so the next person sees none of it, and
 * opens sign-in. Sessions on the person's other devices stay signed in.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useCallback(
    async (reason: SignOutReason = "signed_out") => {
      // auth-js removes the local session even when the server call fails.
      await getSupabaseBrowserClient()
        .auth.signOut({ scope: "local" })
        .catch(() => {});
      queryClient.clear();
      router.replace(`${SIGN_IN_PATH}?reason=${reason}`);
      router.refresh();
    },
    [queryClient, router],
  );
}

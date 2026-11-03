"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { createQueryClient } from "@/lib/api/query-client";
import { isSignInPath, signInHref } from "@/lib/auth/paths";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

/**
 * On a 401 from the API: ends this browser's session, drops cached data and goes to sign-in,
 * once even when several queries fail at once. Signing out first matters: if Supabase still
 * thinks the session is valid while the API rejects its token, the middleware would otherwise
 * send the person straight back from sign-in.
 */
function createSignInRedirect(
  navigate: (href: string) => void,
  clearCache: () => void,
) {
  let pending = false;
  return {
    async trigger() {
      const href = signInHref(window.location);
      if (pending || href === null) return;
      pending = true;
      await getSupabaseBrowserClient()
        .auth.signOut({ scope: "local" })
        .catch(() => {});
      clearCache();
      navigate(href);
    },
    /** Back on a portal page after signing in: a later expiry must redirect again. */
    reset() {
      pending = false;
    },
  };
}

/** TanStack Query for the client components below it (one client per browser tab). */
export function QueryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [{ client, signIn }] = useState(() => {
    let client: ReturnType<typeof createQueryClient> | undefined = undefined;
    const signIn = createSignInRedirect(
      (href) => router.replace(href),
      () => client?.clear(),
    );
    client = createQueryClient({
      onUnauthenticated: () => void signIn.trigger(),
    });
    return { client, signIn };
  });

  return (
    <QueryClientProvider client={client}>
      {/* Reads the URL: on pages with an id in it, that's only known at request time. */}
      <Suspense fallback={null}>
        <ResetOffSignIn signIn={signIn} />
      </Suspense>
      {children}
    </QueryClientProvider>
  );
}

/** Back on a portal page after signing in, a later expiry must redirect again. */
function ResetOffSignIn({ signIn }: { signIn: { reset: () => void } }) {
  const pathname = usePathname();
  useEffect(() => {
    if (!isSignInPath(pathname)) signIn.reset();
  }, [pathname, signIn]);
  return null;
}

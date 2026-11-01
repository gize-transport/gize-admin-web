"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createQueryClient } from "@/lib/api/query-client";

/** Sign-in page (GZW-010). `next` is a path on this site only, never a token. */
export const SIGN_IN_PATH = "/sign-in";

function isSignInPath(pathname: string) {
  return pathname === SIGN_IN_PATH || pathname.startsWith(`${SIGN_IN_PATH}/`);
}

/**
 * `/sign-in?next=<current path and query>`, or null when already there. GZW-010 must only
 * follow a `next` that starts with a single "/" (not "//" or "/\"), so it can't leave the site.
 */
export function signInHref({
  pathname,
  search,
}: {
  pathname: string;
  search: string;
}) {
  if (isSignInPath(pathname)) return null;
  return `${SIGN_IN_PATH}?next=${encodeURIComponent(`${pathname}${search}`)}`;
}

/** Goes to sign-in once per expiry, even when several queries fail with 401 at once. */
function createSignInRedirect(navigate: (href: string) => void) {
  let pending = false;
  return {
    trigger() {
      const href = signInHref(window.location);
      if (pending || href === null) return;
      pending = true;
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
  const pathname = usePathname();
  const [{ client, signIn }] = useState(() => {
    const signIn = createSignInRedirect((href) => router.replace(href));
    return {
      client: createQueryClient({ onUnauthenticated: signIn.trigger }),
      signIn,
    };
  });

  useEffect(() => {
    if (!isSignInPath(pathname)) signIn.reset();
  }, [pathname, signIn]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

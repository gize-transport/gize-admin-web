// Where signed-out people go and where they come back to. Used by the middleware, the sign-in
// form and the query client's 401 handling.

export const SIGN_IN_PATH = "/sign-in";

export function isSignInPath(pathname: string) {
  return pathname === SIGN_IN_PATH || pathname.startsWith(`${SIGN_IN_PATH}/`);
}

/** Pages that work without a session: sign-in, and the dev gallery (a 404 in deployed builds). */
export function isPublicPath(pathname: string) {
  return isSignInPath(pathname) || pathname.startsWith("/dev/");
}

/** `/sign-in?next=<path and query>` (just `/sign-in` from home), or null when already there. */
export function signInHref({
  pathname,
  search,
}: {
  pathname: string;
  search: string;
}) {
  if (isSignInPath(pathname)) return null;
  const next = `${pathname}${search}`;
  return next === "/"
    ? SIGN_IN_PATH
    : `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`;
}

/**
 * Where to go after signing in: `next` only when it is a path on this site (a single leading
 * "/", no "//" or "/\", no control characters, not the sign-in page), otherwise home. Stops a
 * crafted link from sending staff to another site.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\") ||
    /[\u0000-\u001f\u007f]/.test(next)
  ) {
    return "/";
  }
  const pathname = next.split(/[?#]/)[0] ?? "";
  return isSignInPath(pathname) ? "/" : next;
}

/**
 * Where the middleware sends a request, or null to let it through: signed-out people to
 * sign-in (remembering where they were going), signed-in people away from sign-in.
 */
export function sessionRedirect({
  pathname,
  search,
  signedIn,
  next,
}: {
  pathname: string;
  search: string;
  signedIn: boolean;
  next: string | null;
}): string | null {
  if (!signedIn) {
    return isPublicPath(pathname) ? null : signInHref({ pathname, search });
  }
  return isSignInPath(pathname) ? safeNextPath(next) : null;
}

// Where signed-out people go and where they come back to. Used by the middleware, the sign-in
// form and the query client's 401 handling.

export const SIGN_IN_PATH = "/sign-in";

export function isSignInPath(pathname: string) {
  return pathname === SIGN_IN_PATH || pathname.startsWith(`${SIGN_IN_PATH}/`);
}

export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const SET_PASSWORD_PATH = "/set-password";
/**
 * Where an invitation or reset email's link lands (GZW-012): a page with a Continue button,
 * so a mail scanner that opens the link doesn't use it up.
 */
export const EMAIL_LINK_PATH = "/auth/confirm";
/** Where that button posts: checks the link with Supabase, which signs the person in. */
export const EMAIL_VERIFY_PATH = "/auth/verify";

/**
 * Pages that work without a session: sign-in, asking for a reset link, an email link's page and
 * its check (which signs the person in), and the dev gallery (a 404 in deployed builds).
 * Setting a password needs the session the email link started.
 */
export function isPublicPath(pathname: string) {
  return (
    isSignInPath(pathname) ||
    pathname === FORGOT_PASSWORD_PATH ||
    pathname === EMAIL_LINK_PATH ||
    pathname === EMAIL_VERIFY_PATH ||
    pathname.startsWith("/dev/")
  );
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

// The portal's Content Security Policy (engineering-standards.md, "Security"): the session sits
// in cookies the browser can read, so no script we don't write may run. Scripts need the
// request's nonce ('strict-dynamic' lets them load our own chunks); the page may only talk to
// itself, the API, Supabase and Sentry; nothing may frame it.

type CspSources = {
  nonce: string;
  apiBaseUrl: string;
  supabaseUrl: string;
  sentryDsn: string | undefined;
  /** `next dev` evaluates code (React's debugging), which production never does. */
  development: boolean;
  /** The page itself is on https: its http requests may be upgraded (not on local http). */
  secure: boolean;
};

/** A URL's origin (scheme, host and port; never a DSN's key, which is its user part). */
function originOf(url: string) {
  return new URL(url).origin;
}

/** A fresh, unguessable nonce for one response. */
export function createNonce() {
  return btoa(crypto.randomUUID());
}

export function contentSecurityPolicy({
  nonce,
  apiBaseUrl,
  supabaseUrl,
  sentryDsn,
  development,
  secure,
}: CspSources) {
  const connect = [
    "'self'",
    originOf(apiBaseUrl),
    originOf(supabaseUrl),
    ...(sentryDsn ? [originOf(sentryDsn)] : []),
  ];
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Components position themselves with style attributes (Radix popovers, toasts).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(secure ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

/**
 * For responses middleware doesn't see (paths it skips: static files, and a missing one's 404
 * page): nothing may run or load except the site's own images and styles, and nothing may frame
 * it. Static next.config.ts headers, so no nonce.
 */
export const STATIC_CSP =
  "default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

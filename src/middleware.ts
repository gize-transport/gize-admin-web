import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionRedirect } from "@/lib/auth/paths";
import { contentSecurityPolicy, createNonce } from "@/lib/csp";
import { env } from "@/lib/env";

// Runs before every page (architecture.md, "Auth flow"): refreshes the Supabase session cookies
// and keeps signed-out people out of the portal. It also gives each page a fresh nonce and the
// Content Security Policy that requires it (engineering-standards.md, "Security"): Next.js reads
// the policy from the request and puts the nonce on its own scripts. Kept as edge `middleware.ts` although Next 16
// renamed it `proxy.ts`: proxy only runs on Node.js, which the Cloudflare adapter (OpenNext)
// doesn't support yet. Who is staff and what they may do is decided by the API, not here.

export async function middleware(request: NextRequest) {
  const nonce = createNonce();
  const csp = contentSecurityPolicy({
    nonce,
    apiBaseUrl: env.apiBaseUrl,
    supabaseUrl: env.supabaseUrl,
    sentryDsn: env.sentryDsn,
    development: process.env.NODE_ENV === "development",
    secure: request.nextUrl.protocol === "https:",
  });
  /** On to the page, with the nonce and policy on the request (and any refreshed cookies). */
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };
  let response = next();

  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = next();
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // No CDN may cache a response that sets someone's session.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // getClaims refreshes an expired session, then verifies the access token: locally with the
  // project's asymmetric signing keys, or by asking Supabase Auth for legacy symmetric keys.
  // If Supabase can't be reached for either, the person is treated as signed out
  // (architecture.md, "Auth flow").
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname, search, searchParams } = request.nextUrl;
  const target = sessionRedirect({
    pathname,
    search,
    signedIn,
    next: searchParams.get("next"),
  });
  if (target === null) {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const redirect = NextResponse.redirect(new URL(target, request.url));
  // Keep any refreshed session cookies and cache headers on the redirect.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  redirect.headers.set("Content-Security-Policy", csp);
  for (const key of ["Cache-Control", "Expires", "Pragma"]) {
    const value = response.headers.get(key);
    if (value) redirect.headers.set(key, value);
  }
  return redirect;
}

export const config = {
  // Every page, not static files, image optimisation, icons, robots.txt or images. A page whose
  // path ends in an image extension would skip this check: don't route pages that way. Those
  // paths get next.config.ts's fixed policy (STATIC_CSP) instead of this one.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|brand/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};

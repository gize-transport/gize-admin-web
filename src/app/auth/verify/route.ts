import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { EMAIL_LINK_PATH, SET_PASSWORD_PATH } from "@/lib/auth/paths";
import { env } from "@/lib/env";

/** The email links this portal handles: an invitation, and a password reset. */
const LINK_TYPES: readonly string[] = ["invite", "recovery"];

/**
 * The Continue button of an email link's page (GZW-012) posts here: the link is checked with
 * Supabase (it works once), which signs the person in, then on to "Set your password". Only a
 * form on this site may post here (otherwise someone else's link could sign a visitor in). A
 * link that doesn't work goes back to its page, which says so.
 */
export async function POST(request: NextRequest) {
  // 303: the browser follows with a GET.
  const go = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), 303);
  const expired = go(`${EMAIL_LINK_PATH}?link=expired`);

  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }
  const form = await request.formData();
  const tokenHash = form.get("token_hash");
  const type = form.get("type");
  if (
    typeof tokenHash !== "string" ||
    !tokenHash ||
    typeof type !== "string" ||
    !LINK_TYPES.includes(type)
  ) {
    return expired;
  }

  // The session goes into the redirect's cookies (as middleware.ts writes them).
  const done = go(SET_PASSWORD_PATH);
  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            done.cookies.set(name, value, options);
          }
          // No cache may keep a response that sets someone's session.
          for (const [key, value] of Object.entries(headers)) {
            done.headers.set(key, value);
          }
        },
      },
    },
  );
  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash,
  });
  return error ? expired : done;
}

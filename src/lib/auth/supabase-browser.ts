import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Supabase Auth in the browser: the session lives in cookies written by @supabase/ssr, never
// in localStorage. Sign-in, sign-out and the middleware come with GZW-010.

/** The browser's Supabase client (one per page: @supabase/ssr reuses it). */
export function getSupabaseBrowserClient() {
  return createBrowserClient(env.supabaseUrl, env.supabasePublishableKey);
}

/**
 * The current access token for `Authorization: Bearer`, refreshed by Supabase when it has
 * expired; null when signed out or outside the browser. Never store or log it.
 */
export async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return data.session?.access_token ?? null;
}

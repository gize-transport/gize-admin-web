import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { getSupabaseBrowserClient } from "./supabase-browser";

type StaffMe = components["schemas"]["StaffMe"];

/** Why Supabase refused the password sign-in (shown as a message on the form). */
export type AuthFailureReason =
  | "invalid_credentials"
  | "not_confirmed"
  | "rate_limited"
  | "network"
  | "unavailable"
  | "unknown";

export type SignInResult =
  | { ok: true; staff: StaffMe }
  | { ok: false; reason: AuthFailureReason }
  /** Supabase accepted the password, but the API says this person isn't (active) staff. */
  | { ok: false; reason: "not_staff" }
  /** Supabase accepted the password, but the staff check failed (shown with its request ID). */
  | { ok: false; reason: "api"; error: unknown };

/** Maps a Supabase Auth error (auth-js `AuthError`) to a reason the form can explain. */
export function authFailureReason(error: {
  status?: number;
  code?: string;
  name?: string;
}): AuthFailureReason {
  if (error.code === "invalid_credentials") return "invalid_credentials";
  if (error.code === "email_not_confirmed") return "not_confirmed";
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return "rate_limited";
  }
  if (error.name === "AuthRetryableFetchError") {
    return error.status ? "unavailable" : "network";
  }
  return "unknown";
}

async function signOutQuietly() {
  try {
    // This browser only: an error here must not end the person's sessions elsewhere.
    await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
  } catch {
    // The person sees why they can't continue either way; the session expires on its own.
  }
}

/**
 * Signs in with Supabase Auth, then asks the API who this is (`staff_me`): only active staff
 * may use the portal (the API decides; the UI never checks roles itself). Any failure after
 * Supabase accepted the password signs out again, so no half-signed-in session is left.
 */
export async function signIn(credentials: {
  email: string;
  password: string;
}): Promise<SignInResult> {
  const { error } =
    await getSupabaseBrowserClient().auth.signInWithPassword(credentials);
  if (error) return { ok: false, reason: authFailureReason(error) };

  try {
    const staff = await unwrap(api.GET("/v1/staff/me"));
    return { ok: true, staff };
  } catch (apiError) {
    await signOutQuietly();
    if (apiError instanceof ApiError && apiError.status === 403) {
      return { ok: false, reason: "not_staff" };
    }
    return { ok: false, reason: "api", error: apiError };
  }
}

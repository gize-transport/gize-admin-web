import { getSupabaseBrowserClient } from "./supabase-browser";

// Setting a password and asking for a reset link (GZW-012), with Supabase Auth.

/** Supabase's minimum password length for this project (owner decision, 2026-11-10). */
export const MIN_PASSWORD_LENGTH = 12;
/**
 * Supabase (bcrypt) reads at most 72 bytes of a password and refuses longer ones: 72 Latin
 * letters, but only 24 Ge'ez ones (3 bytes each). Measured in bytes, as Supabase does.
 */
export const MAX_PASSWORD_BYTES = 72;

export function passwordBytes(password: string) {
  return new TextEncoder().encode(password).length;
}

export type PasswordFailureReason =
  /** Supabase's own policy refused it (stricter than ours, e.g. a known leaked password). */
  | "weak_password"
  | "same_password"
  /** "Secure password change" is on and the session is old: sign in again first. */
  | "reauthentication_needed"
  /** The session the email link started is gone: ask for a new link. */
  | "link_expired"
  | "rate_limited"
  | "network"
  | "unavailable"
  | "unknown";

type AuthErrorShape = { status?: number; code?: string; name?: string };

function failureReason(error: AuthErrorShape): PasswordFailureReason {
  if (error.code === "weak_password") return "weak_password";
  if (error.code === "same_password") return "same_password";
  if (error.code === "reauthentication_needed")
    return "reauthentication_needed";
  if (
    error.name === "AuthSessionMissingError" ||
    error.code === "session_not_found" ||
    error.code === "bad_jwt" ||
    error.status === 401 ||
    error.status === 403
  ) {
    return "link_expired";
  }
  if (
    error.status === 429 ||
    error.code === "over_request_rate_limit" ||
    error.code === "over_email_send_rate_limit"
  ) {
    return "rate_limited";
  }
  if (error.name === "AuthRetryableFetchError") {
    return error.status ? "unavailable" : "network";
  }
  return "unknown";
}

/**
 * Sets the signed-in person's password, then signs out their other sessions (other browsers),
 * so a reset locks out whoever knew the old one; tried twice. That second step never undoes the
 * first, but the person is told when it didn't work (`othersSignedOut: false`).
 */
export async function setPassword(
  password: string,
): Promise<
  | { ok: true; othersSignedOut: boolean }
  | { ok: false; reason: PasswordFailureReason }
> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, reason: failureReason(error) };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      // supabase-js reports a failure in its result, not by throwing.
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "others",
      });
      if (!signOutError) return { ok: true, othersSignedOut: true };
    } catch {
      // Tried again below.
    }
  }
  return { ok: true, othersSignedOut: false };
}

/** The least time the answer takes: an email to a real account isn't told apart by speed. */
export const RESET_ANSWER_MS = 1200;

/**
 * Emails a reset link. The page must never tell anyone which emails are staff, so the answer is
 * the same either way: Supabase refuses a second email to a real account within a minute
 * (`over_email_send_rate_limit`), which would give it away, so that counts as sent; and the
 * answer never comes sooner than RESET_ANSWER_MS. Only a limit on this browser (too many
 * requests) is reported.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ ok: true } | { ok: false; reason: PasswordFailureReason }> {
  const [{ error }] = await Promise.all([
    getSupabaseBrowserClient().auth.resetPasswordForEmail(email),
    new Promise((resolve) => setTimeout(resolve, RESET_ANSWER_MS)),
  ]);
  if (!error || error.code === "over_email_send_rate_limit")
    return { ok: true };
  return { ok: false, reason: failureReason(error) };
}

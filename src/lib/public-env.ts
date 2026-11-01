import { z } from "zod";

// Public settings only (architecture.md, "Environments"): this app has no server secrets.
// Validated by next.config.ts (so a bad value stops `next dev`/`build`/`start`) and by env.ts.

/** Plain http is only for this machine (local API, tests); everywhere else needs https. */
function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".test")
  );
}

const serviceUrl = z.url({ protocol: /^https?$/ }).refine((value) => {
  // zod still runs this when the URL check failed; that case is already reported.
  if (!URL.canParse(value)) return true;
  const url = new URL(value);
  return url.protocol === "https:" || isLocalHost(url.hostname);
}, "must use https (http only for localhost)");

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: serviceUrl.transform((value) =>
    value.replace(/\/+$/, ""),
  ),
  NEXT_PUBLIC_SUPABASE_URL: serviceUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1, "is required"),
  // Error reporting is off while this is empty.
  NEXT_PUBLIC_SENTRY_DSN: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url({ protocol: /^https$/ }).optional(),
  ),
});

export type PublicEnv = {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  sentryDsn: string | undefined;
};

/** Validates the public settings; the error names each bad variable but never its value. */
export function parsePublicEnv(
  source: Record<string, string | undefined>,
): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const name = String(issue.path[0] ?? "");
      const missing = !source[name]?.trim();
      return `- ${name}: ${missing ? "is required" : issue.message}`;
    });
    throw new Error(
      `Invalid public environment variables (see .env.example):\n${problems.join("\n")}`,
    );
  }
  return {
    apiBaseUrl: result.data.NEXT_PUBLIC_API_BASE_URL,
    supabaseUrl: result.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    sentryDsn: result.data.NEXT_PUBLIC_SENTRY_DSN,
  };
}

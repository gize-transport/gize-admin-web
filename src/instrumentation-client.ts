// Runs in the browser before the app is interactive (Next.js instrumentation-client).
// Error reporting is off unless NEXT_PUBLIC_SENTRY_DSN is set; Sentry is then loaded on its
// own, so pages without it never download it. Server-side reporting is checked in GZW-006.
import { sentryOptions } from "@/lib/sentry";

// Read directly (validated at build by next.config.ts), so zod isn't in every page's first load.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  import("@sentry/nextjs")
    .then((Sentry) => Sentry.init(sentryOptions(dsn)))
    .catch(() => {
      // Reporting must never break the portal.
    });
}

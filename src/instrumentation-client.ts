// Runs in the browser before the app is interactive (Next.js instrumentation-client).
// Error reporting is off unless NEXT_PUBLIC_SENTRY_DSN is set; Sentry is then loaded on its
// own, so pages without it never download it. The server has no Sentry: it renders pages and
// holds no data (architecture.md, "Deployment").
import { config as zodConfig } from "zod/v4/core";
import { sentryOptions } from "@/lib/sentry";

// Zod probes whether it may compile validators with `new Function`; our Content Security
// Policy forbids that, and the browser reports each blocked probe. Skip the probe. (Only Zod's
// small core config here; the sign-in form loads Zod itself anyway.)
zodConfig({ jitless: true });

// Read directly (validated at build by next.config.ts).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  import("@sentry/nextjs")
    .then((Sentry) => Sentry.init(sentryOptions(dsn)))
    .catch(() => {
      // Reporting must never break the portal.
    });
}

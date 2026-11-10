import type { NextConfig } from "next";
import { PHASE_PRODUCTION_SERVER } from "next/constants";
import createNextIntlPlugin from "next-intl/plugin";
import { STATIC_CSP } from "./src/lib/csp";
import { parsePublicEnv } from "./src/lib/public-env";

// Security headers for every response (engineering-standards.md, "Security"). The Content
// Security Policy needs a nonce per request, so middleware.ts sets it; that is also why pages
// aren't prerendered (no cacheComponents: a static shell couldn't carry the nonce).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Browsers ignore it on plain http (local), and keep to https for a year once seen.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Paths middleware.ts skips (its matcher) get no nonce: a fixed policy that lets nothing
      // run, so a missing file's 404 page there is inert. Middleware's own policy covers the rest.
      ...[
        "/brand/:path*",
        "/robots.txt",
        "/favicon.ico",
        "/:file(.*\\.(?:png|jpg|jpeg|svg|webp|ico))",
      ].map((source) => ({
        source,
        headers: [{ key: "Content-Security-Policy", value: STATIC_CSP }],
      })),
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// A missing or invalid public env var stops `next dev` and `next build` here. `next start`
// serves values baked in at build, and `next typegen` (npm run typecheck, which loads the config
// in the build phase) needs none, so both skip.
export default function config(phase: string) {
  if (phase !== PHASE_PRODUCTION_SERVER && !process.argv.includes("typegen")) {
    parsePublicEnv(process.env);
  }
  return withNextIntl(nextConfig);
}

import type { NextConfig } from "next";
import { PHASE_PRODUCTION_SERVER } from "next/constants";
import createNextIntlPlugin from "next-intl/plugin";
import { parsePublicEnv } from "./src/lib/public-env";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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

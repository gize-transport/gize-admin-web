// @ts-check
// node scripts/check-worker-routes.mjs <staging|production> – CI's guard before a deploy
// (GZW-086): the Worker the deploy targets claims only its own address (scripts/worker-routes).
import { unstable_readConfig } from "wrangler";
import { routeProblems } from "./worker-routes/lib.mjs";

/** @type {Record<string, { env: string | undefined; name: string; host: string }>} */
const SITES = {
  staging: {
    env: "staging",
    name: "gize-admin-staging",
    host: "staging-admin.gizetransport.com",
  },
  production: {
    env: undefined,
    name: "gize-admin",
    host: "admin.gizetransport.com",
  },
};

const site = SITES[process.argv[2] ?? ""];
if (!site) {
  console.error(
    "Usage: node scripts/check-worker-routes.mjs <staging|production>",
  );
  process.exit(2);
}
const problems = routeProblems(
  unstable_readConfig({ env: site.env, config: "wrangler.jsonc" }),
  site,
);
if (problems.length > 0) {
  for (const problem of problems) console.error(`::error::${problem}`);
  process.exit(1);
}
process.stdout.write(`${site.name} claims only ${site.host}.\n`);

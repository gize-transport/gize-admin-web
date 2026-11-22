// @ts-check
// What a Worker's resolved Wrangler config may claim (GZW-086): exactly its own address, as a
// custom domain. Routes are inherited by a Wrangler environment, so a staging config without its
// own would claim production's address, and a deploy would move it.

/**
 * @param {{ name?: string; routes?: unknown[] }} config the resolved config (`unstable_readConfig`)
 * @param {{ name: string; host: string }} expected
 * @returns {string[]} what is wrong; empty when the config is right
 */
export function routeProblems(config, expected) {
  const problems = [];
  if (config.name !== expected.name) {
    problems.push(`Worker is "${config.name}", expected "${expected.name}".`);
  }
  const routes = config.routes ?? [];
  const own = routes.length === 1 ? routes[0] : null;
  const isOwn =
    typeof own === "object" &&
    own !== null &&
    "pattern" in own &&
    own.pattern === expected.host &&
    "custom_domain" in own &&
    own.custom_domain === true;
  if (!isOwn) {
    problems.push(
      `Routes are ${JSON.stringify(routes)}, expected only ${expected.host} as a custom domain.`,
    );
  }
  return problems;
}

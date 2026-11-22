// @vitest-environment node
import { unstable_readConfig } from "wrangler";
import { describe, expect, it } from "vitest";
import { routeProblems } from "../../scripts/worker-routes/lib.mjs";

const staging = {
  name: "gize-admin-staging",
  host: "staging-admin.gizetransport.com",
};
const own = (pattern: string) => ({ pattern, custom_domain: true });

describe("routeProblems", () => {
  it("accepts a Worker claiming exactly its own address", () => {
    expect(
      routeProblems(
        { name: staging.name, routes: [own(staging.host)] },
        staging,
      ),
    ).toEqual([]);
  });

  it("refuses production's address, an extra one, none, or a plain route", () => {
    for (const routes of [
      [own("admin.gizetransport.com")],
      [own(staging.host), own("admin.gizetransport.com")],
      [],
      undefined,
      [{ pattern: staging.host }],
      [staging.host],
    ]) {
      expect(
        routeProblems({ name: staging.name, routes }, staging),
      ).toHaveLength(1);
    }
  });

  it("refuses another Worker's name", () => {
    expect(
      routeProblems(
        { name: "gize-admin", routes: [own(staging.host)] },
        staging,
      ),
    ).toEqual([`Worker is "gize-admin", expected "gize-admin-staging".`]);
  });

  it("finds the repository's config right for both sites", () => {
    expect(
      routeProblems(
        unstable_readConfig({ env: "staging", config: "wrangler.jsonc" }),
        staging,
      ),
    ).toEqual([]);
    expect(
      routeProblems(unstable_readConfig({ config: "wrangler.jsonc" }), {
        name: "gize-admin",
        host: "admin.gizetransport.com",
      }),
    ).toEqual([]);
  });
});

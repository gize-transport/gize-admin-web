// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  blockingAdvisories,
  exceptionProblems,
  judge,
} from "../../scripts/audit/lib.mjs";

const advisory = (
  name: string,
  id: string,
  severity: string,
  title = "A problem",
) => ({
  source: 1,
  name,
  dependency: name,
  title,
  url: `https://github.com/advisories/${id}`,
  severity,
  range: "<=1.0.0",
});

const report = {
  vulnerabilities: {
    picomatch: {
      severity: "high",
      via: [advisory("picomatch", "GHSA-fc5q-39xc-vjpf", "high")],
    },
    // Only flagged through picomatch: adds no advisory of its own.
    vite: { severity: "high", via: ["picomatch", "tinyglobby"] },
    glob: {
      severity: "moderate",
      via: [advisory("glob", "GHSA-3g3m-2fjr-6pw4", "moderate")],
    },
    next: {
      severity: "critical",
      via: [advisory("next", "GHSA-aaaa-bbbb-cccc", "critical")],
    },
  },
};

const picomatch = {
  id: "GHSA-fc5q-39xc-vjpf",
  package: "picomatch",
  reason: "Reached only by build tools matching our own patterns.",
  expires: "2026-12-31",
};

describe("audit check", () => {
  it("finds each high or critical advisory once, at its own package", () => {
    expect(blockingAdvisories(report).map((found) => found.id)).toEqual([
      "GHSA-fc5q-39xc-vjpf",
      "GHSA-aaaa-bbbb-cccc",
    ]);
  });

  it("allows an advisory with an exception up to and including its last day, nothing else", () => {
    const found = blockingAdvisories(report);
    const onLastDay = judge(found, [picomatch], "2026-12-31");
    expect(onLastDay.allowed.map((a) => a.id)).toEqual(["GHSA-fc5q-39xc-vjpf"]);
    expect(onLastDay.failing.map((a) => a.id)).toEqual(["GHSA-aaaa-bbbb-cccc"]);

    const after = judge(found, [picomatch], "2027-01-01");
    expect(after.failing).toContainEqual(
      expect.objectContaining({
        id: "GHSA-fc5q-39xc-vjpf",
        expired: "2026-12-31",
      }),
    );
  });

  it("doesn't let an exception cover another package's advisory", () => {
    const { failing } = judge(
      blockingAdvisories(report),
      [{ ...picomatch, package: "glob" }],
      "2026-11-18",
    );
    expect(failing.map((a) => a.id)).toContain("GHSA-fc5q-39xc-vjpf");
  });

  it("reports an exception no advisory needs any more", () => {
    const { unused } = judge([], [picomatch], "2026-11-18");
    expect(unused).toEqual([picomatch]);
  });

  it("checks the exceptions file: id, package, a reason and a date at most 90 days ahead", () => {
    expect(exceptionProblems([picomatch], "2026-11-18")).toEqual([]);
    expect(exceptionProblems({}, "2026-11-18")).toHaveLength(1);
    expect(
      exceptionProblems(
        [{ id: "CVE-1", package: "", reason: "ok", expires: "2027-06-01" }],
        "2026-11-18",
      ),
    ).toEqual([
      'Exception 1: "id" must be a GHSA id.',
      'Exception 1: "package" is missing.',
      'Exception 1: "reason" must say why it is safe to allow.',
      'Exception 1: "expires" may be at most 90 days ahead (2027-02-16).',
    ]);
  });
});

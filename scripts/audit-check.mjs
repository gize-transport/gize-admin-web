// @ts-check
// npm run audit:check – CI's dependency audit: fails on any high or critical advisory, except one
// listed in audit-exceptions.json until its `expires` day. Each exception is the owner's decision
// (docs/engineering-standards.md); an unused one fails too, so it is removed once a fix lands.
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { blockingAdvisories, exceptionProblems, judge } from "./audit/lib.mjs";

const run = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));

/** npm audit exits 1 when it finds anything; its JSON report is what counts. */
async function auditReport() {
  try {
    const { stdout } = await run("npm", ["audit", "--json"], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (error) {
    const { stdout } = /** @type {{ stdout?: string }} */ (error);
    if (!stdout) throw error;
    return JSON.parse(stdout);
  }
}

const today = new Date().toISOString().slice(0, 10);
const exceptions = JSON.parse(
  await readFile(new URL("../audit-exceptions.json", import.meta.url), "utf8"),
);
const problems = exceptionProblems(exceptions, today);
if (problems.length > 0) {
  console.error(["audit-exceptions.json:", ...problems].join("\n  "));
  process.exit(1);
}

const report = await auditReport();
if (report.error) {
  console.error(`npm audit failed: ${JSON.stringify(report.error)}`);
  process.exit(1);
}
const { failing, allowed, unused } = judge(
  blockingAdvisories(report),
  exceptions,
  today,
);

for (const { id, package: name, exception } of allowed) {
  process.stdout.write(
    `Allowed until ${exception.expires}: ${id} (${name}). ${exception.reason}
`,
  );
}
for (const { id, package: name, severity, title, url, expired } of failing) {
  console.error(
    `${severity.toUpperCase()}: ${name} – ${title} ${url}` +
      (expired ? ` (its exception ${id} expired on ${expired})` : ""),
  );
}
for (const { id, package: name } of unused) {
  console.error(
    `No longer needed: the exception for ${id} (${name}). Remove it from audit-exceptions.json.`,
  );
}
if (failing.length > 0 || unused.length > 0) process.exit(1);
process.stdout.write("No high or critical advisories without an exception.\n");

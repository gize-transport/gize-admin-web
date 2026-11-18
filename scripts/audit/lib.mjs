// @ts-check
// The audit gate's rules, kept apart from running npm so they can be tested.

/**
 * @typedef {{ id: string; package: string; reason: string; expires: string }} AuditException
 * @typedef {{ id: string; package: string; severity: string; title: string; url: string }} Advisory
 */

const BLOCKING = new Set(["high", "critical"]);

/**
 * The high and critical advisories in an `npm audit --json` report (version 2), each once. A
 * package that is only flagged because it depends on a vulnerable one adds nothing: the advisory
 * is listed under the vulnerable package itself.
 * @param {{ vulnerabilities?: Record<string, { via: Array<string | Record<string, unknown>> }> }} report
 * @returns {Advisory[]}
 */
export function blockingAdvisories(report) {
  /** @type {Map<string, Advisory>} */
  const found = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via) {
      if (typeof via === "string") continue;
      const severity = String(via.severity);
      if (!BLOCKING.has(severity)) continue;
      const url = String(via.url ?? "");
      const id = url.split("/").pop() || String(via.source);
      found.set(id, {
        id,
        package: String(via.name),
        severity,
        title: String(via.title ?? ""),
        url,
      });
    }
  }
  return [...found.values()];
}

/**
 * Checks the exceptions file: each entry names one advisory (a GHSA id), its package, why it is
 * allowed and the last day it is (YYYY-MM-DD, at most 90 days ahead).
 * @param {unknown} exceptions
 * @param {string} today YYYY-MM-DD
 * @returns {string[]} problems; empty when the file is fine
 */
export function exceptionProblems(exceptions, today) {
  if (!Array.isArray(exceptions))
    return ["The exceptions file must be a list."];
  const latest = addDays(today, 90);
  return exceptions.flatMap((entry, index) => {
    const where = `Exception ${index + 1}`;
    if (typeof entry !== "object" || entry === null)
      return [`${where} is not an object.`];
    const {
      id,
      package: name,
      reason,
      expires,
    } = /** @type {Record<string, unknown>} */ (entry);
    const problems = [];
    if (typeof id !== "string" || !/^GHSA(-[0-9a-z]{4}){3}$/.test(id)) {
      problems.push(`${where}: "id" must be a GHSA id.`);
    }
    if (typeof name !== "string" || name === "")
      problems.push(`${where}: "package" is missing.`);
    if (typeof reason !== "string" || reason.trim().length < 20) {
      problems.push(`${where}: "reason" must say why it is safe to allow.`);
    }
    if (typeof expires !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
      problems.push(`${where}: "expires" must be a date (YYYY-MM-DD).`);
    } else if (expires > latest) {
      problems.push(
        `${where}: "expires" may be at most 90 days ahead (${latest}).`,
      );
    }
    return problems;
  });
}

/**
 * Which blocking advisories fail the check: those with no exception, or whose exception has
 * expired (an exception counts up to and including its `expires` day). Also the exceptions no
 * advisory needs any more, so they are removed once a fix lands.
 * @param {Advisory[]} advisories
 * @param {AuditException[]} exceptions
 * @param {string} today YYYY-MM-DD
 */
export function judge(advisories, exceptions, today) {
  const byId = new Map(
    exceptions.map((exception) => [exception.id, exception]),
  );
  /** @type {Array<Advisory & { expired?: string }>} */
  const failing = [];
  /** @type {Array<Advisory & { exception: AuditException }>} */
  const allowed = [];
  for (const advisory of advisories) {
    const exception = byId.get(advisory.id);
    if (!exception || exception.package !== advisory.package)
      failing.push(advisory);
    else if (exception.expires < today)
      failing.push({ ...advisory, expired: exception.expires });
    else allowed.push({ ...advisory, exception });
  }
  const unused = exceptions.filter(
    (exception) => !advisories.some((advisory) => advisory.id === exception.id),
  );
  return { failing, allowed, unused };
}

/** @param {string} day YYYY-MM-DD @param {number} days */
function addDays(day, days) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

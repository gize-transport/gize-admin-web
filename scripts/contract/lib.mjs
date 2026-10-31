// @ts-check
// Shared by contract-sync.mjs and contract-check.mjs (docs/api-contract.md, "How the frontend
// stays in sync"). Kept free of side effects so tests can drive it.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** The backend repo that owns the contract. */
export const CONTRACT_REPO = "gize-transport/gize-admin-api";

/** The contract files, relative to the repo root. */
export const contractFiles = {
  openapi: "src/lib/api/openapi.json",
  schema: "src/lib/api/schema.d.ts",
  version: "src/lib/api/CONTRACT_VERSION",
  contractDoc: "docs/api-contract.md",
  // sha256 of the two downloaded files, so a hand edit to either fails the check. Written last:
  // a sync that stops halfway leaves it out of step, and the check fails too.
  checksums: "src/lib/api/contract.sha256",
};

/** The downloaded files covered by `contract.sha256`, in its order. */
const downloadedFiles = [contractFiles.openapi, contractFiles.contractDoc];

/** @param {string} text */
function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * `sha256sum`-style lines for the downloaded files.
 * @param {Record<string, string>} contents by path
 */
function checksumLines(contents) {
  return downloadedFiles
    .map((file) => `${sha256(contents[file] ?? "")}  ${file}\n`)
    .join("");
}

const TAG_PATTERN = /^api-v(\d+)\.(\d+)\.(\d+)$/;

const GENERATED_BANNER =
  "/**\n * Generated from openapi.json by `npm run contract:sync` (openapi-typescript).\n * Do not edit: CI fails if this file differs from what openapi.json generates.\n */\n\n";

/**
 * The highest `api-vX.Y.Z` tag among `names`, or null when there is none.
 * @param {string[]} names
 * @returns {string | null}
 */
export function latestTag(names) {
  /** @type {{ name: string, version: number[] } | null} */
  let best = null;
  for (const name of names) {
    const match = TAG_PATTERN.exec(name.trim());
    if (!match) continue;
    const version = match.slice(1).map(Number);
    if (!best || compareVersions(version, best.version) > 0) {
      best = { name: name.trim(), version };
    }
  }
  return best?.name ?? null;
}

/**
 * @param {number[]} a
 * @param {number[]} b
 */
function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Arguments of `npm run contract:sync -- [--tag api-vX.Y.Z]`.
 * @param {string[]} argv
 * @returns {{ tag: string | undefined }}
 */
export function parseSyncArgs(argv) {
  /** @type {string | undefined} */
  let tag;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--tag") {
      tag = assertTag(argv[++i]);
    } else if (arg.startsWith("--tag=")) {
      tag = assertTag(arg.slice("--tag=".length));
    } else {
      throw new Error(
        `Unknown argument "${arg}". Usage: npm run contract:sync -- [--tag api-vX.Y.Z]`,
      );
    }
  }
  return { tag };
}

/**
 * @param {string | undefined} tag
 * @returns {string}
 */
function assertTag(tag) {
  if (!tag || !TAG_PATTERN.test(tag)) {
    throw new Error(
      `--tag needs a contract tag like api-vX.Y.Z, got "${tag ?? ""}".`,
    );
  }
  return tag;
}

/**
 * TypeScript types for an OpenAPI document (openapi-typescript, default options).
 * @param {string} openapiText
 * @returns {Promise<string>}
 */
export async function generateSchema(openapiText) {
  // Loaded here so commands that only need tags work without dev dependencies installed.
  const { default: openapiTS, astToString } =
    await import("openapi-typescript");
  const ast = await openapiTS(openapiText);
  return `${GENERATED_BANNER}${astToString(ast)}`;
}

/**
 * @param {string} text
 * @param {string} source
 */
function assertOpenApi(text, source) {
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    document = null;
  }
  if (
    typeof document?.openapi !== "string" ||
    !document.openapi.startsWith("3.") ||
    typeof document.paths !== "object"
  ) {
    throw new Error(`${source} is not an OpenAPI 3 document.`);
  }
}

/**
 * Runs the GitHub CLI with these arguments and returns its stdout.
 * @typedef {(args: string[]) => Promise<string>} GhRunner
 */

/**
 * @param {GhRunner} gh
 * @param {string} tag
 * @param {string} file
 */
function downloadFile(gh, tag, file) {
  return gh([
    "api",
    "-H",
    "Accept: application/vnd.github.raw",
    `repos/${CONTRACT_REPO}/contents/${file}?ref=${tag}`,
  ]);
}

/**
 * The newest contract tag in the backend repo.
 * @param {GhRunner} gh
 */
export async function fetchLatestTag(gh) {
  const names = await gh([
    "api",
    "--paginate",
    "--jq",
    ".[].name",
    `repos/${CONTRACT_REPO}/tags?per_page=100`,
  ]);
  const tag = latestTag(names.split("\n"));
  if (!tag) throw new Error(`No api-v* tag found in ${CONTRACT_REPO}.`);
  return tag;
}

/**
 * Downloads the contract at `tag` (default: latest), regenerates the types and writes all
 * contract files. Nothing is written unless every step before it succeeded.
 * @param {{ root: string, gh: GhRunner, tag?: string }} options
 * @returns {Promise<string>} the tag synced
 */
export async function syncContract({ root, gh, tag }) {
  const syncTag = tag ?? (await fetchLatestTag(gh));
  const [openapi, contractDoc] = await Promise.all([
    downloadFile(gh, syncTag, "openapi.json"),
    downloadFile(gh, syncTag, "docs/api-contract.md"),
  ]);
  assertOpenApi(openapi, `openapi.json at ${syncTag}`);
  const schema = await generateSchema(openapi);

  /** @type {[string, string][]} */
  const writes = [
    [contractFiles.openapi, openapi],
    [contractFiles.schema, schema],
    [contractFiles.contractDoc, contractDoc],
    [contractFiles.version, `${syncTag}\n`],
    [
      contractFiles.checksums,
      checksumLines({
        [contractFiles.openapi]: openapi,
        [contractFiles.contractDoc]: contractDoc,
      }),
    ],
  ];
  for (const [file, content] of writes) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return syncTag;
}

/**
 * @param {string} file
 * @returns {Promise<string | null>}
 */
async function readIfPresent(file) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT")
      return null;
    throw error;
  }
}

/**
 * Checks that the committed contract files are consistent: a valid tag, the downloaded files
 * unchanged since the sync (checksums), an OpenAPI document, and types generated from exactly
 * that document. Returns the problems found (empty = fine).
 * @param {string} root
 * @returns {Promise<string[]>}
 */
export async function checkContract(root) {
  const fix =
    "Run `npm run contract:sync -- --tag <tag>`; never edit generated files.";
  /** @type {string[]} */
  const problems = [];
  const [version, openapi, schema, contractDoc, checksums] = await Promise.all([
    readIfPresent(path.join(root, contractFiles.version)),
    readIfPresent(path.join(root, contractFiles.openapi)),
    readIfPresent(path.join(root, contractFiles.schema)),
    readIfPresent(path.join(root, contractFiles.contractDoc)),
    readIfPresent(path.join(root, contractFiles.checksums)),
  ]);

  if (version === null) {
    problems.push(`${contractFiles.version} is missing. ${fix}`);
  } else if (!TAG_PATTERN.test(version.trim())) {
    problems.push(
      `${contractFiles.version} must hold a tag like api-vX.Y.Z. ${fix}`,
    );
  }

  if (checksums === null) {
    problems.push(`${contractFiles.checksums} is missing. ${fix}`);
  } else if (openapi !== null && contractDoc !== null) {
    const expected = checksumLines({
      [contractFiles.openapi]: openapi,
      [contractFiles.contractDoc]: contractDoc,
    });
    if (checksums !== expected) {
      problems.push(
        `${contractFiles.openapi} or ${contractFiles.contractDoc} changed since the last sync. ${fix}`,
      );
    }
  }
  if (contractDoc === null) {
    problems.push(`${contractFiles.contractDoc} is missing. ${fix}`);
  }

  if (openapi === null) {
    problems.push(`${contractFiles.openapi} is missing. ${fix}`);
    return problems;
  }
  try {
    assertOpenApi(openapi, contractFiles.openapi);
  } catch (error) {
    problems.push(`${/** @type {Error} */ (error).message} ${fix}`);
    return problems;
  }

  if (schema === null) {
    problems.push(`${contractFiles.schema} is missing. ${fix}`);
  } else if (schema !== (await generateSchema(openapi))) {
    problems.push(
      `${contractFiles.schema} does not match openapi.json. ${fix}`,
    );
  }
  return problems;
}

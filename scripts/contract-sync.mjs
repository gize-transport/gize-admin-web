// @ts-check
// npm run contract:sync -- [--tag api-vX.Y.Z]
// Downloads openapi.json and docs/api-contract.md from the backend at a tag (default: the latest
// api-v* tag) with the GitHub CLI, regenerates src/lib/api/schema.d.ts and records the tag.
// `--latest` only prints the newest tag (used by the daily contract-update workflow).
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  fetchLatestTag,
  parseSyncArgs,
  syncContract,
} from "./contract/lib.mjs";

const run = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));

/** @type {import("./contract/lib.mjs").GhRunner} */
async function gh(args) {
  try {
    const { stdout } = await run("gh", args, { maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    const { code, stderr } = /** @type {{ code?: string, stderr?: string }} */ (
      error
    );
    if (code === "ENOENT") {
      throw new Error(
        "The GitHub CLI (gh) is not installed: https://cli.github.com",
      );
    }
    throw new Error(
      `gh ${args.join(" ")} failed: ${stderr?.trim() || String(error)}`,
    );
  }
}

try {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && argv[0] === "--latest") {
    process.stdout.write(`${await fetchLatestTag(gh)}\n`);
  } else {
    const tag = await syncContract({ root, gh, ...parseSyncArgs(argv) });
    process.stdout.write(
      `Synced ${tag}. Review the diff, then run npm run typecheck to see what changed for the UI.\n`,
    );
  }
} catch (error) {
  console.error(/** @type {Error} */ (error).message);
  process.exitCode = 1;
}

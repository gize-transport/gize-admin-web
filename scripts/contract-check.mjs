// @ts-check
// npm run contract:check – fails when the generated contract files were edited by hand or are
// out of step with each other. Works offline, so CI needs no access to the backend repo.
import { fileURLToPath } from "node:url";
import { checkContract } from "./contract/lib.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

const problems = await checkContract(root);
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exitCode = 1;
} else {
  process.stdout.write("Contract files are consistent.\n");
}

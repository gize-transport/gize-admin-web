// @vitest-environment node
import {
  appendFile,
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkContract,
  contractFiles,
  generateSchema,
  latestTag,
  parseSyncArgs,
  syncContract,
} from "../../scripts/contract/lib.mjs";

const repoRoot = process.cwd();
const tempDirs: string[] = [];

async function tempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "gize-contract-"));
  tempDirs.push(dir);
  return dir;
}

/** A copy of this repo's committed contract files in a temp folder. */
async function copyOfContract() {
  const dir = await tempDir();
  for (const file of Object.values(contractFiles)) {
    await cp(path.join(repoRoot, file), path.join(dir, file), {
      recursive: true,
    });
  }
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("latestTag", () => {
  it("picks the highest version, comparing numbers rather than text", () => {
    expect(latestTag(["api-v2.9.0", "api-v2.10.0", "api-v1.12.3"])).toBe(
      "api-v2.10.0",
    );
  });

  it("ignores names that aren't contract tags", () => {
    expect(
      latestTag(["v9.0.0", "api-v9.0", "api-v9.0.0-rc1", "api-v1.2.3"]),
    ).toBe("api-v1.2.3");
  });

  it("returns null when there is no contract tag", () => {
    expect(latestTag(["v1.0.0"])).toBeNull();
  });
});

describe("parseSyncArgs", () => {
  it("defaults to the latest tag", () => {
    expect(parseSyncArgs([])).toEqual({ tag: undefined });
  });

  it("reads --tag in both spellings", () => {
    expect(parseSyncArgs(["--tag", "api-v2.5.0"])).toEqual({
      tag: "api-v2.5.0",
    });
    expect(parseSyncArgs(["--tag=api-v2.5.0"])).toEqual({ tag: "api-v2.5.0" });
  });

  it("refuses a tag that isn't api-vX.Y.Z", () => {
    expect(() => parseSyncArgs(["--tag", "main"])).toThrow(/api-vX\.Y\.Z/);
    expect(() => parseSyncArgs(["--tag", "api-v1.2.3;rm -rf"])).toThrow(
      /api-vX\.Y\.Z/,
    );
  });

  it("refuses a missing tag value and unknown arguments", () => {
    expect(() => parseSyncArgs(["--tag"])).toThrow(/api-vX\.Y\.Z/);
    expect(() => parseSyncArgs(["--force"])).toThrow(/Unknown argument/);
  });
});

describe("checkContract", () => {
  it("passes on the committed contract files", async () => {
    expect(await checkContract(repoRoot)).toEqual([]);
  });

  it("fails when schema.d.ts was edited by hand", async () => {
    const dir = await copyOfContract();
    await appendFile(
      path.join(dir, contractFiles.schema),
      "export type Invented = { id: string };\n",
    );

    const problems = await checkContract(dir);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/schema\.d\.ts does not match openapi\.json/);
  });

  it("fails when openapi.json was edited by hand, even with the types regenerated", async () => {
    const dir = await copyOfContract();
    const openapiPath = path.join(dir, contractFiles.openapi);
    const document = JSON.parse(await readFile(openapiPath, "utf8"));
    document.components.schemas.AreaRead.properties.invented = {
      type: "string",
    };
    const edited = JSON.stringify(document);
    await writeFile(openapiPath, edited);
    await writeFile(
      path.join(dir, contractFiles.schema),
      await generateSchema(edited),
    );

    expect(await checkContract(dir)).toEqual([
      expect.stringMatching(/changed since the last sync/),
    ]);
  });

  it("fails when api-contract.md was edited by hand", async () => {
    const dir = await copyOfContract();
    await appendFile(path.join(dir, contractFiles.contractDoc), "\nEdited.\n");

    expect(await checkContract(dir)).toEqual([
      expect.stringMatching(/changed since the last sync/),
    ]);
  });

  it("fails when the checksums are missing", async () => {
    const dir = await copyOfContract();
    await rm(path.join(dir, contractFiles.checksums));

    expect(await checkContract(dir)).toEqual([
      expect.stringMatching(/contract\.sha256 is missing/),
    ]);
  });

  it("fails when CONTRACT_VERSION isn't a contract tag", async () => {
    const dir = await copyOfContract();
    await writeFile(path.join(dir, contractFiles.version), "latest\n");

    expect(await checkContract(dir)).toEqual([
      expect.stringMatching(/CONTRACT_VERSION/),
    ]);
  });

  it("fails when a generated file is missing", async () => {
    const dir = await copyOfContract();
    await rm(path.join(dir, contractFiles.schema));

    expect(await checkContract(dir)).toEqual([
      expect.stringMatching(/schema\.d\.ts is missing/),
    ]);
  });
});

describe("syncContract", () => {
  const openapi = JSON.stringify({
    openapi: "3.1.0",
    info: { title: "Test", version: "v1" },
    paths: {
      "/v1/things": {
        get: {
          operationId: "things_list",
          responses: { "200": { description: "OK" } },
        },
      },
    },
  });

  /** Stands in for the `gh` CLI: answers the tag list and file downloads. */
  function fakeGh(files: Record<string, string>) {
    const calls: string[][] = [];
    const gh = async (args: string[]) => {
      calls.push(args);
      const url = args.at(-1) ?? "";
      if (url.includes("/tags")) return "api-v1.0.0\napi-v1.10.0\napi-v1.9.0\n";
      const match = /contents\/(.+)\?ref=(.+)$/.exec(url);
      const content = match ? files[`${match[2]}:${match[1]}`] : undefined;
      if (content === undefined) throw new Error(`HTTP 404: ${url}`);
      return content;
    };
    return { gh, calls };
  }

  it("downloads the latest tag's files and regenerates the types", async () => {
    const dir = await tempDir();
    const { gh, calls } = fakeGh({
      "api-v1.10.0:openapi.json": openapi,
      "api-v1.10.0:docs/api-contract.md": "# Contract\n",
    });

    const tag = await syncContract({ root: dir, gh });

    expect(tag).toBe("api-v1.10.0");
    expect(calls[0]).toEqual([
      "api",
      "--paginate",
      "--jq",
      ".[].name",
      "repos/gize-transport/gize-admin-api/tags?per_page=100",
    ]);
    const read = (file: string) => readFile(path.join(dir, file), "utf8");
    expect(await read(contractFiles.version)).toBe("api-v1.10.0\n");
    expect(await read(contractFiles.openapi)).toBe(openapi);
    expect(await read(contractFiles.contractDoc)).toBe("# Contract\n");
    expect(await read(contractFiles.schema)).toContain("things_list");
    expect(await checkContract(dir)).toEqual([]);
  });

  it("uses the tag it is given", async () => {
    const dir = await tempDir();
    const { gh, calls } = fakeGh({
      "api-v1.0.0:openapi.json": openapi,
      "api-v1.0.0:docs/api-contract.md": "# Contract\n",
    });

    await syncContract({ root: dir, gh, tag: "api-v1.0.0" });

    expect(calls.some((args) => args.join(" ").includes("/tags"))).toBe(false);
    expect(await readFile(path.join(dir, contractFiles.version), "utf8")).toBe(
      "api-v1.0.0\n",
    );
  });

  it("writes nothing when the download isn't an OpenAPI document", async () => {
    const dir = await copyOfContract();
    const before = await readFile(
      path.join(dir, contractFiles.openapi),
      "utf8",
    );
    const { gh } = fakeGh({
      "api-v1.10.0:openapi.json": "<html>Not found</html>",
      "api-v1.10.0:docs/api-contract.md": "# Contract\n",
    });

    await expect(syncContract({ root: dir, gh })).rejects.toThrow(
      /not an OpenAPI 3 document/,
    );
    expect(await readFile(path.join(dir, contractFiles.openapi), "utf8")).toBe(
      before,
    );
  });

  it("writes nothing when one of the downloads fails", async () => {
    const dir = await copyOfContract();
    const before = await readFile(
      path.join(dir, contractFiles.openapi),
      "utf8",
    );
    const { gh } = fakeGh({ "api-v1.10.0:openapi.json": openapi });

    await expect(syncContract({ root: dir, gh })).rejects.toThrow(/HTTP 404/);
    expect(await readFile(path.join(dir, contractFiles.openapi), "utf8")).toBe(
      before,
    );
    expect(await checkContract(dir)).toEqual([]);
  });
});

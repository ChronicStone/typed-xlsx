import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "../../..");
const docsPublicDir = resolve(rootDir, "apps/docs/public/generated");
const examplesRoot = resolve(rootDir, "packages/examples");
const showcaseRoot = resolve(examplesRoot, "showcase");

function hasBuiltExampleArtifacts() {
  const manifestPath = resolve(examplesRoot, "generated/examples-manifest.json");

  if (!existsSync(manifestPath) || !existsSync(showcaseRoot)) {
    return false;
  }

  return readdirSync(showcaseRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .some((entry) =>
      existsSync(resolve(showcaseRoot, entry.name, "artifact/inspect/summary.json")),
    );
}

function ensureExamplesWorkspaceArtifacts() {
  if (hasBuiltExampleArtifacts()) {
    return;
  }

  const result = spawnSync("bun", ["run", "examples:build"], {
    cwd: rootDir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("Failed to generate example artifacts before syncing docs workspace assets.");
  }
}

ensureExamplesWorkspaceArtifacts();

const sources = [
  {
    from: resolve(rootDir, "packages/examples/showcase"),
    to: resolve(docsPublicDir, "examples/showcase"),
  },
  {
    from: resolve(rootDir, "packages/examples/generated/examples-manifest.json"),
    to: resolve(docsPublicDir, "examples/examples-manifest.json"),
  },
  {
    from: resolve(rootDir, "packages/benchmark/artifacts/reports/stream"),
    to: resolve(docsPublicDir, "benchmark/stream"),
  },
  {
    from: resolve(rootDir, "packages/benchmark/artifacts/samples"),
    to: resolve(docsPublicDir, "benchmark/samples"),
  },
];

mkdirSync(docsPublicDir, { recursive: true });

for (const source of sources) {
  if (!existsSync(source.from)) continue;

  rmSync(source.to, { recursive: true, force: true });
  mkdirSync(dirname(source.to), { recursive: true });
  cpSync(source.from, source.to, { recursive: true });
}

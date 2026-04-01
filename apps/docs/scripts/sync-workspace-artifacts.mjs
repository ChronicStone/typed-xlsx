import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "../../..");
const docsPublicDir = resolve(rootDir, "apps/docs/public/generated");
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

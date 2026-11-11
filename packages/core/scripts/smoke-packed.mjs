// Tests the package as users get it: packs the built package, installs the tarball into a
// temp project, type-checks a consumer file against the bundled .d.ts, and runs a plain
// JavaScript consumer.
//
// Usage: node scripts/smoke-packed.mjs [typescript-version] [--runtime=node|bun|deno]
// Run `bun run build` first.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixtureDir = join(packageDir, "scripts", "smoke-packed");
const args = process.argv.slice(2);
const runtime = args.find((arg) => arg.startsWith("--runtime="))?.slice(10) ?? "node";
const typescript = args.find((arg) => !arg.startsWith("--")) ?? "latest";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(label, command, commandArgs, cwd) {
  console.log(`... ${label}`);
  try {
    execFileSync(command, commandArgs, { cwd, stdio: ["ignore", "inherit", "inherit"] });
  } catch (error) {
    console.error(`FAIL ${label}`);
    throw error;
  }
  console.log(`ok  ${label}`);
}

// --ignore-scripts: prepack would rewrite the tracked packages/core/README.md and rebuild.
const packOutput = execFileSync(npm, ["pack", "--json", "--ignore-scripts"], {
  cwd: packageDir,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
const tarballName = JSON.parse(packOutput)[0].filename;
const tarball = join(packageDir, tarballName);
const workdir = mkdtempSync(join(tmpdir(), "typed-xlsx-smoke-"));

try {
  writeFileSync(
    join(workdir, "package.json"),
    JSON.stringify({ name: "typed-xlsx-smoke", private: true, type: "module" }),
  );
  copyFileSync(join(fixtureDir, "smoke.ts"), join(workdir, "smoke.ts"));
  copyFileSync(join(fixtureDir, "smoke.mjs"), join(workdir, "smoke.mjs"));

  run(
    `install ${tarballName}, @types/node and typescript@${typescript}`,
    npm,
    [
      "install",
      "--no-audit",
      "--no-fund",
      tarball,
      `typescript@${typescript}`,
      // build/index.d.ts mentions Buffer and NodeJS types, so consumers need @types/node.
      "@types/node@20",
    ],
    workdir,
  );
  console.log(`    installed: ${readdirSync(join(workdir, "node_modules")).join(", ")}`);

  run(
    `tsc --strict on smoke.ts (typescript@${typescript})`,
    npx,
    [
      "tsc",
      "--noEmit",
      "--strict",
      "--module",
      "nodenext",
      "--moduleResolution",
      "nodenext",
      "--target",
      "es2022",
      // TypeScript 6 includes no ambient @types packages by default.
      "--types",
      "node",
      "smoke.ts",
    ],
    workdir,
  );

  const runner = {
    node: ["node", ["smoke.mjs"]],
    bun: ["bun", ["smoke.mjs"]],
    deno: ["deno", ["run", "-A", "smoke.mjs"]],
  }[runtime];
  if (!runner) throw new Error(`Unknown runtime "${runtime}". Use node, bun or deno.`);
  run(`run smoke.mjs with ${runtime}`, runner[0], runner[1], workdir);

  console.log("smoke:packed passed");
} finally {
  rmSync(workdir, { recursive: true, force: true });
  rmSync(tarball, { force: true });
}

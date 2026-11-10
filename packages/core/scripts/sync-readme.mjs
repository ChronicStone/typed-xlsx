// Copies the repository README into this package for npm, which cannot resolve
// repository-relative paths: images point at raw GitHub files, links at the GitHub tree.
// Runs on prepack, so every published version carries the current README.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = "https://github.com/ChronicStone/typed-xlsx";
const raw = "https://raw.githubusercontent.com/ChronicStone/typed-xlsx/main/";
const source = fileURLToPath(new URL("../../../README.md", import.meta.url));
const target = fileURLToPath(new URL("../README.md", import.meta.url));

const readme = readFileSync(source, "utf8")
  .replace(/(src|srcset)="\.\/([^"]+)"/g, (_, attr, path) => `${attr}="${raw}${path}"`)
  .replace(/href="\.\/([^"]+)"/g, (_, path) => `href="${repo}/blob/main/${path}"`)
  .replace(/\]\(\.\/([^)]+)\)/g, (_, path) => `](${repo}/blob/main/${path})`);

writeFileSync(target, readme);

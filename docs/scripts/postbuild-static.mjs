import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const outputDir = new URL("../.output/public/", import.meta.url);
const fallbackFile = new URL("200.html", outputDir);
const fallbackPath = fallbackFile.pathname;

if (!existsSync(fallbackPath)) {
  throw new Error(`Missing fallback file: ${fallbackPath}`);
}

const routes = [
  "/",
  "/getting-started/introduction",
  "/getting-started/installation",
  "/schema-builder/create-schema",
  "/schema-builder/columns",
  "/schema-builder/dynamic-columns",
  "/schema-builder/reusable-transformers",
  "/schema-builder/reusable-formatters",
  "/schema-builder/build-schema",
  "/file-builder/create-file-builder",
  "/file-builder/define-sheets",
  "/file-builder/define-tables",
  "/file-builder/build-excel-file",
];

for (const route of routes) {
  const targetPath =
    route === "/"
      ? join(outputDir.pathname, "index.html")
      : join(outputDir.pathname, route.replace(/^\//, ""), "index.html");

  if (!existsSync(targetPath)) {
    mkdirSync(dirname(targetPath), { recursive: true });
    cpSync(fallbackPath, targetPath);
  }
}

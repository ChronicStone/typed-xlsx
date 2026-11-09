import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const outputDir = new URL("../.output/public/", import.meta.url);
const fallbackFile = new URL("200.html", outputDir);
const fallbackPath = fallbackFile.pathname;

if (!existsSync(fallbackPath)) {
  throw new Error(`Missing fallback file: ${fallbackPath}`);
}

// Old URLs are not copied here: vercel.json redirects them with a real 301 instead.
const routes = ["/", "/getting-started/introduction", "/getting-started/installation"];

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

/**
 * Pre-compute Twoslash-highlighted HTML for all playground source panes.
 *
 * Runs at build time (Node.js) where the TypeScript compiler is available.
 * Writes HTML files to public/generated/examples/showcase/<id>/twoslash/<theme>/<pane>.html
 *
 * The client loads these files and uses Vue's runtime compiler to hydrate
 * <v-menu> floating-vue popups without ever running Twoslash in the browser.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const rootDir = resolve(import.meta.dirname, "../../..");
const docsDir = resolve(rootDir, "apps/docs");
const publicGenDir = resolve(docsDir, "public/generated");
const manifestPath = resolve(publicGenDir, "examples/examples-manifest.json");

const themes = ["vitesse-dark", "vitesse-light"];

// ---------------------------------------------------------------------------
// Source pane ordering (mirrors artifactCatalog.ts)
// ---------------------------------------------------------------------------
const sourcePaneOrder = ["schema.ts", "workbook.ts", "data.ts", "buffered.ts", "stream.ts"];

function getSourcePaneKeys(sourceFiles) {
  return Object.keys(sourceFiles).sort((a, b) => {
    const ai = sourcePaneOrder.indexOf(a);
    const bi = sourcePaneOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// ---------------------------------------------------------------------------
// Normalize imports (mirrors artifactCatalog.ts)
// ---------------------------------------------------------------------------
function normalizeSourceModule(source) {
  return source
    .replaceAll("../../src/_shared/faker", "./_shared/faker")
    .replaceAll("../../src", "@chronicstone/typed-xlsx");
}

// ---------------------------------------------------------------------------
// Build the Twoslash source for a given artifact + active pane key.
// This is the Node.js equivalent of buildArtifactTwoslashSource().
// ---------------------------------------------------------------------------
function buildTwoslashSource(artifact, activeKey) {
  const keys = getSourcePaneKeys(artifact.sourceFiles);
  const visibleKeys = new Set();

  if (keys.includes("data.ts")) visibleKeys.add("data.ts");
  if (keys.includes("schema.ts") && activeKey !== "data.ts") visibleKeys.add("schema.ts");
  if (keys.includes(activeKey)) visibleKeys.add(activeKey);

  const prefix = `// @filename: node_modules/@faker-js/faker/index.d.ts
export const faker: any;
// ---cut---
// @filename: _shared/faker.ts
export function createShowcaseFaker(_seed: number) {
  return {
    helpers: { arrayElement: <T>(values: T[]) => values[0] as T },
    number: {
      int: (_options?: unknown) => 0,
      float: (_options?: unknown) => 0,
    },
    string: { alphanumeric: (_options?: unknown) => "SAMPLE" },
    commerce: { productName: () => "Sample Product" },
    company: { name: () => "Sample Company" },
    person: { fullName: () => "Sample Person" },
    internet: { email: () => "sample@example.com" },
    location: { city: () => "Paris" },
  };
}`;

  const contextBlocks = [];
  let activeBlock = "";

  for (const key of visibleKeys) {
    const source = normalizeSourceModule(artifact.sourceFiles[key] ?? "").trim();
    if (key === activeKey) {
      activeBlock = `// @filename: ${key}\n// ---cut---\n${source}`;
    } else {
      contextBlocks.push(`// @filename: ${key}\n${source}`);
    }
  }

  return `${prefix}\n${contextBlocks.join("\n")}\n${activeBlock}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!existsSync(manifestPath)) {
    console.warn("[generate-twoslash-html] No examples manifest found — skipping.");
    process.exit(0);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const artifacts = manifest.artifacts;

  console.log(`[generate-twoslash-html] Processing ${artifacts.length} artifacts…`);

  // Lazy-import shiki + twoslash (Node.js only)
  const { createHighlighter } = await import("shiki");
  const { transformerTwoslash, rendererFloatingVue } = await import("@shikijs/vitepress-twoslash");

  // Pre-warm shiki with all languages the transformer may need internally
  const highlighter = await createHighlighter({
    themes,
    langs: ["typescript", "javascript", "json", "vue", "tsx", "jsx"],
  });

  /** @type {import("shiki").ShikiTransformer} */
  const sharedTransformer = transformerTwoslash({
    explicitTrigger: false,
    throws: false,
    renderer: rendererFloatingVue({
      processHoverInfo(hover) {
        return hover.replace(/globalThis\./g, "");
      },
    }),
    twoslashOptions: {
      compilerOptions: {
        lib: ["esnext", "dom"],
        types: ["node"],
      },
    },
  });

  let totalFiles = 0;
  let errors = 0;

  for (const artifact of artifacts) {
    const paneKeys = getSourcePaneKeys(artifact.sourceFiles);
    const outDir = resolve(publicGenDir, `examples/showcase/${artifact.id}/twoslash`);

    for (const theme of themes) {
      const themeDir = resolve(outDir, theme);
      mkdirSync(themeDir, { recursive: true });

      for (const paneKey of paneKeys) {
        const outFile = resolve(themeDir, `${paneKey}.html`);

        try {
          const twoslashSource = buildTwoslashSource(artifact, paneKey);

          const html = highlighter.codeToHtml(twoslashSource, {
            lang: paneKey.endsWith(".ts") ? "ts" : "text",
            theme,
            transformers: [sharedTransformer],
          });

          writeFileSync(outFile, html, "utf8");
          totalFiles++;
        } catch (err) {
          errors++;
          console.error(
            `[generate-twoslash-html] FAILED ${artifact.id}/${paneKey} (${theme}):`,
            err?.message ?? err,
          );

          // Write a plain fallback (code without Twoslash)
          try {
            const source = normalizeSourceModule((artifact.sourceFiles[paneKey] ?? "").trim());
            const fallbackHtml = highlighter.codeToHtml(source, {
              lang: paneKey.endsWith(".ts") ? "ts" : "text",
              theme,
            });
            writeFileSync(outFile, fallbackHtml, "utf8");
          } catch {
            // If even the fallback fails, write empty
            writeFileSync(outFile, "", "utf8");
          }
        }
      }
    }
  }

  console.log(
    `[generate-twoslash-html] Done: ${totalFiles} files generated` +
      (errors ? `, ${errors} errors (fallback HTML used)` : ""),
  );
}

main().catch((err) => {
  console.error("[generate-twoslash-html] Fatal error:", err);
  process.exit(1);
});

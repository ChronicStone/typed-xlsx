import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import { unzipSync } from "fflate";
import type {
  GeneratedExamplesArtifact,
  GeneratedExamplesManifest,
  ShowcaseMeta,
} from "../src/_shared/report-types";

const examplesRoot = path.resolve(import.meta.dirname, "..");
const showcaseRoot = path.join(examplesRoot, "showcase");
const generatedRoot = path.join(examplesRoot, "generated");

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readUtf8(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

function toTypeScriptModule(manifest: GeneratedExamplesManifest) {
  return [
    'import type { GeneratedExamplesManifest } from "../src/_shared/report-types";',
    "",
    `export const generatedExamplesManifest = ${JSON.stringify(manifest, null, 2)} satisfies GeneratedExamplesManifest;`,
    "",
    "export default generatedExamplesManifest;",
    "",
  ].join("\n");
}

function unzipWorkbookEntries(bytes: Uint8Array | Buffer) {
  const archive = unzipSync(Buffer.from(bytes));

  return new Map(
    Object.entries(archive).map(([entry, content]) => [
      entry,
      Buffer.from(content).toString("utf8"),
    ]),
  );
}

function listSheetEntries(entries: Map<string, string>) {
  return [...entries.keys()]
    .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry))
    .sort();
}

function listSheetNames(workbookXml: string) {
  const doc = new DOMParser().parseFromString(workbookXml, "application/xml");
  const nodes = doc.getElementsByTagName("sheet");
  return Array.from(
    { length: nodes.length },
    (_, index) => nodes[index]?.getAttribute("name") || "",
  );
}

function collectSourceFiles(reportDir: string) {
  return Object.fromEntries(
    ["data.ts", "schema.ts", "workbook.ts", "stream.ts"]
      .filter((file) => fs.existsSync(path.join(reportDir, file)))
      .map((file) => [file, readUtf8(path.join(reportDir, file))]),
  );
}

function writeInspectArtifacts(
  reportDir: string,
  meta: ShowcaseMeta,
  entries: Map<string, string>,
) {
  const inspectDir = path.join(reportDir, "artifact", "inspect");
  ensureDir(inspectDir);

  const workbookXml = entries.get("xl/workbook.xml") || "";
  const stylesXml = entries.get("xl/styles.xml") || "";
  const sheetEntries = listSheetEntries(entries);

  if (workbookXml) {
    fs.writeFileSync(path.join(inspectDir, "workbook.xml"), workbookXml);
  }

  if (stylesXml) {
    fs.writeFileSync(path.join(inspectDir, "styles.xml"), stylesXml);
  }

  for (const sheetEntry of sheetEntries) {
    fs.writeFileSync(
      path.join(inspectDir, path.basename(sheetEntry)),
      entries.get(sheetEntry) || "",
    );
  }

  fs.writeFileSync(
    path.join(inspectDir, "summary.json"),
    JSON.stringify(
      {
        id: meta.id,
        title: meta.title,
        tags: meta.tags,
        features: meta.features,
        sheetNames: listSheetNames(workbookXml),
        inspectFiles: [
          "workbook.xml",
          "styles.xml",
          ...sheetEntries.map((entry) => path.basename(entry)),
        ],
      },
      null,
      2,
    ),
  );
}

async function loadBuilder(reportDir: string) {
  const streamModule = path.join(reportDir, "stream.ts");
  const workbookModule = path.join(reportDir, "workbook.ts");
  const modulePath = fs.existsSync(streamModule) ? streamModule : workbookModule;

  if (!fs.existsSync(modulePath)) {
    throw new Error(`Missing artifact builder in ${reportDir}`);
  }

  const mod = await import(pathToFileURL(modulePath).href);
  if (typeof mod.buildArtifact !== "function") {
    throw new Error(`Expected buildArtifact export in ${modulePath}`);
  }

  return mod.buildArtifact as () => Promise<Uint8Array | Buffer> | Uint8Array | Buffer;
}

async function main() {
  ensureDir(generatedRoot);

  const artifacts: GeneratedExamplesArtifact[] = [];
  const reportDirs = fs
    .readdirSync(showcaseRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(showcaseRoot, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, "meta.json")))
    .sort();

  for (const reportDir of reportDirs) {
    const meta = JSON.parse(readUtf8(path.join(reportDir, "meta.json"))) as ShowcaseMeta;
    const buildArtifact = await loadBuilder(reportDir);
    const workbookBytes = await buildArtifact();
    const artifactPath = path.join(reportDir, meta.artifactFile);

    ensureDir(path.dirname(artifactPath));
    fs.writeFileSync(artifactPath, workbookBytes);

    const entries = unzipWorkbookEntries(workbookBytes);
    writeInspectArtifacts(reportDir, meta, entries);

    artifacts.push({
      id: meta.id,
      title: meta.title,
      description: meta.description,
      developerHook: meta.developerHook,
      tags: meta.tags,
      features: meta.features,
      datasetProfile: meta.datasetProfile,
      artifactFile: meta.artifactFile,
      primarySourceFile: meta.primarySourceFile,
      supportsStreaming: meta.supportsStreaming,
      preview: meta.preview,
      reportPath: `${meta.id}/${meta.artifactFile}`,
      inspectPath: `${meta.id}/artifact/inspect/summary.json`,
      sourceFiles: collectSourceFiles(reportDir),
    });
  }

  const manifest: GeneratedExamplesManifest = {
    generatedAt: new Date().toISOString(),
    artifacts,
  };

  fs.writeFileSync(
    path.join(generatedRoot, "examples-manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  fs.writeFileSync(path.join(generatedRoot, "examples-manifest.ts"), toTypeScriptModule(manifest));
}

await main();

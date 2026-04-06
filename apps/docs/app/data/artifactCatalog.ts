import { getGeneratedExampleArtifacts, type GeneratedExamplesArtifact } from "xlsmith-examples";

type ArtifactKind = "buffered" | "streaming" | "table" | "dynamic" | "workflow";

type ArtifactInspectSummary = {
  id: string;
  title: string;
  tags: string[];
  features: string[];
  sheetNames: string[];
  inspectFiles: string[];
};

export type ArtifactCatalogEntry = GeneratedExamplesArtifact & {
  kind: ArtifactKind;
  inspectSummary?: ArtifactInspectSummary;
};

export type ArtifactSourcePane = {
  key: string;
  label: string;
};

const inspectSummaries = import.meta.glob<{ default: ArtifactInspectSummary }>(
  "../../public/generated/examples/showcase/*/artifact/inspect/summary.json",
  {
    eager: true,
  },
);

const inspectSummaryById = Object.fromEntries(
  Object.entries(inspectSummaries).map(([path, module]) => {
    const match = path.match(/showcase\/([^/]+)\/artifact\/inspect\/summary\.json$/);
    return [match?.[1] ?? path, module.default];
  }),
) as Record<string, ArtifactInspectSummary | undefined>;

function inferKindFromArtifact(artifact: GeneratedExamplesArtifact): ArtifactKind {
  if (artifact.features.includes("createWorkbookStream")) return "streaming";
  if (artifact.features.includes("excel-table mode")) return "table";
  if (artifact.features.includes("typed context")) return "dynamic";
  if (artifact.features.includes("validation DSL")) return "workflow";
  return "buffered";
}

export const artifactCatalog = getGeneratedExampleArtifacts().map((artifact) => ({
  ...artifact,
  kind: inferKindFromArtifact(artifact),
  inspectSummary: inspectSummaryById[artifact.id],
})) satisfies ArtifactCatalogEntry[];

export function getArtifactPreviewKind(artifact: ArtifactCatalogEntry) {
  return artifact.preview.kind;
}

export function getArtifactAccentClass(artifact: ArtifactCatalogEntry) {
  return artifact.preview.accentClass;
}

export function getArtifactLandingEyebrow(artifact: ArtifactCatalogEntry) {
  return artifact.preview.landingEyebrow;
}

export function getArtifactPlaygroundSummary(artifact: ArtifactCatalogEntry) {
  return artifact.preview.playgroundSummary;
}

function normalizeSourceModule(source: string) {
  return source
    .replaceAll("../../src/_shared/faker", "./_shared/faker")
    .replaceAll("../../src", "xlsmith");
}

const sourcePaneOrder = ["schema.ts", "workbook.ts", "data.ts", "buffered.ts", "stream.ts"];

export function getArtifactCatalog() {
  return artifactCatalog;
}

export function findArtifactCatalogEntry(id: string) {
  return artifactCatalog.find((artifact) => artifact.id === id);
}

export function getArtifactSourcePanes(artifact: ArtifactCatalogEntry): ArtifactSourcePane[] {
  return Object.keys(artifact.sourceFiles)
    .sort((left, right) => {
      const leftIndex = sourcePaneOrder.indexOf(left);
      const rightIndex = sourcePaneOrder.indexOf(right);

      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    })
    .map((key) => ({ key, label: key }));
}

export function getArtifactWorkbookUrl(artifact: ArtifactCatalogEntry) {
  return `/generated/examples/showcase/${artifact.reportPath}`;
}

export function getArtifactGithubUrl(artifact: ArtifactCatalogEntry, fileKey?: string) {
  const root = `https://github.com/ChronicStone/xlsmith/tree/main/packages/examples/showcase/${artifact.id}`;
  return fileKey ? `${root}/${fileKey}` : root;
}

export function buildArtifactTwoslashSource(artifact: ArtifactCatalogEntry, activeKey: string) {
  const keys = getArtifactSourcePanes(artifact).map((pane) => pane.key);
  const visibleKeys = new Set<string>();
  const sourceFiles = artifact.sourceFiles as Record<string, string | undefined>;

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
  // Build context blocks (hidden) and the active block (visible).
  // The active file's `// @filename:` goes BEFORE `// ---cut---` so the
  // directive is hidden but still sets the virtual-file context for TS.
  const contextBlocks: string[] = [];
  let activeBlock = "";

  for (const key of visibleKeys) {
    const source = normalizeSourceModule(sourceFiles[key] ?? "").trim();
    if (key === activeKey) {
      // @filename before cut → hidden; code after cut → visible
      activeBlock = `// @filename: ${key}\n// ---cut---\n${source}`;
    } else {
      // Entirely hidden (before the final cut)
      contextBlocks.push(`// @filename: ${key}\n${source}`);
    }
  }

  return `${prefix}\n${contextBlocks.join("\n")}\n${activeBlock}`;
}

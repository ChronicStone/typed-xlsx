import examplesManifest from "./generated/examples-manifest";

export type {
  GeneratedExamplesArtifact,
  GeneratedExamplesManifest,
  ShowcaseArtifact,
  ShowcaseDatasetProfile,
  ShowcaseMeta,
  ShowcasePreviewConfig,
  ShowcasePreviewKind,
} from "./src/_shared/report-types";

export function getGeneratedExamplesManifest() {
  return examplesManifest;
}

export function getGeneratedExampleArtifacts() {
  return examplesManifest.artifacts;
}

export function findGeneratedExampleArtifact(id: string) {
  return examplesManifest.artifacts.find((artifact) => artifact.id === id);
}

export type ShowcaseDatasetProfile = "small" | "medium" | "large";

export type ShowcasePreviewKind = "table" | "workflow" | "matrix" | "board" | "stream";

export type ShowcasePreviewConfig = {
  kind: ShowcasePreviewKind;
  accentClass: string;
  landingEyebrow: string;
  playgroundSummary: string;
};

export type ShowcaseMeta = {
  id: string;
  title: string;
  description: string;
  developerHook: string;
  tags: string[];
  features: string[];
  datasetProfile: ShowcaseDatasetProfile;
  artifactFile: string;
  primarySourceFile: string;
  supportsStreaming?: boolean;
  preview: ShowcasePreviewConfig;
};

export type GeneratedExamplesArtifact = ShowcaseMeta & {
  reportPath: string;
  inspectPath: string;
  sourceFiles: Record<string, string | undefined>;
};

export type GeneratedExamplesManifest = {
  generatedAt: string;
  artifacts: GeneratedExamplesArtifact[];
};

export type ShowcaseArtifact = {
  meta: ShowcaseMeta;
  reportDir: string;
  workbook: Uint8Array | Buffer;
};

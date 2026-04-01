export type ShowcaseDatasetProfile = "small" | "medium" | "large";

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
};

export type ShowcaseArtifact = {
  meta: ShowcaseMeta;
  reportDir: string;
  workbook: Uint8Array | Buffer;
};

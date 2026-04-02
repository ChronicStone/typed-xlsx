import {
  findGeneratedExampleArtifact,
  getGeneratedExamplesManifest,
  type GeneratedExamplesManifest,
} from "@chronicstone/typed-xlsx-examples";

export function useExamplesManifest() {
  return getGeneratedExamplesManifest() as GeneratedExamplesManifest;
}

export function findExampleArtifact(id: string) {
  return findGeneratedExampleArtifact(id);
}

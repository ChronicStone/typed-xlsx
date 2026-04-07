import {
  findGeneratedExampleArtifact,
  getGeneratedExamplesManifest,
  type GeneratedExamplesManifest,
} from "typed-xlsx-examples";

export function useExamplesManifest() {
  return getGeneratedExamplesManifest() as GeneratedExamplesManifest;
}

export function findExampleArtifact(id: string) {
  return findGeneratedExampleArtifact(id);
}

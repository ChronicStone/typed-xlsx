import {
  findGeneratedExampleArtifact,
  getGeneratedExamplesManifest,
  type GeneratedExamplesManifest,
} from "xlsmith-examples";

export function useExamplesManifest() {
  return getGeneratedExamplesManifest() as GeneratedExamplesManifest;
}

export function findExampleArtifact(id: string) {
  return findGeneratedExampleArtifact(id);
}

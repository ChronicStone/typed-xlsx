import manifest from "../../public/generated/examples/examples-manifest.json";

type ExamplesManifest = typeof manifest;

export function useExamplesManifest() {
  return manifest as ExamplesManifest;
}

export function findExampleArtifact(id: string) {
  return manifest.artifacts.find(
    (artifact: ExamplesManifest["artifacts"][number]) => artifact.id === id,
  );
}

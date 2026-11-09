/**
 * Writes `artifact/preview.json` (full render model) and `artifact/preview-thumb.json` (gallery crop)
 * next to every showcase workbook, plus the shared strings part for the playground cell inspector.
 * Runs at the end of `generate-examples.ts`, and on its own: `bun run ./scripts/build-previews.ts`.
 */
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { buildPreviewThumb, buildWorkbookPreview } from "./preview-model";

const showcaseRoot = path.resolve(import.meta.dirname, "..", "showcase");

export function writeArtifactPreview(reportDir: string, artifactFile: string) {
  const workbookPath = path.join(reportDir, artifactFile);
  const bytes = new Uint8Array(fs.readFileSync(workbookPath));
  const model = { fileSize: bytes.length, ...buildWorkbookPreview(bytes) };
  const artifactDir = path.dirname(workbookPath);
  fs.writeFileSync(path.join(artifactDir, "preview.json"), JSON.stringify(model));
  fs.writeFileSync(
    path.join(artifactDir, "preview-thumb.json"),
    JSON.stringify(buildPreviewThumb(model)),
  );

  const sharedStrings = unzipSync(bytes)["xl/sharedStrings.xml"];
  if (sharedStrings) {
    fs.mkdirSync(path.join(artifactDir, "inspect"), { recursive: true });
    fs.writeFileSync(
      path.join(artifactDir, "inspect", "shared-strings.xml"),
      Buffer.from(sharedStrings),
    );
  }
  return model;
}

if (import.meta.main) {
  const dirs = fs
    .readdirSync(showcaseRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(showcaseRoot, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, "meta.json")))
    .sort();

  for (const dir of dirs) {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")) as {
      id: string;
      artifactFile: string;
    };
    const model = writeArtifactPreview(dir, meta.artifactFile);
    const cells = model.sheets.reduce((n, s) => n + Object.keys(s.cells).length, 0);
    const errors = model.sheets.flatMap((s) =>
      Object.entries(s.cells)
        .filter(([, c]) => c.t === "e")
        .map(([ref, c]) => `${s.name}!${ref}=${c.v} (${c.f ?? "value"})`),
    );
    console.log(
      `${meta.id}: ${model.sheets.length} sheets, ${cells} cells${errors.length ? `, ${errors.length} errors: ${errors.slice(0, 4).join("; ")}` : ""}`,
    );
  }
}

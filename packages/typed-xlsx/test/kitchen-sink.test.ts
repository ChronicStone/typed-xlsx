import fs from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import { buildKitchenSinkBufferedExample } from "../examples/kitchen-sink-source/buffered";
import { buildKitchenSinkStreamExample } from "../examples/kitchen-sink-source/stream";

describe("kitchen sink examples", () => {
  it("exports buffered and stream kitchen sink workbooks", async () => {
    const examplesDirectory = path.resolve(import.meta.dirname, "../examples");
    fs.mkdirSync(examplesDirectory, { recursive: true });

    fs.writeFileSync(
      path.join(examplesDirectory, "kitchen-sink-buffered.xlsx"),
      buildKitchenSinkBufferedExample(),
    );
    fs.writeFileSync(
      path.join(examplesDirectory, "kitchen-sink-stream.xlsx"),
      await buildKitchenSinkStreamExample(),
    );
  });
});

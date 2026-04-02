import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeStreamingFulfillmentExportWorkbook } from "@chronicstone/typed-xlsx-examples/showcase/streaming-fulfillment-export/stream";

const TARGET_VISIBLE_ROWS = 50_000;

async function main() {
  const examplesDirectory = path.resolve(
    import.meta.dirname,
    "../artifacts/samples/streaming-fulfillment-export",
  );
  fs.mkdirSync(examplesDirectory, { recursive: true });

  const outputPath = path.join(examplesDirectory, "streaming-fulfillment-export-sample.xlsx");
  fs.mkdtempSync(path.join(os.tmpdir(), "typed-xlsx-streaming-fulfillment-"));

  await writeStreamingFulfillmentExportWorkbook({ filePath: outputPath });

  console.log(`Generated ${outputPath}`);
  console.log(`Approx visible rows: ${TARGET_VISIBLE_ROWS}`);
}

await main();

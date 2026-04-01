import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeFinancialReportStreamExample } from "@chronicstone/typed-xlsx-examples/src/financial-report/stream";

const TARGET_VISIBLE_ROWS = 50_000;
const DEPARTMENTS_PER_ROW = 3;
const LOGICAL_ROWS = Math.ceil(TARGET_VISIBLE_ROWS / DEPARTMENTS_PER_ROW);

async function main() {
  const examplesDirectory = path.resolve(
    import.meta.dirname,
    "../artifacts/samples/financial-report",
  );
  fs.mkdirSync(examplesDirectory, { recursive: true });

  const outputPath = path.join(examplesDirectory, "financial-report-stream-50000-rows.xlsx");
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "typed-xlsx-financial-report-"));

  await writeFinancialReportStreamExample({
    filePath: outputPath,
    logicalRows: LOGICAL_ROWS,
    departmentsPerRow: DEPARTMENTS_PER_ROW,
    batchSize: 500,
    tempDirectory,
  });

  console.log(`Generated ${outputPath}`);
  console.log(`Logical rows: ${LOGICAL_ROWS} | detail rows: ${LOGICAL_ROWS * DEPARTMENTS_PER_ROW}`);
}

await main();

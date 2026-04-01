import fs from "node:fs";
import path from "node:path";
import { financialReportExcel } from "../src/financial-report/workbook";
import { buildFinancialReportStreamExample } from "../src/financial-report/stream";
import { buildKitchenSinkBufferedExample } from "../src/kitchen-sink/buffered";
import { buildKitchenSinkStreamExample } from "../src/kitchen-sink/stream";

const examplesDirectory = path.resolve(import.meta.dirname, "../artifacts/reports");
const generatedDirectory = path.resolve(import.meta.dirname, "../generated");

type ExampleArtifact = {
  id: string;
  title: string;
  reportPath: string;
  sourceFiles: Record<string, string>;
};

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(import.meta.dirname, relativePath), "utf8");
}

async function main() {
  fs.mkdirSync(examplesDirectory, { recursive: true });
  fs.mkdirSync(generatedDirectory, { recursive: true });

  const financialReportPath = path.join(examplesDirectory, "financial-report.xlsx");
  const financialReportStreamPath = path.join(examplesDirectory, "financial-report-stream.xlsx");
  const kitchenSinkBufferedPath = path.join(examplesDirectory, "kitchen-sink-buffered.xlsx");
  const kitchenSinkStreamPath = path.join(examplesDirectory, "kitchen-sink-stream.xlsx");

  fs.writeFileSync(financialReportPath, financialReportExcel);
  fs.writeFileSync(financialReportStreamPath, await buildFinancialReportStreamExample());
  fs.writeFileSync(kitchenSinkBufferedPath, buildKitchenSinkBufferedExample());
  fs.writeFileSync(kitchenSinkStreamPath, await buildKitchenSinkStreamExample());

  const manifest: { generatedAt: string; artifacts: ExampleArtifact[] } = {
    generatedAt: new Date().toISOString(),
    artifacts: [
      {
        id: "financial-report",
        title: "Financial report",
        reportPath: "financial-report.xlsx",
        sourceFiles: {
          "data.ts": readSource("../src/financial-report/data.ts"),
          "schema.ts": readSource("../src/financial-report/schema.ts"),
          "workbook.ts": readSource("../src/financial-report/workbook.ts"),
          "stream.ts": readSource("../src/financial-report/stream.ts"),
        },
      },
      {
        id: "kitchen-sink",
        title: "Kitchen sink",
        reportPath: "kitchen-sink-buffered.xlsx",
        sourceFiles: {
          "data.ts": readSource("../src/kitchen-sink/data.ts"),
          "schema.ts": readSource("../src/kitchen-sink/schema.ts"),
          "buffered.ts": readSource("../src/kitchen-sink/buffered.ts"),
          "stream.ts": readSource("../src/kitchen-sink/stream.ts"),
        },
      },
    ],
  };

  fs.writeFileSync(
    path.join(generatedDirectory, "examples-manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  console.log(`Generated ${financialReportPath}`);
  console.log(`Generated ${financialReportStreamPath}`);
  console.log(`Generated ${kitchenSinkBufferedPath}`);
  console.log(`Generated ${kitchenSinkStreamPath}`);
  console.log(`Generated ${path.join(generatedDirectory, "examples-manifest.json")}`);
}

await main();

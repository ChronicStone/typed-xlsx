import fs from "node:fs";
import path from "node:path";
import { financialReportExcel } from "../examples/financial-report-source/file";
import { buildFinancialReportStreamExample } from "../examples/financial-report-source/stream";
import { buildKitchenSinkBufferedExample } from "../examples/kitchen-sink-source/buffered";
import { buildKitchenSinkStreamExample } from "../examples/kitchen-sink-source/stream";

async function main() {
  const examplesDirectory = path.resolve(import.meta.dirname, "../examples");
  fs.mkdirSync(examplesDirectory, { recursive: true });

  const financialReportPath = path.join(examplesDirectory, "financial-report.xlsx");
  const financialReportStreamPath = path.join(examplesDirectory, "financial-report-stream.xlsx");
  const kitchenSinkBufferedPath = path.join(examplesDirectory, "kitchen-sink-buffered.xlsx");
  const kitchenSinkStreamPath = path.join(examplesDirectory, "kitchen-sink-stream.xlsx");

  fs.writeFileSync(financialReportPath, financialReportExcel);
  fs.writeFileSync(financialReportStreamPath, await buildFinancialReportStreamExample());
  fs.writeFileSync(kitchenSinkBufferedPath, buildKitchenSinkBufferedExample());
  fs.writeFileSync(kitchenSinkStreamPath, await buildKitchenSinkStreamExample());

  console.log(`Generated ${financialReportPath}`);
  console.log(`Generated ${financialReportStreamPath}`);
  console.log(`Generated ${kitchenSinkBufferedPath}`);
  console.log(`Generated ${kitchenSinkStreamPath}`);
}

await main();

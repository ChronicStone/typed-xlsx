import fs from "node:fs";
import { describe, it } from "vitest";

import { financialReportExcel } from "../examples/financial-report-source/file";
import { buildFinancialReportStreamExample } from "../examples/financial-report-source/stream";

describe("should generate the example excel", () => {
  it("exported", () => {
    fs.writeFileSync("./examples/financial-report.xlsx", financialReportExcel);
  });

  it("exports streamed workbook", async () => {
    fs.writeFileSync(
      "./examples/financial-report-stream.xlsx",
      await buildFinancialReportStreamExample(),
    );
  });
});

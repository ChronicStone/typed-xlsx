import { describe, it } from "vitest";

import { financialReportExcel } from "@chronicstone/typed-xlsx-examples/src/financial-report/workbook";
import { buildFinancialReportStreamExample } from "@chronicstone/typed-xlsx-examples/src/financial-report/stream";

describe("financial report examples", () => {
  it("builds the buffered workbook bytes", () => {
    void financialReportExcel;
  });

  it("builds the streamed workbook bytes", async () => {
    await buildFinancialReportStreamExample();
  });
});

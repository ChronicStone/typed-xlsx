import { createWorkbook } from "@chronicstone/typed-xlsx";
import { generateFinancialReportData } from "./data";
import { financialReportSchema } from "./schema";

const workbook = createWorkbook();

workbook.sheet("Financial Report | Full").table("financial-report", {
  rows: generateFinancialReportData(10, 3),
  schema: financialReportSchema,
});

export const financialReportExcel = workbook.toUint8Array();

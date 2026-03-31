import { createWorkbookStream } from "../../src";
import { generateFinancialReportData } from "./data";
import { financialReportSchema } from "./schema";

export async function buildFinancialReportStreamExample() {
  const workbook = createWorkbookStream({
    tempStorage: "memory",
  });

  const table = await workbook.sheet("Financial Report | Full").table("financial-report", {
    schema: financialReportSchema,
  });

  await table.commit({
    rows: generateFinancialReportData(10, 3),
  });

  const readable = workbook.toNodeReadable();
  const chunks: Buffer[] = [];

  for await (const chunk of readable) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function writeFinancialReportStreamExample(params: {
  filePath: string;
  logicalRows: number;
  departmentsPerRow?: number;
  batchSize?: number;
  tempDirectory?: string;
}) {
  const departmentsPerRow = params.departmentsPerRow ?? 3;
  const batchSize = params.batchSize ?? 1000;
  const workbook = createWorkbookStream({
    tempStorage: "file",
    tempDirectory: params.tempDirectory,
  });

  const table = await workbook.sheet("Financial Report | Full").table("financial-report", {
    schema: financialReportSchema,
  });

  for (let written = 0; written < params.logicalRows; written += batchSize) {
    const nextBatchSize = Math.min(batchSize, params.logicalRows - written);
    await table.commit({
      rows: generateFinancialReportData(nextBatchSize, departmentsPerRow),
    });
  }

  await workbook.writeToFile(params.filePath);
}

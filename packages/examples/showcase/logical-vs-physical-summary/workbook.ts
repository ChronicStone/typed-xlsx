import { createWorkbook } from "typed-xlsx";
import { createLogicalPhysicalRows } from "./data";
import { logicalVsPhysicalSummarySchema } from "./schema";

export function buildLogicalVsPhysicalSummaryWorkbook() {
  const workbook = createWorkbook();

  workbook
    .sheet("Logical vs Physical", {
      freezePane: { rows: 1, columns: 2 },
    })
    .table("logical-vs-physical", {
      title: "Logical Rows vs Physical Rows",
      rows: createLogicalPhysicalRows(),
      schema: logicalVsPhysicalSummarySchema,
    });

  return workbook.toUint8Array();
}

export const buildArtifact = buildLogicalVsPhysicalSummaryWorkbook;

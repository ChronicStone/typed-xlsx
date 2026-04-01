import { createWorkbook } from "@chronicstone/typed-xlsx";
import { createFulfillmentRows } from "./data";
import { fulfillmentExportSchema } from "./schema";

export function buildStreamingFulfillmentPreviewWorkbook() {
  const workbook = createWorkbook();

  workbook
    .sheet("Fulfillment Preview", {
      freezePane: { rows: 1 },
    })
    .table("preview", {
      rows: createFulfillmentRows(4),
      schema: fulfillmentExportSchema,
    });

  return workbook.toUint8Array();
}

export const buildArtifact = buildStreamingFulfillmentPreviewWorkbook;

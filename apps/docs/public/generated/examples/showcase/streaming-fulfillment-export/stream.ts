import { createWorkbookStream } from "@chronicstone/typed-xlsx";
import fs from "node:fs/promises";
import { createFulfillmentRows } from "./data";
import { fulfillmentExportSchema } from "./schema";

export async function buildStreamingFulfillmentExportWorkbook() {
  const workbook = createWorkbookStream({
    tempStorage: "memory",
  });

  const table = await workbook
    .sheet("Fulfillment Export", {
      freezePane: { rows: 1 },
    })
    .table("fulfillment", {
      schema: fulfillmentExportSchema,
    });

  for (let batch = 0; batch < 60; batch += 1) {
    await table.commit({ rows: createFulfillmentRows(12) });
  }

  const readable = workbook.toNodeReadable();
  const chunks: Buffer[] = [];

  for await (const chunk of readable) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function writeStreamingFulfillmentExportWorkbook(params: { filePath: string }) {
  const bytes = await buildStreamingFulfillmentExportWorkbook();
  await fs.writeFile(params.filePath, bytes);
}

export const buildArtifact = buildStreamingFulfillmentExportWorkbook;

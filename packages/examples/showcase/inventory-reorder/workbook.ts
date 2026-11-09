import { createWorkbook, spreadsheetThemes } from "typed-xlsx";
import { WEEKS, createStock } from "./data";
import { stockSchema } from "./schema";

export function buildInventoryReorder() {
  return createWorkbook()
    .sheet("Reorder plan", {
      freezePane: { rows: 3, columns: 3 },
      // Only the yellow cells can be edited; formulas and history stay locked.
      protection: { selectLockedCells: true, selectUnlockedCells: true },
    })
    .table("stock", {
      title: "Weekly reorder plan · week 44",
      schema: stockSchema,
      rows: createStock(),
      context: { weeks: WEEKS },
      theme: spreadsheetThemes.forest,
    })
    .toUint8Array();
}

export const buildArtifact = buildInventoryReorder;

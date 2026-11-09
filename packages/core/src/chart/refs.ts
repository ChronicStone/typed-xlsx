import { createChartTable } from "./table";
import type { ChartRefs } from "./types";

/** Runtime refs handed to chart callbacks. Validation happens when the workbook is written. */
export function createChartRefs(currentSheet: string): ChartRefs<any, string> {
  const sheetRefs = (sheet: string) => ({
    table: (tableId: string) => createChartTable(sheet, tableId),
  });
  return {
    ...sheetRefs(currentSheet),
    sheet: (sheetName: string) => sheetRefs(sheetName),
  } as unknown as ChartRefs<any, string>;
}

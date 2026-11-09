import { createChartTable, createPivotChartSource } from "./table";
import type { ChartRefs } from "./types";

/** Runtime refs handed to chart and pivot callbacks. Validation happens when the workbook is written. */
export function createChartRefs(currentSheet: string): ChartRefs<any, string> {
  const sheetRefs = (sheet: string) => ({
    table: (tableId: string) => createChartTable(sheet, tableId),
    pivot: (pivotId: string) => createPivotChartSource(sheet, pivotId),
  });
  return {
    ...sheetRefs(currentSheet),
    sheet: (sheetName: string) => sheetRefs(sheetName),
  } as unknown as ChartRefs<any, string>;
}

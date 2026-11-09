import { getCellPrimitiveValue } from "../../cell-data";
import {
  ChartTableIndex,
  resolveWorkbookCharts,
  type ChartSheetInput,
  type ResolvedChart,
} from "../../chart/resolve";
import type { ChartPlan } from "../../chart/types";
import type { BufferedSheetPlan, BufferedTablePlan, SheetLayoutOptions } from "../types";
import { layoutTables, type LayoutTableLike, type PositionedTable } from "./layout";
import { buildReportChrome } from "./report-chrome";

export interface WorkbookObjects {
  charts: ResolvedChart[][];
}

function bodyRowOffset(table: {
  excelTable?: unknown;
  planner: { columns: Array<{ groupPath?: Array<{ id: string; headerLabel: string }> }> };
  title?: string;
  render?: { groupHeaders?: boolean };
}) {
  if (table.excelTable) return 1;
  return buildReportChrome({
    columns: table.planner.columns.map((column) => ({ groupPath: column.groupPath ?? [] })),
    title: table.title,
    render: table.render,
  }).bodyRowOffset;
}

function sheetEndColumn(positioned: Array<PositionedTable<LayoutTableLike>>) {
  return positioned.reduce((max, table) => Math.max(max, table.columnOffset + table.width - 1), -1);
}

/** Resolves the charts of a buffered workbook, reading values from the planned rows. */
export function resolveBufferedWorkbookObjects(
  sheets: readonly BufferedSheetPlan[],
  worksheetNames: readonly string[],
): WorkbookObjects {
  if (!sheets.some((sheet) => (sheet.charts?.length ?? 0) > 0)) {
    return { charts: sheets.map(() => []) };
  }

  const index = new ChartTableIndex();
  const endColumns = sheets.map((sheet, sheetIndex) => {
    index.addSheet(sheet.name);
    const positioned = layoutTables({ layout: sheet.layout, tables: sheet.tables });
    for (const entry of positioned) {
      const table: BufferedTablePlan<any> = entry.table;
      const offset = bodyRowOffset(table);
      index.addTable(sheet.name, table.id, {
        worksheetName: worksheetNames[sheetIndex]!,
        headerRow: entry.rowOffset + offset - 1,
        bodyRow: entry.rowOffset + offset,
        columnOffset: entry.columnOffset,
        physicalRowCount: table.planner.rows.length,
        logicalRowCount: table.rowCount,
        columns: table.planner.columns,
        value: (row, column) =>
          getCellPrimitiveValue(table.planner.rows[row]!.cells[column]!.value),
      });
    }
    return sheetEndColumn(positioned);
  });

  const inputs: ChartSheetInput[] = sheets.map((sheet, sheetIndex) => ({
    name: sheet.name,
    charts: sheet.charts ?? [],
    tablesEndColumn: endColumns[sheetIndex]!,
  }));
  return { charts: resolveWorkbookCharts(inputs, index) };
}

export interface StreamChartTableInput {
  tableId: string;
  title?: string;
  render?: { groupHeaders?: boolean };
  excelTable?: { name: string };
  columns: Array<{
    id: string;
    headerLabel: string;
    scopeIds?: string[];
    groupPath?: Array<{ id: string; headerLabel: string }>;
    style?: unknown;
  }>;
  committedLogicalRows: number;
  committedPhysicalRows: number;
}

/** Resolves the charts of a streamed workbook. Rows are gone, so charts reference cells only. */
export function resolveStreamWorkbookObjects<
  TTable extends LayoutTableLike & StreamChartTableInput,
>(
  sheets: ReadonlyArray<{
    name: string;
    layout?: SheetLayoutOptions;
    tables: TTable[];
    charts: readonly ChartPlan[];
  }>,
  worksheetNames: readonly string[],
): WorkbookObjects {
  if (!sheets.some((sheet) => sheet.charts.length > 0)) {
    return { charts: sheets.map(() => []) };
  }

  const index = new ChartTableIndex();
  const endColumns = sheets.map((sheet, sheetIndex) => {
    index.addSheet(sheet.name);
    const positioned = layoutTables({ layout: sheet.layout, tables: sheet.tables });
    for (const entry of positioned) {
      const table = entry.table;
      const offset = bodyRowOffset({
        excelTable: table.excelTable,
        planner: { columns: table.columns },
        title: table.title,
        render: table.render,
      });
      index.addTable(sheet.name, table.tableId, {
        worksheetName: worksheetNames[sheetIndex]!,
        headerRow: entry.rowOffset + offset - 1,
        bodyRow: entry.rowOffset + offset,
        columnOffset: entry.columnOffset,
        physicalRowCount: table.committedPhysicalRows,
        logicalRowCount: table.committedLogicalRows,
        columns: table.columns,
      });
    }
    return sheetEndColumn(positioned);
  });

  const inputs: ChartSheetInput[] = sheets.map((sheet, sheetIndex) => ({
    name: sheet.name,
    charts: sheet.charts,
    tablesEndColumn: endColumns[sheetIndex]!,
  }));
  return { charts: resolveWorkbookCharts(inputs, index) };
}

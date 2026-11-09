import { getCellPrimitiveValue } from "../../cell-data";
import {
  ChartTableIndex,
  resolveWorkbookCharts,
  type ChartSheetInput,
  type ResolvedChart,
} from "../../chart/resolve";
import type { ChartPlan } from "../../chart/types";
import { layoutPivot, PivotAccumulator, type PivotSourceValue } from "../../pivot/engine";
import type { PivotPlan } from "../../pivot/types";
import { toCellRef } from "../../ooxml/cells";
import type { StylesCollector } from "../../styles/collector";
import type { SpreadsheetTheme } from "../../styles/theme";
import type { BufferedSheetPlan, BufferedTablePlan, SheetLayoutOptions } from "../types";
import { layoutTables, type LayoutTableLike, type PositionedTable } from "./layout";
import {
  createPivotDefinition,
  pivotCacheSource,
  pivotValueOf,
  PivotPlacer,
  type CellArea,
  renderPivot,
  type PivotSourceColumn,
  type RenderedPivot,
} from "./pivots";
import { buildReportChrome } from "./report-chrome";

export interface WorkbookObjects {
  charts: ResolvedChart[][];
  pivots: RenderedPivot[][];
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

function sheetExtent(positioned: Array<PositionedTable<LayoutTableLike>>) {
  return {
    endColumn: positioned.reduce(
      (max, table) => Math.max(max, table.columnOffset + table.width - 1),
      -1,
    ),
    bottomRow: positioned.reduce(
      (max, table) => Math.max(max, table.rowOffset + table.height - 1),
      -1,
    ),
    areas: positioned.map((table) => ({
      top: table.rowOffset,
      left: table.columnOffset,
      bottom: table.rowOffset + table.height - 1,
      right: table.columnOffset + table.width - 1,
    })),
  };
}

interface PivotSource {
  worksheetName: string;
  excelTableName?: string;
  headerRow: number;
  bodyRow: number;
  columnOffset: number;
  columns: PivotSourceColumn[];
  physicalRowCount: number;
  logicalRowCount: number;
  read?: (row: number, column: number) => PivotSourceValue;
  /** Theme of the table, which its pivots follow unless they name a style or a theme. */
  theme?: SpreadsheetTheme;
}

class PivotSources {
  private readonly sources = new Map<string, PivotSource[]>();
  private readonly sheetCounts = new Map<string, number>();

  addSheet(name: string) {
    this.sheetCounts.set(name, (this.sheetCounts.get(name) ?? 0) + 1);
  }

  add(sheet: string, table: string, source: PivotSource) {
    const key = `${sheet}\u0000${table}`;
    this.sources.set(key, [...(this.sources.get(key) ?? []), source]);
  }

  locate(pivotId: string, sheet: string, table: string) {
    if ((this.sheetCounts.get(sheet) ?? 0) > 1) {
      throw new Error(
        `Pivot "${pivotId}": sheet "${sheet}" is declared more than once, so "${sheet}/${table}" is ambiguous.`,
      );
    }
    const entries = this.sources.get(`${sheet}\u0000${table}`) ?? [];
    if (entries.length !== 1) {
      throw new Error(
        entries.length === 0
          ? `Pivot "${pivotId}": no table "${table}" on sheet "${sheet}".`
          : `Pivot "${pivotId}": sheet "${sheet}" has several tables with id "${table}".`,
      );
    }
    const source = entries[0]!;
    if (source.physicalRowCount !== source.logicalRowCount) {
      throw new Error(
        `Pivot "${pivotId}": table "${sheet}/${table}" expands rows into sub-rows, which pivots do not support.`,
      );
    }
    return source;
  }
}

function staticFormat(style: unknown) {
  return typeof style === "object" && style !== null
    ? ((style as { numFmt?: string }).numFmt ?? undefined)
    : undefined;
}

/** Places a sheet's pivots, filling accumulators from source cells when they are still known. */
function placePivots(params: {
  sheetName: string;
  worksheetName: string;
  plans: ReadonlyArray<PivotPlan & { accumulator?: PivotAccumulator }>;
  sources: PivotSources;
  index: ChartTableIndex;
  tablesBottomRow: number;
  tableAreas: ReadonlyArray<CellArea>;
  nextCacheIndex: () => number;
  styles: StylesCollector;
}) {
  const placer = new PivotPlacer(params.tablesBottomRow, params.tableAreas);
  return params.plans.map((plan) => {
    const source = params.sources.locate(plan.id, plan.spec.source.sheet, plan.spec.source.table);
    let accumulator = plan.accumulator;
    if (!accumulator) {
      accumulator = new PivotAccumulator(
        createPivotDefinition(plan.id, plan.spec, source.columns, source.theme),
      );
      for (let row = 0; row < source.physicalRowCount; row += 1) {
        accumulator.add((column) => source.read!(row, column));
      }
    }
    const layout = layoutPivot(accumulator);
    const anchor = placer.place(plan.id, plan.spec.options.at, layout);
    const rendered = renderPivot({
      accumulator,
      layout,
      anchor,
      cacheIndex: params.nextCacheIndex(),
      styles: params.styles,
      source: pivotCacheSource({
        worksheetName: source.worksheetName,
        excelTableName: source.excelTableName,
        headerRow: source.headerRow,
        bodyRow: source.bodyRow,
        columnOffset: source.columnOffset,
        columnCount: source.columns.length,
        rowCount: source.physicalRowCount,
        toCellRef,
      }),
    });
    params.index.addPivot(params.sheetName, plan.id, {
      worksheetName: params.worksheetName,
      name: plan.id,
      anchor,
      layout,
    });
    return rendered;
  });
}

/** Resolves the pivots and charts of a buffered workbook, reading values from the planned rows. */
export function resolveBufferedWorkbookObjects(
  sheets: readonly BufferedSheetPlan[],
  worksheetNames: readonly string[],
  styles: StylesCollector,
): WorkbookObjects {
  if (!sheets.some((sheet) => (sheet.charts?.length ?? 0) + (sheet.pivots?.length ?? 0) > 0)) {
    return { charts: sheets.map(() => []), pivots: sheets.map(() => []) };
  }

  const index = new ChartTableIndex();
  const sources = new PivotSources();
  const extents = sheets.map((sheet, sheetIndex) => {
    index.addSheet(sheet.name);
    sources.addSheet(sheet.name);
    const positioned = layoutTables({ layout: sheet.layout, tables: sheet.tables });
    for (const entry of positioned) {
      const table: BufferedTablePlan<any> = entry.table;
      const offset = bodyRowOffset(table);
      const location = {
        worksheetName: worksheetNames[sheetIndex]!,
        headerRow: entry.rowOffset + offset - 1,
        bodyRow: entry.rowOffset + offset,
        columnOffset: entry.columnOffset,
        physicalRowCount: table.planner.rows.length,
        logicalRowCount: table.rowCount,
        ...(table.excelTable ? { excelTableName: table.excelTable.name } : {}),
      };
      index.addTable(sheet.name, table.id, {
        ...location,
        columns: table.planner.columns,
        value: (row, column) =>
          getCellPrimitiveValue(table.planner.rows[row]!.cells[column]!.value),
      });
      sources.add(sheet.name, table.id, {
        ...location,
        columns: table.planner.columns.map((column) => ({
          id: column.id,
          headerLabel: column.headerLabel,
          format: staticFormat(column.style),
        })),
        read: (row, column) => pivotValueOf(table.planner.rows[row]!.cells[column]?.value),
        theme: table.theme,
      });
    }
    return sheetExtent(positioned);
  });

  let cacheIndex = 0;
  const pivots = sheets.map((sheet, sheetIndex) =>
    placePivots({
      sheetName: sheet.name,
      worksheetName: worksheetNames[sheetIndex]!,
      plans: sheet.pivots ?? [],
      sources,
      index,
      tablesBottomRow: extents[sheetIndex]!.bottomRow,
      tableAreas: extents[sheetIndex]!.areas,
      nextCacheIndex: () => (cacheIndex += 1),
      styles,
    }),
  );

  const inputs: ChartSheetInput[] = sheets.map((sheet, sheetIndex) => ({
    name: sheet.name,
    charts: sheet.charts ?? [],
    tablesEndColumn: Math.max(
      extents[sheetIndex]!.endColumn,
      ...pivots[sheetIndex]!.map((pivot) => pivot.lastCol),
    ),
  }));
  return { charts: resolveWorkbookCharts(inputs, index), pivots };
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

export interface StreamPivotPlan extends PivotPlan {
  accumulator: PivotAccumulator;
}

/** Resolves the pivots and charts of a streamed workbook. Rows are gone, so pivots were tallied as they arrived. */
export function resolveStreamWorkbookObjects<
  TTable extends LayoutTableLike & StreamChartTableInput,
>(
  sheets: ReadonlyArray<{
    name: string;
    layout?: SheetLayoutOptions;
    tables: TTable[];
    charts: readonly ChartPlan[];
    pivots: readonly StreamPivotPlan[];
  }>,
  worksheetNames: readonly string[],
  styles: StylesCollector,
): WorkbookObjects {
  if (!sheets.some((sheet) => sheet.charts.length + sheet.pivots.length > 0)) {
    return { charts: sheets.map(() => []), pivots: sheets.map(() => []) };
  }

  const index = new ChartTableIndex();
  const sources = new PivotSources();
  const extents = sheets.map((sheet, sheetIndex) => {
    index.addSheet(sheet.name);
    sources.addSheet(sheet.name);
    const positioned = layoutTables({ layout: sheet.layout, tables: sheet.tables });
    for (const entry of positioned) {
      const table = entry.table;
      const offset = bodyRowOffset({
        excelTable: table.excelTable,
        planner: { columns: table.columns },
        title: table.title,
        render: table.render,
      });
      const location = {
        worksheetName: worksheetNames[sheetIndex]!,
        headerRow: entry.rowOffset + offset - 1,
        bodyRow: entry.rowOffset + offset,
        columnOffset: entry.columnOffset,
        physicalRowCount: table.committedPhysicalRows,
        logicalRowCount: table.committedLogicalRows,
        ...(table.excelTable ? { excelTableName: table.excelTable.name } : {}),
      };
      index.addTable(sheet.name, table.tableId, { ...location, columns: table.columns });
      sources.add(sheet.name, table.tableId, {
        ...location,
        columns: table.columns.map((column) => ({
          id: column.id,
          headerLabel: column.headerLabel,
          format: staticFormat(column.style),
        })),
      });
    }
    return sheetExtent(positioned);
  });

  let cacheIndex = 0;
  const pivots = sheets.map((sheet, sheetIndex) =>
    placePivots({
      sheetName: sheet.name,
      worksheetName: worksheetNames[sheetIndex]!,
      plans: sheet.pivots,
      sources,
      index,
      tablesBottomRow: extents[sheetIndex]!.bottomRow,
      tableAreas: extents[sheetIndex]!.areas,
      nextCacheIndex: () => (cacheIndex += 1),
      styles,
    }),
  );

  const inputs: ChartSheetInput[] = sheets.map((sheet, sheetIndex) => ({
    name: sheet.name,
    charts: sheet.charts,
    tablesEndColumn: Math.max(
      extents[sheetIndex]!.endColumn,
      ...pivots[sheetIndex]!.map((pivot) => pivot.lastCol),
    ),
  }));
  return { charts: resolveWorkbookCharts(inputs, index), pivots };
}

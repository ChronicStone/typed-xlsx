import { groupSummaryRows } from "./summaries";
import type { PlannedMergeRange } from "../../planner/rows";
import type { SheetLayoutOptions } from "../types";
import type { PlannedSummaryCell } from "../types";
import { buildReportChrome } from "./report-chrome";

export interface LayoutTableLike {
  autoFilter: boolean;
  excelTable?: { totalsRow?: boolean };
  title?: string;
  render?: { groupHeaders?: boolean };
  planner: {
    columns: Array<{ id: string; groupPath?: Array<{ id: string; headerLabel: string }> }>;
    merges: PlannedMergeRange[];
    rows: Array<unknown>;
    stats: {
      columnWidths: Map<string, number>;
    };
  };
  summaries: PlannedSummaryCell[];
}

export interface PositionedTable<TTable extends LayoutTableLike> {
  table: TTable;
  rowOffset: number;
  columnOffset: number;
  width: number;
  height: number;
}

export interface PositionedMergeRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export function getTableHeight(table: LayoutTableLike) {
  const reportChrome = table.excelTable
    ? undefined
    : buildReportChrome({
        columns: table.planner.columns.map((column) => ({ groupPath: column.groupPath ?? [] })),
        title: table.title,
        render: table.render,
      });

  return (
    (reportChrome?.headerHeight ?? 1) +
    table.planner.rows.length +
    groupSummaryRows(table.summaries).length +
    (table.excelTable?.totalsRow ? 1 : 0)
  );
}

export function layoutTables<TTable extends LayoutTableLike>(params: {
  layout?: SheetLayoutOptions;
  tables: TTable[];
}) {
  const tablesPerRow = Math.max(params.layout?.tablesPerRow ?? 1, 1);
  const columnGap = Math.max(params.layout?.tableColumnGap ?? 1, 0);
  const rowGap = Math.max(params.layout?.tableRowGap ?? 1, 0);
  const positioned: PositionedTable<TTable>[] = [];

  let rowOffset = 0;

  for (let index = 0; index < params.tables.length; index += tablesPerRow) {
    const chunk = params.tables.slice(index, index + tablesPerRow);
    let columnOffset = 0;
    let maxChunkHeight = 0;

    for (const table of chunk) {
      const width = table.planner.columns.length;
      const height = getTableHeight(table);
      positioned.push({
        table,
        rowOffset,
        columnOffset,
        width,
        height,
      });

      columnOffset += width + columnGap;
      maxChunkHeight = Math.max(maxChunkHeight, height);
    }

    rowOffset += maxChunkHeight + rowGap;
  }

  return positioned;
}

export function positionTableMerges<TTable extends LayoutTableLike>(
  positioned: PositionedTable<TTable>,
) {
  const reportChrome = positioned.table.excelTable
    ? undefined
    : buildReportChrome({
        columns: positioned.table.planner.columns.map((column) => ({
          groupPath: column.groupPath ?? [],
        })),
        title: positioned.table.title,
        render: positioned.table.render,
      });

  return positioned.table.planner.merges.map((merge) => ({
    startRow: positioned.rowOffset + (reportChrome?.bodyRowOffset ?? 1) + merge.startRow,
    endRow: positioned.rowOffset + (reportChrome?.bodyRowOffset ?? 1) + merge.endRow,
    startCol: positioned.columnOffset + merge.startCol,
    endCol: positioned.columnOffset + merge.endCol,
  })) satisfies PositionedMergeRange[];
}

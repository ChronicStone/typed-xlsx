import { groupSummaryRows } from "./summaries";
import type { PlannedMergeRange } from "../../planner/rows";
import type { SheetLayoutOptions } from "../types";
import type { PlannedSummaryCell } from "../types";

export interface LayoutTableLike {
  autoFilter: boolean;
  excelTable?: { totalsRow?: boolean };
  planner: {
    columns: Array<{ id: string }>;
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
  return (
    1 +
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
  return positioned.table.planner.merges.map((merge) => ({
    startRow: positioned.rowOffset + 1 + merge.startRow,
    endRow: positioned.rowOffset + 1 + merge.endRow,
    startCol: positioned.columnOffset + merge.startCol,
    endCol: positioned.columnOffset + merge.endCol,
  })) satisfies PositionedMergeRange[];
}

import type { BufferedSheetPlan, BufferedTablePlan } from "../workbook/types";
import type { PlannedCell, ResolvedColumn } from "../planner/rows";
import type { CellStyle } from "../styles/types";
import { StylesCollector } from "../styles/collector";
import { serializeCell } from "./cells";
import type { SharedStringsCollector } from "./shared-strings";
import { xmlDocument, xmlElement, xmlSelfClosing } from "./xml";
import { getDefaultRowHeight } from "../planner/metrics";
import {
  withDefaultBodyStyle,
  withDefaultHeaderStyle,
  withDefaultSummaryStyle,
} from "../styles/defaults";
import {
  createWorksheetRowNode,
  writeWorksheetColumns,
  writeWorksheetViews,
  writeWorksheetMerges,
  type WorksheetColumnDefinition,
} from "./worksheet-parts";
import { groupSummaryRows } from "../workbook/internal/summaries";

interface PositionedTable {
  table: BufferedTablePlan<any>;
  rowOffset: number;
  columnOffset: number;
  width: number;
  height: number;
}

interface PositionedMergeRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

function getTableHeight(table: BufferedTablePlan<any>) {
  return 1 + table.planner.rows.length + groupSummaryRows(table.summaries).length;
}

export function writeWorksheetXml(
  sheet: BufferedSheetPlan,
  sharedStrings: SharedStringsCollector,
  styles: StylesCollector,
) {
  const rowMap = new Map<number, string[]>();
  const rowHeights = new Map<number, number>();
  const positionedTables = layoutTables(sheet);
  const merges: PositionedMergeRange[] = [];

  for (const positioned of positionedTables) {
    writeTableIntoRowMap(rowMap, rowHeights, positioned, sharedStrings, styles);
    merges.push(...positionTableMerges(positioned));
  }

  const sortedRows = [...rowMap.entries()].sort(([left], [right]) => left - right);
  const rowNodes = sortedRows.map(([rowIndex, cells]) =>
    createWorksheetRowNode(rowIndex, cells, rowHeights.get(rowIndex)),
  );
  const endRow = sortedRows.length > 0 ? sortedRows[sortedRows.length - 1]![0] : 0;
  const endCol = positionedTables.reduce((max, positioned) => {
    return Math.max(max, positioned.columnOffset + positioned.width - 1);
  }, 0);

  return xmlDocument(
    "worksheet",
    {
      xmlns: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    },
    [
      xmlSelfClosing("dimension", {
        ref: `A1:${endCol >= 0 ? toWorksheetCol(endCol) : "A"}${endRow + 1}`,
      }),
      writeWorksheetViews(sheet.view),
      xmlSelfClosing("sheetFormatPr", { defaultRowHeight: getDefaultRowHeight() }),
      writeWorksheetColumns(buildWorksheetColumns(positionedTables)),
      xmlElement("sheetData", undefined, rowNodes),
      writeWorksheetMerges(merges),
    ],
  );
}

function layoutTables(sheet: BufferedSheetPlan): PositionedTable[] {
  const tablesPerRow = Math.max(sheet.layout?.tablesPerRow ?? 1, 1);
  const columnGap = Math.max(sheet.layout?.tableColumnGap ?? 1, 0);
  const rowGap = Math.max(sheet.layout?.tableRowGap ?? 1, 0);
  const positioned: PositionedTable[] = [];

  let rowOffset = 0;

  for (let index = 0; index < sheet.tables.length; index += tablesPerRow) {
    const chunk = sheet.tables.slice(index, index + tablesPerRow);
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

function writeTableIntoRowMap(
  rowMap: Map<number, string[]>,
  rowHeights: Map<number, number>,
  positioned: PositionedTable,
  sharedStrings: SharedStringsCollector,
  styles: StylesCollector,
) {
  const { table, rowOffset, columnOffset } = positioned;
  rowHeights.set(rowOffset, getDefaultRowHeight());

  writeCells(
    rowMap,
    rowOffset,
    table.planner.columns.map((column, columnIndex) =>
      serializeCell(
        rowOffset,
        columnOffset + columnIndex,
        column.headerLabel,
        sharedStrings,
        styles.addStyle(withDefaultHeaderStyle(column.headerStyle)),
      ),
    ),
  );

  table.planner.rows.forEach((row, rowIndex) => {
    const sheetRowIndex = rowOffset + 1 + rowIndex;
    rowHeights.set(sheetRowIndex, Math.max(rowHeights.get(sheetRowIndex) ?? 0, row.height));
    writeCells(
      rowMap,
      sheetRowIndex,
      row.cells.map((cell, columnIndex) =>
        serializeCell(
          sheetRowIndex,
          columnOffset + columnIndex,
          cell.value,
          sharedStrings,
          styles.addStyle(
            withDefaultBodyStyle(resolveDataCellStyle(table.planner.columns[columnIndex], cell)),
          ),
        ),
      ),
    );
  });

  const summaryRows = groupSummaryRows(table.summaries);
  summaryRows.forEach((summaryRow, summaryRowIndex) => {
    const worksheetRowIndex = rowOffset + 1 + table.planner.rows.length + summaryRowIndex;
    rowHeights.set(worksheetRowIndex, getDefaultRowHeight());
    const summariesByColumn = new Map(summaryRow.map((summary) => [summary.columnId, summary]));
    writeCells(
      rowMap,
      worksheetRowIndex,
      table.planner.columns.flatMap((column, columnIndex) => {
        const summary = summariesByColumn.get(column.id);
        if (!summary) {
          return [];
        }

        return [
          serializeCell(
            worksheetRowIndex,
            columnOffset + columnIndex,
            summary.value,
            sharedStrings,
            styles.addStyle(withDefaultSummaryStyle(summary.style)),
          ),
        ];
      }),
    );
  });
}

function resolveDataCellStyle<T extends object>(
  column: ResolvedColumn<T> | undefined,
  cell: PlannedCell<T>,
): CellStyle | undefined {
  if (!column?.style) return undefined;
  if (typeof column.style === "function") {
    return column.style(cell.sourceRow, cell.sourceRowIndex, cell.subRowIndex);
  }
  return column.style;
}

function positionTableMerges(positioned: PositionedTable): PositionedMergeRange[] {
  return positioned.table.planner.merges.map((merge) => ({
    startRow: positioned.rowOffset + 1 + merge.startRow,
    endRow: positioned.rowOffset + 1 + merge.endRow,
    startCol: positioned.columnOffset + merge.startCol,
    endCol: positioned.columnOffset + merge.endCol,
  }));
}

function buildWorksheetColumns(positionedTables: PositionedTable[]): WorksheetColumnDefinition[] {
  return positionedTables.flatMap((positioned) =>
    positioned.table.planner.columns.map((column, columnIndex) => {
      const width = positioned.table.planner.stats.columnWidths.get(column.id) ?? column.width ?? 8;
      return {
        index: positioned.columnOffset + columnIndex,
        width,
      };
    }),
  );
}

function writeCells(rowMap: Map<number, string[]>, rowIndex: number, cells: string[]) {
  const existing = rowMap.get(rowIndex);
  if (existing) {
    existing.push(...cells);
    return;
  }

  rowMap.set(rowIndex, [...cells]);
}

function toWorksheetCol(column: number) {
  if (column <= 0) return "A";
  let result = "";
  let current = column;

  do {
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return result;
}

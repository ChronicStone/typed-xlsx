import {
  serializeExcelTotalsRowFormula,
  type BufferedSheetPlan,
  type BufferedTablePlan,
} from "../workbook/types";
import type { PlannedCell, ResolvedColumn } from "../planner/rows";
import type { CellStyle } from "../styles/types";
import { StylesCollector } from "../styles/collector";
import { serializeCell, toCellRef } from "./cells";
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
  writeWorksheetAutoFilter,
  writeWorksheetColumns,
  writeWorksheetConditionalFormatting,
  writeWorksheetDataValidations,
  writeWorksheetViews,
  writeWorksheetMerges,
  type WorksheetAutoFilterRange,
  type WorksheetColumnDefinition,
} from "./worksheet-parts";
import { writeExcelTableXml, writeWorksheetTableParts, type WorksheetTablePart } from "./table";
import { groupSummaryRows } from "../workbook/internal/summaries";
import { resolveSummaryValue } from "../workbook/internal/summaries";
import {
  layoutTables,
  positionTableMerges,
  type PositionedMergeRange,
  type PositionedTable,
} from "../workbook/internal/layout";

export function serializeWorksheet(
  sheet: BufferedSheetPlan,
  sharedStrings: SharedStringsCollector,
  styles: StylesCollector,
  startingTableIndex = 0,
) {
  const rowMap = new Map<number, string[]>();
  const rowHeights = new Map<number, number>();
  const positionedTables = layoutTables({ layout: sheet.layout, tables: sheet.tables });
  const merges: PositionedMergeRange[] = [];
  const autoFilter = resolveSheetAutoFilter(positionedTables);
  const tableParts = buildWorksheetTableParts(positionedTables, startingTableIndex);
  const conditionalFormatting = positionedTables.flatMap((positioned) =>
    buildPositionedConditionalFormatting(
      positioned.table.conditionalFormatting,
      positioned.columnOffset,
      positioned.rowOffset,
    ),
  );
  const dataValidations = positionedTables.flatMap((positioned) =>
    buildPositionedDataValidations(
      positioned.table.dataValidations,
      positioned.columnOffset,
      positioned.rowOffset,
    ),
  );

  for (const positioned of positionedTables) {
    writeTableIntoRowMap(
      rowMap,
      rowHeights,
      positioned,
      sharedStrings,
      styles,
      conditionalFormatting,
    );
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

  return {
    xml: xmlDocument(
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
        writeWorksheetAutoFilter(autoFilter),
        writeWorksheetConditionalFormatting(conditionalFormatting, styles),
        writeWorksheetDataValidations(dataValidations),
        writeWorksheetMerges(merges),
        writeWorksheetTableParts(tableParts),
      ],
    ),
    tableParts,
  };
}

export function writeWorksheetXml(
  sheet: BufferedSheetPlan,
  sharedStrings: SharedStringsCollector,
  styles: StylesCollector,
) {
  return serializeWorksheet(sheet, sharedStrings, styles).xml;
}

export function buildWorksheetTableParts(
  positionedTables: PositionedTable<BufferedTablePlan<any>>[],
  startingTableIndex = 0,
): WorksheetTablePart[] {
  const parts: WorksheetTablePart[] = [];
  let worksheetTableIndex = 0;

  positionedTables.forEach((positioned) => {
    if (!positioned.table.excelTable) {
      return;
    }

    worksheetTableIndex += 1;
    const tableIndex = startingTableIndex + worksheetTableIndex;

    parts.push({
      id: `table${tableIndex}`,
      relId: `rIdTable${worksheetTableIndex}`,
      path: `xl/tables/table${tableIndex}.xml`,
      xml: writeExcelTableXml({
        tableId: tableIndex,
        displayName: positioned.table.excelTable.name,
        reference: {
          startRow: positioned.rowOffset,
          endRow: positioned.rowOffset + positioned.table.planner.rows.length,
          startCol: positioned.columnOffset,
          endCol: positioned.columnOffset + positioned.width - 1,
        },
        columns: positioned.table.planner.columns.map((column) => ({
          id: column.id,
          headerLabel: column.headerLabel,
        })),
        options: positioned.table.excelTable,
      }),
    });
  });

  return parts;
}

function resolveSheetAutoFilter(
  positionedTables: PositionedTable<BufferedTablePlan<any>>[],
): WorksheetAutoFilterRange | undefined {
  const autoFilteredTables = positionedTables.filter((positioned) => positioned.table.autoFilter);

  if (autoFilteredTables.length === 0) {
    return undefined;
  }

  if (autoFilteredTables.length > 1) {
    throw new Error(
      "Buffered worksheets can only apply autoFilter to one report table per sheet. Worksheet-level autoFilter supports a single contiguous range; if you need multiple filtered tables on the same sheet, use native Excel tables instead.",
    );
  }

  const positioned = autoFilteredTables[0]!;

  return {
    startRow: positioned.rowOffset,
    endRow: positioned.rowOffset + positioned.height - 1,
    startCol: positioned.columnOffset,
    endCol: positioned.columnOffset + positioned.width - 1,
  };
}

function writeTableIntoRowMap(
  rowMap: Map<number, string[]>,
  rowHeights: Map<number, number>,
  positioned: PositionedTable<BufferedTablePlan<any>>,
  sharedStrings: SharedStringsCollector,
  styles: StylesCollector,
  conditionalFormatting: BufferedTablePlan<any>["conditionalFormatting"],
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
            resolveSummaryValue({
              definition: column.summary?.[summary.summaryIndex]!,
              value: summary.value,
              formulaContext: {
                startRow: rowOffset + 1,
                endRow: rowOffset + table.planner.rows.length,
                column: columnOffset + columnIndex,
              },
            }),
            sharedStrings,
            summary.unstyled ? undefined : styles.addStyle(withDefaultSummaryStyle(summary.style)),
          ),
        ];
      }),
    );

    summaryRow.forEach((summary) => {
      const columnIndex = table.planner.columns.findIndex(
        (column) => column.id === summary.columnId,
      );
      if (columnIndex < 0 || !summary.conditionalFormatting) {
        return;
      }

      conditionalFormatting?.push(
        ...materializeSummaryConditionalFormatting(
          summary.conditionalFormatting,
          worksheetRowIndex,
          columnOffset + columnIndex,
        ),
      );
    });
  });

  if (table.excelTable?.totalsRow) {
    const excelTable = table.excelTable;
    const worksheetRowIndex = rowOffset + 1 + table.planner.rows.length;
    rowHeights.set(worksheetRowIndex, getDefaultRowHeight());
    writeCells(
      rowMap,
      worksheetRowIndex,
      table.planner.columns.flatMap((column, columnIndex) => {
        const totalsRow = excelTable.totalsRowColumns[columnIndex]?.totalsRow;
        if (!totalsRow) {
          return [];
        }

        const value =
          "label" in totalsRow
            ? totalsRow.label
            : {
                kind: "formula" as const,
                formula: serializeExcelTotalsRowFormula(
                  excelTable.name,
                  excelTable.totalsRowColumns[columnIndex]?.headerLabel ?? column.headerLabel,
                  totalsRow.function,
                )!,
              };

        return [
          serializeCell(
            worksheetRowIndex,
            columnOffset + columnIndex,
            value,
            sharedStrings,
            styles.addStyle(
              withDefaultSummaryStyle(
                typeof column.style === "function" ? undefined : column.style,
              ),
            ),
          ),
        ];
      }),
    );
  }
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

function buildWorksheetColumns(
  positionedTables: PositionedTable<BufferedTablePlan<any>>[],
): WorksheetColumnDefinition[] {
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

function buildPositionedConditionalFormatting(
  blocks: BufferedTablePlan<any>["conditionalFormatting"] | undefined,
  columnOffset: number,
  rowOffset: number,
) {
  if (!blocks || blocks.length === 0) {
    return [];
  }

  return blocks.map((block) => ({
    ...block,
    ref: shiftWorksheetRange(block.ref, rowOffset, columnOffset),
  }));
}

function buildPositionedDataValidations(
  blocks: BufferedTablePlan<any>["dataValidations"] | undefined,
  columnOffset: number,
  rowOffset: number,
) {
  if (!blocks || blocks.length === 0) {
    return [];
  }

  return blocks.map((block) => ({
    ...block,
    ref: shiftWorksheetRange(block.ref, rowOffset, columnOffset),
  }));
}

function materializeSummaryConditionalFormatting(
  blocks: BufferedTablePlan<any>["conditionalFormatting"] | undefined,
  worksheetRowIndex: number,
  worksheetColumnIndex: number,
) {
  if (!blocks || blocks.length === 0) {
    return [];
  }

  const ref = toCellRef(worksheetRowIndex, worksheetColumnIndex);

  return blocks.map((block) => ({
    ...block,
    ref,
    rules: block.rules.map((rule) => ({
      ...rule,
      formula: rule.formula.replaceAll("A1", ref),
    })),
  }));
}

function shiftWorksheetRange(ref: string, rowOffset: number, columnOffset: number) {
  const [start, end] = ref.split(":");
  if (!start || !end) {
    return ref;
  }

  return `${shiftCellRef(start, rowOffset, columnOffset)}:${shiftCellRef(end, rowOffset, columnOffset)}`;
}

function shiftCellRef(ref: string, rowOffset: number, columnOffset: number) {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    return ref;
  }

  const [, col, row] = match;
  if (!col || !row) {
    return ref;
  }

  return `${toWorksheetCol(fromWorksheetCol(col) + columnOffset)}${Number(row) + rowOffset}`;
}

function fromWorksheetCol(column: string) {
  let value = 0;

  for (const char of column) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }

  return value - 1;
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

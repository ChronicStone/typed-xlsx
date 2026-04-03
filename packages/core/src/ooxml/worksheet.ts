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
  withTableDefaultBodyStyle,
  withTableDefaultGroupHeaderFillerStyle,
  withTableDefaultGroupHeaderStyle,
  withTableDefaultHeaderStyle,
  withTableDefaultHyperlinkBodyStyle,
  withTableDefaultTitleStyle,
  withTableDefaultSummaryStyle,
} from "../styles/defaults";
import {
  createWorksheetRowNode,
  partitionWorksheetHyperlinks,
  writeWorksheetAutoFilter,
  writeWorksheetColumns,
  writeWorksheetConditionalFormatting,
  writeWorksheetDataValidations,
  writeWorksheetHyperlinks,
  writeWorksheetProtection,
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
import { buildReportChrome, shiftFormulaA1Refs } from "../workbook/internal/report-chrome";

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
      positioned.rowOffset + getReportChrome(positioned.table).bodyRowOffset - 1,
    ),
  );
  const dataValidations = positionedTables.flatMap((positioned) =>
    buildPositionedDataValidations(
      positioned.table.dataValidations,
      positioned.columnOffset,
      positioned.rowOffset + getReportChrome(positioned.table).bodyRowOffset - 1,
    ),
  );
  const hyperlinks = positionedTables.flatMap((positioned) =>
    buildPositionedHyperlinks(
      positioned.table.hyperlinks ?? [],
      positioned.columnOffset,
      positioned.rowOffset + getReportChrome(positioned.table).bodyRowOffset - 1,
    ),
  );
  const partitionedHyperlinks = partitionWorksheetHyperlinks(hyperlinks);

  for (const positioned of positionedTables) {
    const chrome = getReportChrome(positioned.table);
    writeTableIntoRowMap(
      rowMap,
      rowHeights,
      positioned,
      sharedStrings,
      styles,
      conditionalFormatting,
    );
    if (chrome.titleMerge) {
      merges.push({
        startRow: positioned.rowOffset + chrome.titleMerge.startRow,
        endRow: positioned.rowOffset + chrome.titleMerge.endRow,
        startCol: positioned.columnOffset + chrome.titleMerge.startCol,
        endCol: positioned.columnOffset + chrome.titleMerge.endCol,
      });
    }
    merges.push(
      ...chrome.groupHeaderMerges.map((merge) => ({
        startRow: positioned.rowOffset + merge.startRow,
        endRow: positioned.rowOffset + merge.endRow,
        startCol: positioned.columnOffset + merge.startCol,
        endCol: positioned.columnOffset + merge.endCol,
      })),
    );
    merges.push(...positionTableMerges(positioned));
  }

  const sortedRows = [...rowMap.entries()].sort(([left], [right]) => left - right);
  const rowNodes = sortedRows.map(([rowIndex, cells]) =>
    createWorksheetRowNode(rowIndex, sortWorksheetCells(cells), rowHeights.get(rowIndex)),
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
        writeWorksheetProtection(sheet.protection),
        writeWorksheetAutoFilter(autoFilter),
        writeWorksheetMerges(merges),
        writeWorksheetConditionalFormatting(conditionalFormatting, styles),
        writeWorksheetDataValidations(dataValidations),
        writeWorksheetHyperlinks(partitionedHyperlinks.worksheetHyperlinks),
        writeWorksheetTableParts(tableParts),
      ],
    ),
    tableParts,
    hyperlinks: partitionedHyperlinks.worksheetHyperlinks,
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
  const chrome = getReportChrome(positioned.table);

  return {
    startRow: positioned.rowOffset + chrome.autoFilterRowOffset,
    endRow: positioned.rowOffset + positioned.height - 1,
    startCol: positioned.columnOffset,
    endCol: positioned.columnOffset + positioned.width - 1,
  };
}

function buildPositionedHyperlinks(
  hyperlinks: import("../workbook/types").WorksheetHyperlink[],
  columnOffset: number,
  rowOffset: number,
) {
  return hyperlinks.map((hyperlink) => ({
    ...hyperlink,
    ref: shiftRef(hyperlink.ref, columnOffset, rowOffset),
  }));
}

function shiftRef(ref: string, columnOffset: number, rowOffset: number) {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return ref;
  const [, col, row] = match;
  if (!col || !row) return ref;
  return `${toWorksheetCol(fromWorksheetCol(col) + columnOffset)}${Number(row) + rowOffset}`;
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
  const reportChrome = getReportChrome(table);

  if (table.title) {
    rowHeights.set(rowOffset, getDefaultRowHeight());
    writeCells(rowMap, rowOffset, [
      serializeCell(
        rowOffset,
        columnOffset,
        table.title,
        sharedStrings,
        styles.addStyle(withTableDefaultTitleStyle(table.defaults)),
      ),
    ]);
  }

  reportChrome.groupHeaderPlaceholders.forEach((cell) => {
    const worksheetRowIndex = rowOffset + cell.rowOffset;
    rowHeights.set(worksheetRowIndex, getDefaultRowHeight());
    writeCells(rowMap, worksheetRowIndex, [
      serializeCell(
        worksheetRowIndex,
        columnOffset + cell.columnOffset,
        null,
        sharedStrings,
        styles.addStyle(withTableDefaultGroupHeaderFillerStyle(table.defaults)),
      ),
    ]);
  });

  reportChrome.groupHeaderCells.forEach((cell) => {
    const worksheetRowIndex = rowOffset + cell.rowOffset;
    rowHeights.set(worksheetRowIndex, getDefaultRowHeight());
    writeCells(rowMap, worksheetRowIndex, [
      serializeCell(
        worksheetRowIndex,
        columnOffset + cell.columnOffset,
        cell.value,
        sharedStrings,
        styles.addStyle(withTableDefaultGroupHeaderStyle(table.defaults)),
      ),
    ]);
  });

  rowHeights.set(rowOffset + reportChrome.leafHeaderRowOffset, getDefaultRowHeight());

  writeCells(
    rowMap,
    rowOffset + reportChrome.leafHeaderRowOffset,
    table.planner.columns.map((column, columnIndex) =>
      serializeCell(
        rowOffset + reportChrome.leafHeaderRowOffset,
        columnOffset + columnIndex,
        column.headerLabel,
        sharedStrings,
        styles.addStyle(withTableDefaultHeaderStyle(table.defaults, column.headerStyle)),
      ),
    ),
  );

  table.planner.rows.forEach((row, rowIndex) => {
    const sheetRowIndex = rowOffset + reportChrome.bodyRowOffset + rowIndex;
    rowHeights.set(sheetRowIndex, Math.max(rowHeights.get(sheetRowIndex) ?? 0, row.height));
    writeCells(
      rowMap,
      sheetRowIndex,
      row.cells.map((cell, columnIndex) =>
        serializeCell(
          sheetRowIndex,
          columnOffset + columnIndex,
          isFormulaCellValue(cell.value)
            ? {
                ...cell.value,
                formula: shiftFormulaA1Refs(
                  cell.value.formula,
                  rowOffset + reportChrome.bodyRowOffset - 1,
                  columnOffset,
                ),
              }
            : cell.value,
          sharedStrings,
          styles.addStyle(
            cell.hyperlink
              ? withTableDefaultHyperlinkBodyStyle(
                  table.defaults,
                  resolveDataCellStyle(table.planner.columns[columnIndex], cell),
                  cell.hyperlink.style,
                )
              : withTableDefaultBodyStyle(
                  table.defaults,
                  resolveDataCellStyle(table.planner.columns[columnIndex], cell),
                ),
          ),
          cell.hyperlink,
        ),
      ),
    );
  });

  const summaryRows = groupSummaryRows(table.summaries);
  summaryRows.forEach((summaryRow, summaryRowIndex) => {
    const worksheetRowIndex =
      rowOffset + reportChrome.bodyRowOffset + table.planner.rows.length + summaryRowIndex;
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
                startRow: rowOffset + reportChrome.bodyRowOffset,
                endRow: rowOffset + reportChrome.bodyRowOffset + table.planner.rows.length - 1,
                column: columnOffset + columnIndex,
                logicalRows: table.planner.rows
                  .filter(
                    (row, index, rows) =>
                      index === 0 || rows[index - 1]?.logicalRowIndex !== row.logicalRowIndex,
                  )
                  .map((row) => ({
                    startRow: rowOffset + reportChrome.bodyRowOffset + row.logicalRowStartIndex,
                    endRow:
                      rowOffset +
                      reportChrome.bodyRowOffset +
                      row.logicalRowStartIndex +
                      row.logicalRowHeight -
                      1,
                  })),
              },
            }),
            sharedStrings,
            summary.unstyled
              ? undefined
              : styles.addStyle(withTableDefaultSummaryStyle(table.defaults, summary.style)),
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
              withTableDefaultSummaryStyle(
                table.defaults,
                typeof column.style === "function" ? undefined : column.style,
              ),
            ),
          ),
        ];
      }),
    );
  }
}

function getReportChrome(table: BufferedTablePlan<any>) {
  return table.excelTable
    ? {
        titleRowCount: 0,
        groupHeaderDepth: 0,
        leafHeaderRowOffset: 0,
        headerHeight: 1,
        bodyRowOffset: 1,
        autoFilterRowOffset: 0,
        groupHeaderCells: [],
        groupHeaderPlaceholders: [],
        groupHeaderMerges: [],
        titleMerge: undefined,
      }
    : buildReportChrome({
        columns: table.planner.columns,
        title: table.title,
        render: table.render,
      });
}

function isFormulaCellValue(
  value: unknown,
): value is { kind: "formula"; formula: string; value?: unknown } {
  return !!value && typeof value === "object" && (value as { kind?: string }).kind === "formula";
}

function resolveDataCellStyle<T extends object>(
  column: ResolvedColumn<T> | undefined,
  cell: PlannedCell<T>,
): CellStyle | undefined {
  if (!column?.style) return undefined;
  if (typeof column.style === "function") {
    const styleFn = column.style as (...args: any[]) => CellStyle | undefined;
    if (styleFn.length >= 3) {
      return styleFn(cell.sourceRow, cell.sourceRowIndex, cell.subRowIndex);
    }

    return styleFn({
      ...cell.sourceRow,
      ctx: undefined as never,
      row: cell.sourceRow,
      rowIndex: cell.sourceRowIndex,
      subRowIndex: cell.subRowIndex,
    } as never);
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
    upsertWorksheetCells(existing, cells);
    return;
  }

  rowMap.set(rowIndex, [...cells]);
}

function upsertWorksheetCells(target: string[], incoming: string[]) {
  const existingByRef = new Map(
    target.map((cell, index) => [getWorksheetCellRef(cell), index] as const),
  );

  incoming.forEach((cell) => {
    const ref = getWorksheetCellRef(cell);
    const existingIndex = ref ? existingByRef.get(ref) : undefined;
    if (existingIndex !== undefined) {
      target[existingIndex] = cell;
      return;
    }

    target.push(cell);
    if (ref) {
      existingByRef.set(ref, target.length - 1);
    }
  });
}

function sortWorksheetCells(cells: string[]) {
  return [...cells].sort(
    (left, right) => getWorksheetCellSortKey(left) - getWorksheetCellSortKey(right),
  );
}

function getWorksheetCellSortKey(cellXml: string) {
  const ref = getWorksheetCellRef(cellXml);
  if (!ref) {
    return Number.MAX_SAFE_INTEGER;
  }

  const refMatch = ref.match(/^([A-Z]+)(\d+)$/);
  if (!refMatch) {
    return Number.MAX_SAFE_INTEGER;
  }

  const [, col, row] = refMatch;
  if (!col || !row) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(row) * 10_000 + fromWorksheetCol(col);
}

function getWorksheetCellRef(cellXml: string) {
  const refMatch = cellXml.match(/\br="([A-Z]+)(\d+)"/);
  if (!refMatch) {
    return undefined;
  }

  return `${refMatch[1] ?? ""}${refMatch[2] ?? ""}` || undefined;
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

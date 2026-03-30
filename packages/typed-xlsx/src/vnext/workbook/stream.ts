import { createPlannerStats, createSummaryBindings, resolveColumns } from "../planner/rows";
import { writeSharedStringsXml, createSharedStringsCollector } from "../ooxml/shared-strings";
import { writeXlsxPackageToSink } from "../ooxml/package";
import { xmlDocument, xmlElement, xmlSelfClosing } from "../ooxml/xml";
import { appendExpandedRowXml, expandCommittedRow, updateColumnWidthStats } from "../stream/rows";
import type { SchemaDefinition } from "../schema/builder";
import type {
  PlannedSummaryCell,
  SheetViewOptions,
  StreamSheetSpool,
  StreamSpoolFactory,
  StreamTableCommit,
  StreamTableInput,
  StreamWorkbookSink,
  TableSelection,
} from "./types";
import { applyColumnSelection } from "./internal/selection";
import { finalizeSummaryRuntime } from "../summary/runtime";
import type { SharedStringsCollector } from "../ooxml/shared-strings";
import type { PlannedMergeRange } from "../planner/rows";
import {
  writeWorksheetColumns,
  writeWorksheetMerges,
  writeWorksheetViews,
} from "../ooxml/worksheet-parts";
import { StylesCollector } from "../styles/collector";
import {
  withDefaultBodyStyle,
  withDefaultHeaderStyle,
  withDefaultSummaryStyle,
} from "../styles/defaults";
import { serializeCell, serializeInlineStringCell } from "../ooxml/cells";
import type { CellStyle } from "../styles/types";
import { getDefaultRowHeight } from "../planner/metrics";
import { buildWorksheetNames } from "../ooxml/sheet-names";
import { groupSummaryRows, resolveSummaryStyle } from "./internal/summaries";

interface StreamTableState<T extends object> {
  tableId: string;
  schema: SchemaDefinition<T>;
  selection?: TableSelection;
  columns: ReturnType<typeof resolveColumns<T>>;
  stats: ReturnType<typeof createPlannerStats>;
  summaryBindings: ReturnType<typeof createSummaryBindings<T>>;
  committedLogicalRows: number;
  committedPhysicalRows: number;
  merges: PlannedMergeRange[];
  spool: StreamSheetSpool;
}

interface StreamTableFinalization {
  tableId: string;
  columns: Array<{ id: string; headerLabel: string; width: number }>;
  committedLogicalRows: number;
  committedPhysicalRows: number;
  merges: PlannedMergeRange[];
  summaries: PlannedSummaryCell[];
  headerStyleIndexes: number[];
  summaryStyleIndexes: number[];
  spool: StreamSheetSpool;
  view?: SheetViewOptions;
}

const encoder = new TextEncoder();

function encodeRowChunk(value: string) {
  return new TextEncoder().encode(value);
}

function applySelection<T extends object>(
  columns: ReturnType<typeof resolveColumns<T>>,
  selection?: TableSelection,
) {
  return applyColumnSelection(columns, selection);
}

class StreamTableBuilder<T extends object> {
  private readonly state: StreamTableState<T>;

  constructor(
    tableId: string,
    schema: SchemaDefinition<T>,
    spool: StreamSheetSpool,
    private readonly sharedStrings: SharedStringsCollector,
    private readonly styles: StylesCollector,
    private readonly stringMode: "inline" | "shared",
    context?: Record<string, unknown>,
    selection?: TableSelection,
  ) {
    const columns = applySelection(resolveColumns(schema, context), selection);
    this.state = {
      tableId,
      schema,
      selection,
      columns,
      stats: createPlannerStats(columns),
      summaryBindings: createSummaryBindings(columns),
      committedLogicalRows: 0,
      committedPhysicalRows: 0,
      merges: [],
      spool,
    };
  }

  async commit(batch: StreamTableCommit<T>) {
    for (const row of batch.rows) {
      const expanded = expandCommittedRow(this.state.columns, row, this.state.committedLogicalRows);
      const startRow = this.state.committedPhysicalRows;
      const endRow = startRow + expanded.height - 1;

      for (const binding of this.state.summaryBindings) {
        binding.runtime.accumulator = binding.definition.step(
          binding.runtime.accumulator,
          row,
          this.state.committedLogicalRows,
        );
      }

      updateColumnWidthStats({
        columns: this.state.columns,
        expandedRow: expanded,
        widths: this.state.stats.columnWidths,
      });

      if (expanded.height > 1) {
        expanded.valuesByColumn.forEach((values, columnIndex) => {
          if (values.length !== 1) return;
          this.state.merges.push({
            startRow,
            endRow,
            startCol: columnIndex,
            endCol: columnIndex,
          });
        });
      }

      const fragment = appendExpandedRowXml({
        columns: this.state.columns,
        expandedRow: expanded,
        startingRowIndex: 1 + this.state.committedPhysicalRows,
        sharedStrings: this.sharedStrings,
        stringMode: this.stringMode,
        styleIndexesByRow: buildStyleIndexesByRow(this.state.columns, expanded, this.styles),
      });

      await this.state.spool.append(encodeRowChunk(fragment));
      this.state.committedLogicalRows += 1;
      this.state.committedPhysicalRows += expanded.height;
    }
  }

  finalizeSummaries(): PlannedSummaryCell[] {
    return this.state.summaryBindings.map((binding) => {
      const value = finalizeSummaryRuntime(binding.definition, binding.runtime);
      return {
        columnId: binding.columnId,
        summaryIndex: binding.summaryIndex,
        value,
        style: resolveSummaryStyle(binding.definition, value),
      };
    });
  }

  getFinalization(): StreamTableFinalization {
    const summaries = this.finalizeSummaries();
    return {
      tableId: this.state.tableId,
      columns: this.state.columns.map((column) => ({
        id: column.id,
        headerLabel: column.headerLabel,
        width: this.state.stats.columnWidths.get(column.id) ?? column.width ?? 8,
      })),
      committedLogicalRows: this.state.committedLogicalRows,
      committedPhysicalRows: this.state.committedPhysicalRows,
      merges: [...this.state.merges],
      summaries,
      headerStyleIndexes: this.state.columns.map((column) =>
        this.styles.addStyle(withDefaultHeaderStyle(column.headerStyle)),
      ),
      summaryStyleIndexes: summaries.map((summary) =>
        this.styles.addStyle(withDefaultSummaryStyle(summary.style)),
      ),
      spool: this.state.spool,
    };
  }

  async close() {
    await this.state.spool.close();
  }
}

class StreamSheetBuilder {
  private readonly tables: StreamTableBuilder<any>[] = [];

  constructor(
    private readonly name: string,
    private readonly spoolFactory: StreamSpoolFactory,
    private readonly sharedStrings: SharedStringsCollector,
    private readonly styles: StylesCollector,
    private readonly stringMode: "inline" | "shared",
    private readonly view?: SheetViewOptions,
  ) {}

  async table<T extends object>(params: StreamTableInput<T>) {
    const spool = await this.spoolFactory.create(`${this.name}:${params.id}`);
    const builder = new StreamTableBuilder(
      params.id,
      params.schema,
      spool,
      this.sharedStrings,
      this.styles,
      this.stringMode,
      params.context,
      params.select,
    );
    this.tables.push(builder);
    return builder;
  }

  async finalize() {
    const tables = this.tables.map((table) => ({
      ...table.getFinalization(),
      view: this.view,
    }));

    for (const table of this.tables) {
      await table.close();
    }

    return {
      name: this.name,
      view: this.view,
      tables,
    };
  }
}

export class StreamWorkbookBuilder {
  private readonly sheets: StreamSheetBuilder[] = [];
  private readonly sharedStrings: SharedStringsCollector;
  private readonly styles = new StylesCollector();
  private sink: StreamWorkbookSink | undefined;
  private finished = false;
  private readonly stringMode: "inline" | "shared";

  constructor(
    private readonly spoolFactory: StreamSpoolFactory,
    stringMode: "inline" | "shared",
    sink?: StreamWorkbookSink,
  ) {
    this.stringMode = stringMode;
    this.sharedStrings =
      stringMode === "shared" ? createSharedStringsCollector() : createDisabledSharedStrings();
    this.sink = sink;
  }

  static create(params: {
    spoolFactory: StreamSpoolFactory;
    sink?: StreamWorkbookSink;
    stringMode?: "inline" | "shared";
  }) {
    return new StreamWorkbookBuilder(
      params.spoolFactory,
      params.stringMode ?? "shared",
      params.sink,
    );
  }

  sheet(name: string, view?: SheetViewOptions) {
    const builder = new StreamSheetBuilder(
      name,
      this.spoolFactory,
      this.sharedStrings,
      this.styles,
      this.stringMode,
      view,
    );
    this.sheets.push(builder);
    return builder;
  }

  async finish(sink?: StreamWorkbookSink) {
    if (this.finished) {
      throw new Error("Stream workbook has already been finalized.");
    }

    const targetSink = sink ?? this.sink;
    if (!targetSink) {
      throw new Error("A stream sink is required to finalize the workbook.");
    }

    this.finished = true;
    const finalizedSheets = await Promise.all(this.sheets.map((sheet) => sheet.finalize()));
    const workbookSheetDefs: Array<{ name: string; id: number }> = [];
    const worksheetParts: Array<{ path: string; source: AsyncIterable<Uint8Array> }> = [];
    const rawSheetNames = finalizedSheets.flatMap((sheet) =>
      sheet.tables.map((table, tableIndex) =>
        sheet.tables.length > 1 ? `${sheet.name} ${table.tableId || tableIndex + 1}` : sheet.name,
      ),
    );
    const worksheetNames = buildWorksheetNames(rawSheetNames);
    let worksheetIndex = 0;

    for (const sheet of finalizedSheets) {
      for (const table of sheet.tables) {
        worksheetIndex += 1;
        workbookSheetDefs.push({
          name: worksheetNames[worksheetIndex - 1] ?? `Sheet ${worksheetIndex}`,
          id: worksheetIndex,
        });
        worksheetParts.push({
          path: `xl/worksheets/sheet${worksheetIndex}.xml`,
          source: streamWorksheetXml(table),
        });
      }
    }

    const parts = [
      {
        path: "xl/workbook.xml",
        source: writeStreamWorkbookXml(workbookSheetDefs),
      },
      {
        path: "xl/styles.xml",
        source: this.styles.toXml(),
      },
      ...(this.sharedStrings.count() > 0
        ? [
            {
              path: "xl/sharedStrings.xml",
              source: writeSharedStringsXml(this.sharedStrings),
            },
          ]
        : []),
      ...worksheetParts,
    ];

    await writeXlsxPackageToSink(
      parts,
      {
        worksheetCount: worksheetParts.length,
        hasSharedStrings: this.sharedStrings.count() > 0,
      },
      targetSink,
    );
    await targetSink.close();
  }
}

function encodeXml(value: string) {
  return encoder.encode(value);
}

async function* streamWorksheetXml(table: StreamTableFinalization): AsyncIterable<Uint8Array> {
  const summaryRows = groupSummaryRows(table.summaries);
  const lastRow = table.committedPhysicalRows + 1 + summaryRows.length;
  const lastCol = table.columns.length > 0 ? toWorksheetCol(table.columns.length - 1) : "A";

  yield encodeXml(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `${xmlSelfClosing("dimension", { ref: `A1:${lastCol}${lastRow}` })}` +
      `${writeWorksheetViews(table.view)}` +
      `${xmlSelfClosing("sheetFormatPr", { defaultRowHeight: getDefaultRowHeight() })}` +
      `${writeStreamColumns(table)}` +
      `<sheetData>`,
  );

  yield encodeXml(
    xmlElement(
      "row",
      { r: 1, ht: getDefaultRowHeight(), customHeight: 1 },
      table.columns.map((column, columnIndex) =>
        serializeHeaderCell(columnIndex, column.headerLabel, table.headerStyleIndexes[columnIndex]),
      ),
    ),
  );

  for await (const chunk of table.spool.read()) {
    yield chunk;
  }

  for (const [summaryRowIndex, summaryRow] of summaryRows.entries()) {
    const summaryRowNumber = table.committedPhysicalRows + 2 + summaryRowIndex;
    const values = new Map(summaryRow.map((summary) => [summary.columnId, summary]));

    yield encodeXml(
      xmlElement(
        "row",
        { r: summaryRowNumber, ht: getDefaultRowHeight(), customHeight: 1 },
        table.columns.flatMap((column, columnIndex) => {
          const summary = values.get(column.id);
          if (!summary) {
            return [];
          }

          return [
            serializeSummaryCell(
              summaryRowNumber,
              columnIndex,
              summary.value,
              getSummaryStyleIndex(table, summary),
            ),
          ];
        }),
      ),
    );
  }

  yield encodeXml(`</sheetData>${writeStreamMerges(table)}</worksheet>`);
}

function serializeHeaderCell(columnIndex: number, value: string, styleIndex?: number) {
  return serializeInlineStringCell(0, columnIndex, value, styleIndex);
}

function serializeSummaryCell(
  rowNumber: number,
  columnIndex: number,
  value: unknown,
  styleIndex?: number,
) {
  if (typeof value === "string") {
    return serializeInlineStringCell(rowNumber - 1, columnIndex, value, styleIndex);
  }

  return serializeCell(
    rowNumber - 1,
    columnIndex,
    value as null | string | number | boolean | Date | undefined,
    tablelessSharedStrings,
    styleIndex,
  );
}

const tablelessSharedStrings: SharedStringsCollector = {
  add: () => 0,
  count: () => 0,
  values: () => [],
};

function createDisabledSharedStrings(): SharedStringsCollector {
  return tablelessSharedStrings;
}

function getSummaryStyleIndex(table: StreamTableFinalization, target: PlannedSummaryCell) {
  const index = table.summaries.findIndex(
    (summary) =>
      summary.columnId === target.columnId && summary.summaryIndex === target.summaryIndex,
  );

  return index >= 0 ? table.summaryStyleIndexes[index] : undefined;
}

function writeStreamWorkbookXml(sheets: Array<{ name: string; id: number }>) {
  return xmlDocument(
    "workbook",
    {
      xmlns: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    },
    xmlElement(
      "sheets",
      undefined,
      sheets.map((sheet) =>
        xmlSelfClosing("sheet", {
          name: sheet.name,
          sheetId: sheet.id,
          "r:id": `rId${sheet.id}`,
        }),
      ),
    ),
  );
}

function writeStreamColumns(table: StreamTableFinalization) {
  return writeWorksheetColumns(
    table.columns.map((column, columnIndex) => ({
      index: columnIndex,
      width: column.width,
    })),
  );
}

function writeStreamMerges(table: StreamTableFinalization) {
  return writeWorksheetMerges(
    table.merges.map((merge) => ({
      startRow: 1 + merge.startRow,
      endRow: 1 + merge.endRow,
      startCol: merge.startCol,
      endCol: merge.endCol,
    })),
  );
}

function buildStyleIndexesByRow<T extends object>(
  columns: ReturnType<typeof resolveColumns<T>>,
  expandedRow: ReturnType<typeof expandCommittedRow<T>>,
  styles: StylesCollector,
) {
  return Array.from({ length: expandedRow.height }, (_, subRowIndex) =>
    columns.map((column) =>
      styles.addStyle(
        withDefaultBodyStyle(
          resolveColumnStyle(column, expandedRow.row, expandedRow.sourceRowIndex, subRowIndex),
        ),
      ),
    ),
  );
}

function resolveColumnStyle<T extends object>(
  column: ReturnType<typeof resolveColumns<T>>[number],
  row: T,
  rowIndex: number,
  subRowIndex: number,
): CellStyle | undefined {
  if (!column.style) return undefined;
  if (typeof column.style === "function") {
    return column.style(row, rowIndex, subRowIndex);
  }
  return column.style;
}

function toWorksheetCol(column: number) {
  let result = "";
  let current = column;

  do {
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return result;
}

import { createPlannerStats, createSummaryBindings, resolveColumns } from "../planner/rows";
import { buildWorksheetConditionalFormatting } from "../styles/conditional-runtime";
import { buildWorksheetDataValidations } from "../validation/runtime";
import { writeSharedStringsXml, createSharedStringsCollector } from "../ooxml/shared-strings";
import { writeXlsxPackageToSink } from "../ooxml/package";
import {
  writeExcelTableXml,
  writeWorksheetRelationshipsXml,
  writeWorksheetTableParts,
  type WorksheetTablePart,
} from "../ooxml/table";
import { xmlDocument, xmlElement, xmlSelfClosing } from "../ooxml/xml";
import { hashExcelProtectionPassword } from "../ooxml/protection";
import { appendExpandedRowXml, expandCommittedRow, updateColumnWidthStats } from "../stream/rows";
import type { SchemaDefinition } from "../schema/builder";
import type {
  AnyStreamTableInput,
  PlannedSummaryCell,
  ResolvedSheetProtectionOptions,
  SheetLayoutOptions,
  SheetProtectionInput,
  SheetViewOptions,
  StreamSheetSpool,
  StreamSpoolFactory,
  StreamTableCommit,
  StreamExcelTableInput,
  StreamWorkbookSink,
  TableAutoFilterOptions,
  TableSelection,
  WorkbookProtectionInput,
} from "./types";
import {
  resolveSheetProtection,
  resolveWorkbookProtection,
  serializeExcelTotalsRowFormula,
} from "./types";
import { applyColumnSelection } from "./internal/selection";
import type { SummaryResolvedValue } from "../summary/runtime";
import type { SharedStringsCollector } from "../ooxml/shared-strings";
import type { PlannedMergeRange } from "../planner/rows";
import {
  partitionWorksheetHyperlinks,
  writeWorksheetAutoFilter,
  writeWorksheetColumns,
  writeWorksheetConditionalFormatting,
  writeWorksheetDataValidations,
  writeWorksheetHyperlinks,
  writeWorksheetMerges,
  writeWorksheetProtection,
  writeWorksheetViews,
} from "../ooxml/worksheet-parts";
import { StylesCollector } from "../styles/collector";
import {
  withTableDefaultBodyStyle,
  withTableDefaultHeaderStyle,
  withDefaultHyperlinkBodyStyle,
  withTableDefaultSummaryStyle,
} from "../styles/defaults";
import { serializeCell, serializeInlineStringCell, toCellRef } from "../ooxml/cells";
import type { CellStyle } from "../styles/types";
import { getDefaultRowHeight } from "../planner/metrics";
import { buildWorksheetNames } from "../ooxml/sheet-names";
import { groupSummaryRows } from "./internal/summaries";
import { resolveAutoFilter } from "./internal/auto-filter";
import { buildPlannedSummaries, resolveSummaryValue } from "./internal/summaries";
import { resolveExcelTableOptions } from "./internal/excel-table";
import { layoutTables, positionTableMerges, type PositionedTable } from "./internal/layout";

function normalizeColumnSummary(
  summary: ReturnType<typeof resolveColumns<any>>[number]["summary"],
) {
  return Array.isArray(summary) ? summary : undefined;
}

interface StreamTableState<T extends object, TColumnId extends string> {
  tableId: string;
  schema: SchemaDefinition<T, any, any, any, any>;
  selection?: TableSelection<TColumnId>;
  columns: ReturnType<typeof resolveColumns<T>>;
  stats: ReturnType<typeof createPlannerStats>;
  summaryBindings: ReturnType<typeof createSummaryBindings<T>>;
  defaults?: import("./types").TableStyleDefaults;
  committedLogicalRows: number;
  committedPhysicalRows: number;
  logicalRowBounds: Array<{
    logicalRowHeight: number;
    logicalRowIndex: number;
    logicalRowStartIndex: number;
  }>;
  merges: PlannedMergeRange[];
  hyperlinks: import("./types").WorksheetHyperlink[];
  spool: StreamSheetSpool;
  autoFilter: boolean;
  excelTable?: import("./types").ResolvedExcelTableOptions;
}

interface StreamTableFinalization {
  tableId: string;
  columns: Array<{
    id: string;
    headerLabel: string;
    style?: CellStyle;
    totalsStyleIndex?: number;
    width: number;
    summary: ReturnType<typeof normalizeColumnSummary>;
  }>;
  committedLogicalRows: number;
  committedPhysicalRows: number;
  logicalRowBounds: Array<{
    logicalRowHeight: number;
    logicalRowIndex: number;
    logicalRowStartIndex: number;
  }>;
  merges: PlannedMergeRange[];
  summaries: PlannedSummaryCell[];
  hyperlinks: import("./types").WorksheetHyperlink[];
  defaults?: import("./types").TableStyleDefaults;
  headerStyleIndexes: number[];
  summaryStyleIndexes: Array<number | undefined>;
  spool: StreamSheetSpool;
  view?: SheetViewOptions;
  autoFilter: boolean;
  excelTable?: import("./types").ResolvedExcelTableOptions;
  conditionalFormatting: import("../styles/conditional-runtime").WorksheetConditionalFormattingBlock[];
  dataValidations: import("../validation/runtime").WorksheetDataValidation[];
  planner: {
    columns: Array<{ id: string }>;
    merges: PlannedMergeRange[];
    rows: Array<unknown>;
    stats: {
      columnWidths: Map<string, number>;
    };
  };
}

interface StreamWorksheetPart {
  path: string;
  source: AsyncIterable<Uint8Array> | string;
}

interface StreamWorkbookProtection {
  lockStructure?: boolean;
  lockWindows?: boolean;
  workbookPassword?: string;
}

interface StreamSheetFinalization {
  layout?: SheetLayoutOptions;
  name: string;
  tables: StreamTableFinalization[];
  protection?: ResolvedSheetProtectionOptions;
  view?: SheetViewOptions;
}

function buildPositionedConditionalFormatting(
  positionedTables: PositionedTable<StreamTableFinalization>[],
) {
  return positionedTables.flatMap((positioned) =>
    positioned.table.conditionalFormatting.map((block) => ({
      ...block,
      ref: shiftWorksheetRange(block.ref, positioned.rowOffset, positioned.columnOffset),
    })),
  );
}

function registerConditionalFormattingDifferentialStyles(
  blocks: ReturnType<typeof buildPositionedConditionalFormatting>,
  styles: StylesCollector,
) {
  blocks.forEach((block) => {
    block.rules.forEach((rule) => {
      styles.addDifferentialStyle(rule.style);
    });
  });
}

const encoder = new TextEncoder();

function encodeRowChunk(value: string) {
  return new TextEncoder().encode(value);
}

function applySelection<T extends object, TColumnId extends string>(
  columns: ReturnType<typeof resolveColumns<T>>,
  selection?: TableSelection<TColumnId>,
) {
  return applyColumnSelection(columns, selection);
}

class StreamTableBuilder<T extends object, TColumnId extends string> {
  private readonly state: StreamTableState<T, TColumnId>;

  constructor(
    tableId: string,
    schema: SchemaDefinition<T, any, any, any, any>,
    spool: StreamSheetSpool,
    private readonly sharedStrings: SharedStringsCollector,
    private readonly styles: StylesCollector,
    private readonly stringMode: "inline" | "shared",
    context?: Record<string, unknown>,
    selection?: TableSelection<TColumnId>,
    options?: {
      autoFilter?: boolean;
      defaults?: import("./types").TableStyleDefaults;
      reportAutoFilter?: boolean | TableAutoFilterOptions;
      name?: string;
      style?: import("./types").ExcelTableStyle;
      totalsRow?: boolean;
    },
  ) {
    const columns = applySelection(resolveColumns(schema, context, selection), selection);
    const isExcelTable = schema.kind === "excel-table";
    const resolvedExcelTable = isExcelTable
      ? resolveExcelTableOptions({
          autoFilter: options?.autoFilter,
          columns,
          hasMerges: false,
          id: tableId,
          name: options?.name,
          style: options?.style,
          totalsRow: options?.totalsRow,
        })
      : undefined;
    this.state = {
      tableId,
      schema,
      selection,
      columns,
      stats: createPlannerStats(columns),
      summaryBindings: createSummaryBindings(columns),
      defaults: options?.defaults,
      committedLogicalRows: 0,
      committedPhysicalRows: 0,
      logicalRowBounds: [],
      merges: [],
      hyperlinks: [],
      spool,
      autoFilter: false,
      excelTable: resolvedExcelTable,
    };

    this.state.autoFilter = resolveAutoFilter({
      autoFilter: resolvedExcelTable ? false : options?.reportAutoFilter,
      merges: this.state.merges,
      tableId,
      mode: "stream",
      warn: false,
    });
  }

  async commit(batch: StreamTableCommit<T>) {
    for (const row of batch.rows) {
      const expanded = expandCommittedRow(
        this.state.columns,
        row,
        this.state.committedLogicalRows,
        this.state.committedPhysicalRows,
        this.state.schema.kind,
      );
      const startRow = this.state.committedPhysicalRows;
      const endRow = startRow + expanded.height - 1;
      this.state.logicalRowBounds.push({
        logicalRowHeight: expanded.height,
        logicalRowIndex: this.state.committedLogicalRows,
        logicalRowStartIndex: startRow,
      });

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

        if (this.state.autoFilter) {
          this.state.autoFilter = resolveAutoFilter({
            autoFilter: true,
            merges: this.state.merges,
            tableId: this.state.tableId,
            mode: "stream",
          });
        }
      }

      const fragment = appendExpandedRowXml({
        columns: this.state.columns,
        expandedRow: expanded,
        startingRowIndex: 1 + this.state.committedPhysicalRows,
        sharedStrings: this.sharedStrings,
        stringMode: this.stringMode,
        styleIndexesByRow: buildStyleIndexesByRow(
          this.state.columns,
          expanded,
          this.styles,
          this.state.defaults,
        ),
      });

      await this.state.spool.append(encodeRowChunk(fragment));
      expanded.hyperlinksByColumn.forEach((links, columnIndex) => {
        links.forEach((hyperlink, subRowIndex) => {
          if (!hyperlink) return;
          this.state.hyperlinks.push({
            ref: toCellRef(1 + this.state.committedPhysicalRows + subRowIndex, columnIndex),
            target: hyperlink.target,
            tooltip: hyperlink.tooltip,
          });
        });
      });
      this.state.committedLogicalRows += 1;
      this.state.committedPhysicalRows += expanded.height;
    }
  }

  finalizeSummaries(): PlannedSummaryCell[] {
    return buildPlannedSummaries(this.state.summaryBindings, this.state.columns);
  }

  getFinalization(): StreamTableFinalization {
    const summaries = this.finalizeSummaries();
    return {
      tableId: this.state.tableId,
      columns: this.state.columns.map((column) => ({
        id: column.id,
        headerLabel: column.headerLabel,
        style: typeof column.style === "function" ? undefined : column.style,
        totalsStyleIndex: this.styles.addStyle(
          withTableDefaultSummaryStyle(
            this.state.defaults,
            typeof column.style === "function" ? undefined : column.style,
          ),
        ),
        width: this.state.stats.columnWidths.get(column.id) ?? column.width ?? 8,
        summary: normalizeColumnSummary(column.summary),
      })),
      committedLogicalRows: this.state.committedLogicalRows,
      committedPhysicalRows: this.state.committedPhysicalRows,
      logicalRowBounds: [...this.state.logicalRowBounds],
      merges: [...this.state.merges],
      summaries,
      hyperlinks: [...this.state.hyperlinks],
      defaults: this.state.defaults,
      headerStyleIndexes: this.state.columns.map((column) =>
        this.styles.addStyle(withTableDefaultHeaderStyle(this.state.defaults, column.headerStyle)),
      ),
      summaryStyleIndexes: summaries.map((summary) =>
        summary.unstyled
          ? undefined
          : this.styles.addStyle(withTableDefaultSummaryStyle(this.state.defaults, summary.style)),
      ),
      spool: this.state.spool,
      autoFilter: this.state.autoFilter,
      excelTable: this.state.excelTable,
      conditionalFormatting: buildWorksheetConditionalFormatting({
        columns: this.state.columns,
        rowStart: 1,
        rowEnd: this.state.committedPhysicalRows,
        columnOffset: 0,
        mode: this.state.schema.kind,
      }),
      dataValidations: buildWorksheetDataValidations({
        columns: this.state.columns,
        rowStart: 1,
        rowEnd: this.state.committedPhysicalRows,
        columnOffset: 0,
        mode: this.state.schema.kind,
      }),
      planner: {
        columns: this.state.columns.map((column) => ({ id: column.id })),
        merges: [...this.state.merges],
        rows: Array.from({ length: this.state.committedPhysicalRows }),
        stats: {
          columnWidths: this.state.stats.columnWidths,
        },
      },
    };
  }

  async close() {
    await this.state.spool.close();
  }
}

function isStreamExcelTableInput<T extends object, TColumnId extends string>(
  params: AnyStreamTableInput<T, TColumnId>,
): params is StreamExcelTableInput<T, TColumnId> {
  return params.schema.kind === "excel-table";
}

class StreamSheetBuilder {
  private readonly tables: StreamTableBuilder<any, string>[] = [];

  constructor(
    private readonly name: string,
    private readonly spoolFactory: StreamSpoolFactory,
    private readonly sharedStrings: SharedStringsCollector,
    private readonly styles: StylesCollector,
    private readonly stringMode: "inline" | "shared",
    private readonly layout?: SheetLayoutOptions,
    private readonly view?: SheetViewOptions,
    private readonly protection?: ResolvedSheetProtectionOptions,
  ) {}

  async table<T extends object, TColumnId extends string>(
    id: string,
    params: AnyStreamTableInput<T, TColumnId>,
  ) {
    const spool = await this.spoolFactory.create(`${this.name}:${id}`);
    const builder = new StreamTableBuilder<T, TColumnId>(
      id,
      params.schema,
      spool,
      this.sharedStrings,
      this.styles,
      this.stringMode,
      "context" in params ? params.context : undefined,
      params.select,
      isStreamExcelTableInput(params)
        ? {
            autoFilter: params.autoFilter,
            defaults: params.defaults,
            name: params.name,
            style: params.style,
            totalsRow: params.totalsRow,
          }
        : {
            defaults: params.defaults,
            reportAutoFilter: params.autoFilter,
          },
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
      layout: this.layout,
      name: this.name,
      protection: this.protection,
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
  private readonly protection: StreamWorkbookProtection | undefined;

  constructor(
    private readonly spoolFactory: StreamSpoolFactory,
    stringMode: "inline" | "shared",
    sink?: StreamWorkbookSink,
    protection?: StreamWorkbookProtection,
  ) {
    this.stringMode = stringMode;
    this.sharedStrings =
      stringMode === "shared" ? createSharedStringsCollector() : createDisabledSharedStrings();
    this.sink = sink;
    this.protection = protection;
  }

  static create(params: {
    spoolFactory: StreamSpoolFactory;
    sink?: StreamWorkbookSink;
    protection?: WorkbookProtectionInput;
    stringMode?: "inline" | "shared";
  }) {
    return new StreamWorkbookBuilder(
      params.spoolFactory,
      params.stringMode ?? "shared",
      params.sink,
      resolveWorkbookProtection(params.protection),
    );
  }

  sheet(
    name: string,
    options?: SheetLayoutOptions & SheetViewOptions & { protection?: SheetProtectionInput },
  ) {
    const { tablesPerRow, tableColumnGap, tableRowGap, protection, ...view } = options ?? {};
    const builder = new StreamSheetBuilder(
      name,
      this.spoolFactory,
      this.sharedStrings,
      this.styles,
      this.stringMode,
      {
        tablesPerRow,
        tableColumnGap,
        tableRowGap,
      },
      view,
      resolveSheetProtection(protection),
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
    const finalizedSheets = (await Promise.all(
      this.sheets.map((sheet) => sheet.finalize()),
    )) as StreamSheetFinalization[];
    const workbookSheetDefs: Array<{ name: string; id: number }> = [];
    const worksheetParts: StreamWorksheetPart[] = [];
    const worksheetRelationshipParts: StreamWorksheetPart[] = [];
    const tableParts: StreamWorksheetPart[] = [];
    const rawSheetNames = finalizedSheets.map((sheet) => sheet.name);
    const worksheetNames = buildWorksheetNames(rawSheetNames);
    let worksheetIndex = 0;
    let tableIndex = 0;

    for (const sheet of finalizedSheets) {
      worksheetIndex += 1;
      const positionedTables = layoutTables({ layout: sheet.layout, tables: sheet.tables });
      const conditionalFormatting = buildPositionedConditionalFormatting(positionedTables);
      registerConditionalFormattingDifferentialStyles(conditionalFormatting, this.styles);
      const worksheetTableParts = buildStreamWorksheetTableParts(positionedTables, tableIndex);
      const worksheetHyperlinks = partitionWorksheetHyperlinks(
        positionedTables.flatMap((positioned) =>
          positioned.table.hyperlinks.map((hyperlink) => ({
            ...hyperlink,
            ref: shiftCellRef(hyperlink.ref, positioned.rowOffset, positioned.columnOffset),
          })),
        ),
      );

      workbookSheetDefs.push({
        name: worksheetNames[worksheetIndex - 1] ?? `Sheet ${worksheetIndex}`,
        id: worksheetIndex,
      });
      worksheetParts.push({
        path: `xl/worksheets/sheet${worksheetIndex}.xml`,
        source: streamWorksheetXml(
          sheet,
          positionedTables,
          worksheetTableParts,
          conditionalFormatting,
          this.styles,
        ),
      });

      if (worksheetTableParts.length > 0) {
        worksheetRelationshipParts.push({
          path: `xl/worksheets/_rels/sheet${worksheetIndex}.xml.rels`,
          source: writeStreamWorksheetRelationshipsXml(
            worksheetTableParts,
            worksheetHyperlinks.externalRelationships,
          ),
        });
        tableParts.push(
          ...worksheetTableParts.map((part) => ({
            path: part.path,
            source: part.xml,
          })),
        );
      } else if (worksheetHyperlinks.externalRelationships.length > 0) {
        worksheetRelationshipParts.push({
          path: `xl/worksheets/_rels/sheet${worksheetIndex}.xml.rels`,
          source: writeStreamWorksheetRelationshipsXml(
            [],
            worksheetHyperlinks.externalRelationships,
          ),
        });
      }

      tableIndex += worksheetTableParts.length;
    }

    const parts = [
      {
        path: "xl/workbook.xml",
        source: writeStreamWorkbookXml(workbookSheetDefs, this.protection),
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
      ...worksheetRelationshipParts,
      ...tableParts,
    ];

    await writeXlsxPackageToSink(
      parts,
      {
        worksheetCount: worksheetParts.length,
        hasSharedStrings: this.sharedStrings.count() > 0,
        tableCount: tableIndex,
      },
      targetSink,
    );
    await targetSink.close();
  }
}

function encodeXml(value: string) {
  return encoder.encode(value);
}

function buildStreamWorksheetTableParts(
  positionedTables: PositionedTable<StreamTableFinalization>[],
  startingTableIndex: number,
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
          endRow: positioned.rowOffset + positioned.table.committedPhysicalRows,
          startCol: positioned.columnOffset,
          endCol: positioned.columnOffset + positioned.width - 1,
        },
        columns: positioned.table.columns.map((column) => ({
          id: column.id,
          headerLabel: column.headerLabel,
        })),
        options: positioned.table.excelTable,
      }),
    });
  });

  return parts;
}

async function* streamWorksheetXml(
  sheet: StreamSheetFinalization,
  positionedTables: PositionedTable<StreamTableFinalization>[],
  tableParts: WorksheetTablePart[],
  conditionalFormatting: ReturnType<typeof buildPositionedConditionalFormatting>,
  styles: StylesCollector,
): AsyncIterable<Uint8Array> {
  const merges = positionedTables.flatMap((positioned) => positionTableMerges(positioned));
  const autoFilteredTables = positionedTables.filter((positioned) => positioned.table.autoFilter);
  const autoFilter =
    autoFilteredTables.length === 1
      ? writeWorksheetAutoFilter({
          startRow: autoFilteredTables[0]!.rowOffset,
          endRow: autoFilteredTables[0]!.rowOffset + autoFilteredTables[0]!.height - 1,
          startCol: autoFilteredTables[0]!.columnOffset,
          endCol: autoFilteredTables[0]!.columnOffset + autoFilteredTables[0]!.width - 1,
        })
      : "";
  const lastRow = positionedTables.reduce(
    (max, positioned) => Math.max(max, positioned.rowOffset + positioned.height),
    1,
  );
  const lastColIndex = positionedTables.reduce(
    (max, positioned) => Math.max(max, positioned.columnOffset + positioned.width - 1),
    0,
  );
  const lastCol = toWorksheetCol(lastColIndex);
  const rowMap = new Map<number, string[]>();
  const dataValidations = positionedTables.flatMap((positioned) =>
    positioned.table.dataValidations.map((block) => ({
      ...block,
      ref: shiftWorksheetRange(block.ref, positioned.rowOffset, positioned.columnOffset),
    })),
  );
  const hyperlinks = partitionWorksheetHyperlinks(
    positionedTables.flatMap((positioned) =>
      positioned.table.hyperlinks.map((hyperlink) => ({
        ...hyperlink,
        ref: shiftCellRef(hyperlink.ref, positioned.rowOffset, positioned.columnOffset),
      })),
    ),
  );

  yield encodeXml(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `${xmlSelfClosing("dimension", { ref: `A1:${lastCol}${lastRow}` })}` +
      `${writeWorksheetViews(sheet.view)}` +
      `${xmlSelfClosing("sheetFormatPr", { defaultRowHeight: getDefaultRowHeight() })}` +
      `${writeStreamColumns(positionedTables)}` +
      `<sheetData>`,
  );

  for (const positioned of positionedTables) {
    appendCells(
      rowMap,
      positioned.rowOffset,
      positioned.table.columns.map((column, columnIndex) =>
        serializeHeaderCellAt(
          positioned.rowOffset,
          positioned.columnOffset + columnIndex,
          column.headerLabel,
          positioned.table.headerStyleIndexes[columnIndex],
        ),
      ),
    );

    for await (const chunk of positioned.table.spool.read()) {
      appendShiftedWorksheetChunkRowsAndColumns(
        rowMap,
        chunk,
        positioned.rowOffset,
        positioned.columnOffset,
      );
    }

    const summaryRows = groupSummaryRows(positioned.table.summaries);

    for (const [summaryRowIndex, summaryRow] of summaryRows.entries()) {
      const summaryRowNumber =
        positioned.rowOffset + positioned.table.committedPhysicalRows + 2 + summaryRowIndex;
      const values = new Map(summaryRow.map((summary) => [summary.columnId, summary]));

      appendCells(
        rowMap,
        summaryRowNumber - 1,
        positioned.table.columns.flatMap((column, columnIndex) => {
          const summary = values.get(column.id);
          if (!summary) {
            return [];
          }

          return [
            serializeSummaryCell(
              summaryRowNumber,
              positioned.columnOffset + columnIndex,
              resolveSummaryValue({
                definition: column.summary?.[summary.summaryIndex]!,
                value: summary.value,
                formulaContext: {
                  startRow: positioned.rowOffset + 1,
                  endRow: positioned.rowOffset + positioned.table.committedPhysicalRows,
                  column: positioned.columnOffset + columnIndex,
                  logicalRows: positioned.table.logicalRowBounds.map((row) => ({
                    startRow: positioned.rowOffset + row.logicalRowStartIndex + 1,
                    endRow: positioned.rowOffset + row.logicalRowStartIndex + row.logicalRowHeight,
                  })),
                },
              }),
              getSummaryStyleIndex(positioned.table, summary),
            ),
          ];
        }),
      );

      summaryRow.forEach((summary) => {
        const columnIndex = positioned.table.columns.findIndex(
          (column) => column.id === summary.columnId,
        );
        if (columnIndex < 0 || !summary.conditionalFormatting) {
          return;
        }

        conditionalFormatting.push(
          ...materializeSummaryConditionalFormatting(
            summary.conditionalFormatting,
            summaryRowNumber,
            positioned.columnOffset + columnIndex,
          ),
        );
      });
    }

    if (positioned.table.excelTable?.totalsRow) {
      const totalsRowIndex = positioned.rowOffset + positioned.table.committedPhysicalRows + 1;
      appendCells(
        rowMap,
        totalsRowIndex,
        positioned.table.columns.flatMap((column, columnIndex) => {
          const totalsRow = positioned.table.excelTable?.totalsRowColumns[columnIndex]?.totalsRow;
          if (!totalsRow) {
            return [];
          }

          const value =
            "label" in totalsRow
              ? totalsRow.label
              : {
                  kind: "formula" as const,
                  formula: serializeExcelTotalsRowFormula(
                    positioned.table.excelTable!.name,
                    positioned.table.excelTable!.totalsRowColumns[columnIndex]?.headerLabel ??
                      column.headerLabel,
                    totalsRow.function,
                  )!,
                };

          return [
            serializeSummaryCell(
              totalsRowIndex + 1,
              positioned.columnOffset + columnIndex,
              value,
              column.totalsStyleIndex,
            ),
          ];
        }),
      );
    }
  }

  for (const rowIndex of [...rowMap.keys()].sort((left, right) => left - right)) {
    yield encodeXml(
      xmlElement(
        "row",
        { r: rowIndex + 1, ht: getDefaultRowHeight(), customHeight: 1 },
        rowMap.get(rowIndex) ?? [],
      ),
    );
  }

  yield encodeXml(
    `</sheetData>${writeWorksheetProtection(sheet.protection)}${autoFilter}${writeWorksheetMerges(merges)}${writeWorksheetConditionalFormatting(conditionalFormatting, styles)}${writeWorksheetDataValidations(dataValidations)}${writeWorksheetHyperlinks(hyperlinks.worksheetHyperlinks)}${writeWorksheetTableParts(tableParts)}</worksheet>`,
  );
}

function writeStreamWorksheetRelationshipsXml(
  tableParts: WorksheetTablePart[],
  hyperlinks: Array<{ relId: string; target: string }>,
) {
  if (hyperlinks.length === 0) {
    return writeWorksheetRelationshipsXml(tableParts);
  }

  return xmlDocument(
    "Relationships",
    {
      xmlns: "http://schemas.openxmlformats.org/package/2006/relationships",
    },
    [
      ...tableParts.map((part) =>
        xmlSelfClosing("Relationship", {
          Id: part.relId,
          Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/table",
          Target: `../tables/${part.path.split("/").pop()}`,
        }),
      ),
      ...hyperlinks.map((hyperlink) =>
        xmlSelfClosing("Relationship", {
          Id: hyperlink.relId,
          Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
          Target: hyperlink.target,
          TargetMode: "External",
        }),
      ),
    ],
  );
}

function shiftWorksheetRange(ref: string, rowOffset: number, columnOffset: number) {
  const [start, end] = ref.split(":");
  if (!start || !end) {
    return ref;
  }

  return `${shiftCellRef(start, rowOffset, columnOffset)}:${shiftCellRef(end, rowOffset, columnOffset)}`;
}

function materializeSummaryConditionalFormatting(
  blocks: StreamTableFinalization["summaries"][number]["conditionalFormatting"] | undefined,
  worksheetRowIndex: number,
  worksheetColumnIndex: number,
) {
  if (!blocks || blocks.length === 0) {
    return [];
  }

  const ref = toCellRef(worksheetRowIndex - 1, worksheetColumnIndex);

  return blocks.map((block) => ({
    ...block,
    ref,
    rules: block.rules.map((rule) => ({
      ...rule,
      formula: rule.formula.replaceAll("A1", ref),
    })),
  }));
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

function serializeHeaderCellAt(
  rowIndex: number,
  columnIndex: number,
  value: string,
  styleIndex?: number,
) {
  return serializeInlineStringCell(rowIndex, columnIndex, value, styleIndex);
}

function serializeSummaryCell(
  rowNumber: number,
  columnIndex: number,
  value: SummaryResolvedValue,
  styleIndex?: number,
) {
  if (typeof value === "string") {
    return serializeInlineStringCell(rowNumber - 1, columnIndex, value, styleIndex);
  }

  return serializeCell(rowNumber - 1, columnIndex, value, tablelessSharedStrings, styleIndex);
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

function writeStreamWorkbookXml(
  sheets: Array<{ name: string; id: number }>,
  protection?: StreamWorkbookProtection,
) {
  return xmlDocument(
    "workbook",
    {
      xmlns: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    },
    [
      protection
        ? xmlSelfClosing("workbookProtection", {
            lockStructure: protection.lockStructure ? 1 : undefined,
            lockWindows: protection.lockWindows ? 1 : undefined,
            workbookPassword: protection.workbookPassword
              ? hashExcelProtectionPassword(protection.workbookPassword)
              : undefined,
          })
        : "",
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
    ],
  );
}

function writeStreamColumns(positionedTables: PositionedTable<StreamTableFinalization>[]) {
  const columns = new Map<number, number>();

  positionedTables.forEach((positioned) => {
    positioned.table.columns.forEach((column, columnIndex) => {
      columns.set(positioned.columnOffset + columnIndex, column.width);
    });
  });

  return writeWorksheetColumns(
    [...columns.entries()]
      .sort(([left], [right]) => left - right)
      .map(([index, width]) => ({ index, width })),
  );
}

function appendShiftedWorksheetChunkRowsAndColumns(
  rowMap: Map<number, string[]>,
  chunk: Uint8Array,
  rowOffset: number,
  columnOffset: number,
) {
  const content = new TextDecoder().decode(chunk);
  const rowMatches = [...content.matchAll(/<row\s+[^>]*r="(\d+)"[^>]*>(.*?)<\/row>/g)];

  rowMatches.forEach((match) => {
    const rowIndex = Number(match[1]) - 1 + rowOffset;
    const cellNodes = (match[2] ?? "").match(/<c\b[^>]*\/>|<c\b[^>]*>.*?<\/c>/gs) ?? [];
    const cells = cellNodes.map((cellNode) => {
      const refMatch = cellNode.match(/\br="([A-Z]+)(\d+)"/);
      if (!refMatch) {
        return cellNode;
      }

      const [, col, row] = refMatch;
      if (!col || !row) {
        return cellNode;
      }

      const baseColumn = fromWorksheetCol(col) + columnOffset;
      return cellNode.replace(
        /\br="([A-Z]+)(\d+)"/,
        `r="${toWorksheetCol(baseColumn)}${Number(row) + rowOffset}"`,
      );
    });

    appendCells(rowMap, rowIndex, cells);
  });
}

function fromWorksheetCol(column: string) {
  let value = 0;

  for (const char of column) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }

  return value - 1;
}

function appendCells(rowMap: Map<number, string[]>, rowIndex: number, cells: string[]) {
  const existing = rowMap.get(rowIndex);
  if (existing) {
    existing.push(...cells);
    return;
  }

  rowMap.set(rowIndex, [...cells]);
}

function buildStyleIndexesByRow<T extends object>(
  columns: ReturnType<typeof resolveColumns<T>>,
  expandedRow: ReturnType<typeof expandCommittedRow<T>>,
  styles: StylesCollector,
  defaults?: import("./types").TableStyleDefaults,
) {
  return Array.from({ length: expandedRow.height }, (_, subRowIndex) =>
    columns.map((column, columnIndex) =>
      styles.addStyle(
        expandedRow.hyperlinksByColumn[columnIndex]?.[subRowIndex]
          ? withDefaultHyperlinkBodyStyle(
              withTableDefaultBodyStyle(
                defaults,
                resolveColumnStyle(
                  column,
                  expandedRow.row,
                  expandedRow.sourceRowIndex,
                  subRowIndex,
                ),
              ),
              expandedRow.hyperlinksByColumn[columnIndex]?.[subRowIndex]?.style,
            )
          : withTableDefaultBodyStyle(
              defaults,
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

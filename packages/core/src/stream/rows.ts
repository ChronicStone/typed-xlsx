import { resolveColumnCellStyle, type ResolvedColumn } from "../planner/rows";
import type { PrimitiveCellValue } from "../schema/builder";
import type { SharedStringsCollector } from "../ooxml/shared-strings";
import { serializeCell, serializeInlineStringCell } from "../ooxml/cells";
import { xmlElement } from "../ooxml/xml";
import { resolveAccessor } from "../core/accessor";
import { estimateRowHeight, measurePrimitiveValue, resolveColumnWidth } from "../planner/metrics";
import type { CellStyle } from "../styles/types";
import { getCellPrimitiveValue, type CellData } from "../cell-data";
import {
  createFormulaRefs,
  createFormulaFunctionsContext,
  createFormulaRowContext,
  toExpr,
  type FormulaExpr,
} from "../formula/expr";
import { evaluateFormulaExpr, type FormulaEvaluationContext } from "../formula/evaluate";
import {
  escapeStructuredReferenceHeader,
  serializeExcelTableCurrentRowRef,
} from "../formula/structured-reference";
import { toCellRef } from "../ooxml/cells";
import type { PlannedHyperlink } from "../planner/rows";

interface ExpandedRow<T extends object> {
  row: T;
  sourceRowIndex: number;
  valuesByColumn: CellData[][];
  hyperlinksByColumn: Array<Array<PlannedHyperlink | undefined>>;
  height: number;
  physicalRowHeights: number[];
}

type RowSeriesMode = "scalar" | "expanded";

function toValues(value: unknown): CellData[] {
  return Array.isArray(value) ? (value as CellData[]) : [value as CellData];
}

function invokeRowTransform<T extends object>(params: {
  transform: Extract<NonNullable<ResolvedColumn<T>["transform"]>, (...args: any[]) => unknown>;
  value: unknown;
  row: T;
  rowIndex: number;
}) {
  if (params.transform.length >= 2) {
    return (
      params.transform as (value: unknown, row: T, rowIndex: number) => CellData | CellData[]
    )(params.value, params.row, params.rowIndex);
  }

  return (params.transform as (context: unknown) => CellData | CellData[])({
    ...params.row,
    ctx: undefined,
    row: params.row,
    rowIndex: params.rowIndex,
    value: params.value,
  });
}

function invokeRowHyperlink<T extends object>(params: {
  hyperlink: Extract<NonNullable<ResolvedColumn<T>["hyperlink"]>, (...args: any[]) => unknown>;
  row: T;
  rowIndex: number;
  subRowIndex: number;
}) {
  if (params.hyperlink.length >= 2) {
    return (
      params.hyperlink as (
        row: T,
        rowIndex: number,
        subRowIndex: number,
      ) => string | PlannedHyperlink | null | undefined
    )(params.row, params.rowIndex, params.subRowIndex);
  }

  return (params.hyperlink as (context: unknown) => string | PlannedHyperlink | null | undefined)({
    ...params.row,
    ctx: undefined,
    row: params.row,
    rowIndex: params.rowIndex,
    subRowIndex: params.subRowIndex,
  });
}

function resolveFormulaCell<T extends object>(params: {
  column: ResolvedColumn<T>;
  columns: ResolvedColumn<T>[];
  expr?: FormulaExpr<string, string>;
  formulaMode: "report" | "excel-table";
  tableName?: string;
  rowIndex: number;
  referenceRowsByColumnId?: Map<string, number>;
  rowSeriesBoundsByColumnId?: Map<string, { startRow: number; endRow: number }>;
  value?: PrimitiveCellValue;
}) {
  if (!params.column.formula) {
    return undefined;
  }

  const expr =
    params.expr ??
    toExpr(
      params.column.formula({
        row: createFormulaRowContext<any, any>(),
        refs: createFormulaRefs<any, any, any>(),
        fx: createFormulaFunctionsContext<any, any>(),
        ctx: undefined as never,
      } as Parameters<NonNullable<typeof params.column.formula>>[0]),
    );

  return {
    kind: "formula" as const,
    formula: serializeFormulaExpr(
      expr,
      params.columns,
      params.rowIndex,
      params.formulaMode,
      params.tableName,
      params.referenceRowsByColumnId,
      params.rowSeriesBoundsByColumnId,
    ),
    ...(params.value !== undefined ? { value: params.value } : {}),
  };
}

function resolveFormulaScopeColumns<T extends object>(
  columns: ResolvedColumn<T>[],
  scopeId: string,
) {
  return columns.filter((column) => column.scopeIds.includes(scopeId));
}

function serializeFormulaScopeExpr<T extends object>(params: {
  aggregate: "AVERAGE" | "COUNT" | "MAX" | "MIN" | "SUM";
  columns: ResolvedColumn<T>[];
  scopeId: string;
  mode: "report" | "excel-table";
  tableName?: string;
  rowIndex: number;
  referenceRowsByColumnId?: Map<string, number>;
  rowSeriesBoundsByColumnId?: Map<string, { startRow: number; endRow: number }>;
}) {
  const scopeColumns = resolveFormulaScopeColumns(params.columns, params.scopeId);
  if (scopeColumns.length === 0) {
    throw new Error(`Unknown or empty formula scope reference '${params.scopeId}'.`);
  }

  if (params.mode === "excel-table") {
    const refs = scopeColumns.map((column) =>
      params.tableName
        ? serializeExcelTableCurrentRowRef(params.tableName, column.headerLabel)
        : `[@[${escapeStructuredReferenceHeader(column.headerLabel)}]]`,
    );
    return `${params.aggregate}(${refs.join(",")})`;
  }

  const cellRefs = scopeColumns.map((column) => {
    const columnIndex = params.columns.findIndex((candidate) => candidate.id === column.id);
    if (columnIndex < 0) {
      throw new Error(`Unknown formula column reference '${column.id}'.`);
    }
    const resolvedRowIndex = params.referenceRowsByColumnId?.get(column.id) ?? params.rowIndex;
    return toCellRef(resolvedRowIndex + 1, columnIndex);
  });

  return `${params.aggregate}(${cellRefs.join(",")})`;
}

function serializeFormulaExpr<T extends object>(
  expr: FormulaExpr<string, string>,
  columns: ResolvedColumn<T>[],
  rowIndex: number,
  mode: "report" | "excel-table",
  tableName?: string,
  referenceRowsByColumnId?: Map<string, number>,
  rowSeriesBoundsByColumnId?: Map<string, { startRow: number; endRow: number }>,
): string {
  if (expr.kind === "literal") {
    if (typeof expr.value === "string") {
      return `"${expr.value.replaceAll('"', '""')}"`;
    }

    if (typeof expr.value === "boolean") {
      return expr.value ? "TRUE" : "FALSE";
    }

    return String(expr.value);
  }

  if (expr.kind === "ref") {
    const columnIndex = columns.findIndex((column) => column.id === expr.columnId);
    if (columnIndex < 0) {
      throw new Error(`Unknown formula column reference '${expr.columnId}'.`);
    }

    if (mode === "excel-table") {
      const headerLabel = columns[columnIndex]?.headerLabel;
      if (!headerLabel) {
        throw new Error(`Unknown formula column reference '${expr.columnId}'.`);
      }

      return tableName
        ? serializeExcelTableCurrentRowRef(tableName, headerLabel)
        : `[@[${escapeStructuredReferenceHeader(headerLabel)}]]`;
    }

    const resolvedRowIndex = referenceRowsByColumnId?.get(expr.columnId) ?? rowIndex;

    return toCellRef(resolvedRowIndex + 1, columnIndex);
  }

  if (expr.kind === "series") {
    throw new Error(`Series reference '${expr.columnId}' must be aggregated before serialization.`);
  }

  if (expr.kind === "collection-aggregate") {
    const columnIndex = columns.findIndex((column) => column.id === expr.target.columnId);
    if (columnIndex < 0) {
      throw new Error(`Unknown formula column reference '${expr.target.columnId}'.`);
    }

    if (mode === "excel-table") {
      throw new Error("Series aggregates are not supported in native Excel table formulas.");
    }

    const bounds = rowSeriesBoundsByColumnId?.get(expr.target.columnId);
    if (!bounds) {
      throw new Error(
        `Missing series bounds for formula column reference '${expr.target.columnId}'.`,
      );
    }

    const startRef = toCellRef(bounds.startRow + 1, columnIndex);
    const endRef = toCellRef(bounds.endRow + 1, columnIndex);

    return `${expr.aggregate}(${startRef}:${endRef})`;
  }

  if (expr.kind === "scope-aggregate") {
    return serializeFormulaScopeExpr({
      aggregate: expr.aggregate,
      columns,
      scopeId: expr.scopeId,
      mode,
      tableName,
      rowIndex,
      referenceRowsByColumnId,
      rowSeriesBoundsByColumnId,
    });
  }

  if (expr.kind === "function") {
    return `${expr.name}(${expr.args
      .map((arg) =>
        serializeFormulaExpr(
          arg,
          columns,
          rowIndex,
          mode,
          tableName,
          referenceRowsByColumnId,
          rowSeriesBoundsByColumnId,
        ),
      )
      .join(",")})`;
  }

  return `(${serializeFormulaExpr(expr.left, columns, rowIndex, mode, tableName, referenceRowsByColumnId, rowSeriesBoundsByColumnId)}${expr.op}${serializeFormulaExpr(expr.right, columns, rowIndex, mode, tableName, referenceRowsByColumnId, rowSeriesBoundsByColumnId)})`;
}

function createRowSeriesBoundsByColumnId(
  seriesModeByColumnId: Map<string, RowSeriesMode>,
  rowStartIndex: number,
  rowHeight: number,
) {
  return new Map(
    [...seriesModeByColumnId.entries()].map(([columnId, mode]) => [
      columnId,
      {
        startRow: rowStartIndex,
        endRow: rowStartIndex + (mode === "expanded" ? rowHeight - 1 : 0),
      },
    ]),
  );
}

function createReferenceRowsByColumnId(
  seriesModeByColumnId: Map<string, RowSeriesMode>,
  rowStartIndex: number,
  subRowIndex: number,
) {
  return new Map(
    [...seriesModeByColumnId.entries()].map(([columnId, mode]) => [
      columnId,
      mode === "expanded" ? rowStartIndex + subRowIndex : rowStartIndex,
    ]),
  );
}

function createFormulaEvaluationContext<T extends object>(params: {
  columns: ResolvedColumn<T>[];
  valuesByColumnId: Map<string, CellData[]>;
  seriesModeByColumnId: Map<string, RowSeriesMode>;
  subRowIndex: number;
}): FormulaEvaluationContext {
  const getColumnValue = (columnId: string): PrimitiveCellValue => {
    const values = params.valuesByColumnId.get(columnId);
    if (!values) {
      return undefined;
    }

    const index = params.seriesModeByColumnId.get(columnId) === "expanded" ? params.subRowIndex : 0;
    return getCellPrimitiveValue(values[index] ?? null);
  };

  return {
    getColumnValue,
    getColumnSeries(columnId) {
      return (params.valuesByColumnId.get(columnId) ?? []).map((value) =>
        getCellPrimitiveValue(value),
      );
    },
    getScopeValues(scopeId) {
      return resolveFormulaScopeColumns(params.columns, scopeId).map((column) =>
        getColumnValue(column.id),
      );
    },
  };
}

function formulaUsesExpandedRefs<T extends object>(
  expr: FormulaExpr<string, string>,
  seriesModeByColumnId: Map<string, RowSeriesMode>,
  columns: ResolvedColumn<T>[],
): boolean {
  if (expr.kind === "literal") {
    return false;
  }

  if (expr.kind === "ref") {
    return seriesModeByColumnId.get(expr.columnId) === "expanded";
  }

  if (expr.kind === "series") {
    return true;
  }

  if (expr.kind === "collection-aggregate") {
    return seriesModeByColumnId.get(expr.target.columnId) === "expanded";
  }

  if (expr.kind === "scope-aggregate") {
    return resolveFormulaScopeColumns(columns, expr.scopeId).some(
      (column) => seriesModeByColumnId.get(column.id) === "expanded",
    );
  }

  if (expr.kind === "function") {
    return expr.args.some((arg) => formulaUsesExpandedRefs(arg, seriesModeByColumnId, columns));
  }

  if (expr.kind !== "binary") {
    return false;
  }

  return (
    formulaUsesExpandedRefs(expr.left, seriesModeByColumnId, columns) ||
    formulaUsesExpandedRefs(expr.right, seriesModeByColumnId, columns)
  );
}

function formulaUsesSeriesAggregate(expr: FormulaExpr<string, string>): boolean {
  if (expr.kind === "literal" || expr.kind === "ref" || expr.kind === "scope-aggregate") {
    return false;
  }

  if (expr.kind === "series" || expr.kind === "collection-aggregate") {
    return true;
  }

  if (expr.kind === "function") {
    return expr.args.some((arg) => formulaUsesSeriesAggregate(arg));
  }

  if (expr.kind !== "binary") {
    return false;
  }

  return formulaUsesSeriesAggregate(expr.left) || formulaUsesSeriesAggregate(expr.right);
}

export function expandCommittedRow<T extends object>(
  columns: ResolvedColumn<T>[],
  row: T,
  sourceRowIndex: number,
  startingPhysicalRowIndex: number,
  formulaMode: "report" | "excel-table" = "report",
  excelTableName?: string,
) {
  let height = 1;
  const rawValuesByColumn = columns.map((column) => {
    const rawValue = column.formula
      ? undefined
      : column.accessor
        ? resolveAccessor(row, column.accessor, undefined)
        : undefined;
    const transformed = column.transform
      ? invokeRowTransform({
          row,
          rowIndex: sourceRowIndex,
          transform: column.transform,
          value: rawValue,
        })
      : ((rawValue ?? column.defaultValue ?? null) as PrimitiveCellValue | PrimitiveCellValue[]);
    const values = column.formula ? [] : toValues(transformed);
    height = Math.max(height, values.length);
    return values;
  });
  const seriesModeByColumnId = new Map<string, RowSeriesMode>();
  const valuesByColumnId = new Map<string, CellData[]>();
  const valuesByColumn = columns.map((column, columnIndex) => {
    if (!column.formula) {
      const values = rawValuesByColumn[columnIndex]!;
      seriesModeByColumnId.set(
        column.id,
        values.length > 1 || column.sparkline ? "expanded" : "scalar",
      );
      valuesByColumnId.set(column.id, values);
      return values;
    }

    const expr = toExpr(
      column.formula({
        row: createFormulaRowContext<any, any>(),
        refs: createFormulaRefs<any, any, any>(),
        fx: createFormulaFunctionsContext<any, any>(),
        ctx: undefined as never,
      } as Parameters<NonNullable<typeof column.formula>>[0]),
    );
    const inferredSeriesMode: RowSeriesMode = formulaUsesSeriesAggregate(expr)
      ? "scalar"
      : height > 1 && formulaUsesExpandedRefs(expr, seriesModeByColumnId, columns)
        ? "expanded"
        : "scalar";
    const seriesMode: RowSeriesMode =
      column.expansion === "expand"
        ? "expanded"
        : column.expansion === "single"
          ? "scalar"
          : inferredSeriesMode;
    seriesModeByColumnId.set(column.id, seriesMode);
    const rowSeriesBoundsByColumnId = createRowSeriesBoundsByColumnId(
      seriesModeByColumnId,
      startingPhysicalRowIndex,
      height,
    );

    const values =
      seriesMode === "expanded"
        ? Array.from({ length: height }, (_, subRowIndex) =>
            resolveFormulaCell({
              column,
              columns,
              expr,
              formulaMode,
              tableName: excelTableName,
              rowIndex: startingPhysicalRowIndex + subRowIndex,
              referenceRowsByColumnId: createReferenceRowsByColumnId(
                seriesModeByColumnId,
                startingPhysicalRowIndex,
                subRowIndex,
              ),
              rowSeriesBoundsByColumnId,
              value:
                formulaMode === "excel-table"
                  ? evaluateFormulaExpr(
                      expr,
                      createFormulaEvaluationContext({
                        columns,
                        valuesByColumnId,
                        seriesModeByColumnId,
                        subRowIndex,
                      }),
                    )
                  : undefined,
            }),
          )
        : [
            resolveFormulaCell({
              column,
              columns,
              expr,
              formulaMode,
              tableName: excelTableName,
              rowIndex: startingPhysicalRowIndex,
              referenceRowsByColumnId: createReferenceRowsByColumnId(
                seriesModeByColumnId,
                startingPhysicalRowIndex,
                0,
              ),
              rowSeriesBoundsByColumnId,
              value:
                formulaMode === "excel-table"
                  ? evaluateFormulaExpr(
                      expr,
                      createFormulaEvaluationContext({
                        columns,
                        valuesByColumnId,
                        seriesModeByColumnId,
                        subRowIndex: 0,
                      }),
                    )
                  : undefined,
            }),
          ];
    valuesByColumnId.set(column.id, values);
    return values;
  });
  const hyperlinksByColumn = columns.map((column) =>
    Array.from({ length: height }, (_, subRowIndex) =>
      resolveCellHyperlink(column, row, sourceRowIndex, subRowIndex),
    ),
  );
  const physicalRowHeights = Array.from({ length: height }, (_, subRowIndex) => {
    const rowValues = valuesByColumn.map((values) =>
      getCellPrimitiveValue(values[subRowIndex] ?? null),
    );
    const rowStyles = columns.map((column) =>
      resolveColumnStyle(column, row, sourceRowIndex, subRowIndex),
    );
    return estimateRowHeight(rowValues, rowStyles);
  });

  return {
    row,
    sourceRowIndex,
    valuesByColumn,
    hyperlinksByColumn,
    height,
    physicalRowHeights,
  } satisfies ExpandedRow<T>;
}

export function appendExpandedRowXml<T extends object>(params: {
  columns: ResolvedColumn<T>[];
  expandedRow: ExpandedRow<T>;
  startingRowIndex: number;
  columnOffset?: number;
  sharedStrings: SharedStringsCollector;
  stringMode?: "inline" | "shared";
  styleIndexesByRow?: number[][];
  rowHeight?: number;
}) {
  const fragments: string[] = [];

  for (let subRowIndex = 0; subRowIndex < params.expandedRow.height; subRowIndex += 1) {
    const physicalRowIndex = params.startingRowIndex + subRowIndex;
    const cells = params.columns.map((column, columnIndex) =>
      serializeExpandedCell(
        physicalRowIndex,
        (params.columnOffset ?? 0) + columnIndex,
        params.expandedRow.valuesByColumn[columnIndex]?.[subRowIndex] ?? null,
        params.expandedRow.hyperlinksByColumn[columnIndex]?.[subRowIndex],
        params.sharedStrings,
        params.stringMode ?? "shared",
        params.styleIndexesByRow?.[subRowIndex]?.[columnIndex],
      ),
    );

    const rowHeight = Math.max(
      params.expandedRow.physicalRowHeights[subRowIndex] ?? 0,
      params.rowHeight ?? 0,
    );
    fragments.push(
      xmlElement(
        "row",
        {
          r: physicalRowIndex + 1,
          ht: rowHeight,
          customHeight: 1,
        },
        cells,
      ),
    );
  }

  return fragments.join("");
}

function serializeExpandedCell(
  row: number,
  column: number,
  value: CellData,
  hyperlink: PlannedHyperlink | undefined,
  sharedStrings: SharedStringsCollector,
  stringMode: "inline" | "shared",
  styleIndex?: number,
) {
  if (typeof value === "string" && stringMode === "inline") {
    return serializeInlineStringCell(row, column, value, styleIndex, hyperlink);
  }

  return serializeCell(row, column, value, sharedStrings, styleIndex, hyperlink);
}

function resolveCellHyperlink<T extends object>(
  column: ResolvedColumn<T>,
  row: T,
  rowIndex: number,
  subRowIndex: number,
): PlannedHyperlink | undefined {
  const hyperlink = column.hyperlink;
  if (!hyperlink) {
    return undefined;
  }

  const resolved =
    typeof hyperlink === "function"
      ? invokeRowHyperlink({ hyperlink, row, rowIndex, subRowIndex })
      : hyperlink;

  if (!resolved) {
    return undefined;
  }

  if (typeof resolved === "string") {
    return { target: resolved };
  }

  return resolved;
}

export function updateColumnWidthStats<T extends object>(params: {
  columns: ResolvedColumn<T>[];
  expandedRow: ExpandedRow<T>;
  widths: Map<string, number>;
}) {
  params.columns.forEach((column, columnIndex) => {
    const measured = Math.max(
      ...(params.expandedRow.valuesByColumn[columnIndex] ?? []).map((value) =>
        measurePrimitiveValue(getCellPrimitiveValue(value)),
      ),
      0,
    );
    const current = params.widths.get(column.id) ?? 0;
    params.widths.set(
      column.id,
      resolveColumnWidth({
        column,
        currentWidth: current,
        measuredWidth: measured,
      }),
    );
  });
}

function resolveColumnStyle<T extends object>(
  column: ResolvedColumn<T>,
  row: T,
  rowIndex: number,
  subRowIndex: number,
): CellStyle | undefined {
  return resolveColumnCellStyle({
    column,
    ctx: undefined,
    row,
    rowIndex,
    subRowIndex,
  });
}

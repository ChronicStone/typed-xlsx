import type { ResolvedColumn } from "../planner/rows";
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

function invokeRowStyle<T extends object>(params: {
  style: Extract<NonNullable<ResolvedColumn<T>["style"]>, (...args: any[]) => unknown>;
  row: T;
  rowIndex: number;
  subRowIndex: number;
}) {
  if (params.style.length >= 3) {
    return (
      params.style as (row: T, rowIndex: number, subRowIndex: number) => CellStyle | undefined
    )(params.row, params.rowIndex, params.subRowIndex);
  }

  return (params.style as (context: unknown) => CellStyle | undefined)({
    ...params.row,
    ctx: undefined,
    row: params.row,
    rowIndex: params.rowIndex,
    subRowIndex: params.subRowIndex,
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
  formulaMode: "report" | "excel-table";
  rowIndex: number;
  referenceRowsByColumnId?: Map<string, number>;
  rowSeriesBoundsByColumnId?: Map<string, { startRow: number; endRow: number }>;
}) {
  if (!params.column.formula) {
    return undefined;
  }

  const expr = params.column.formula({
    row: createFormulaRowContext<any, any>(),
    refs: createFormulaRefs<any, any, any>(),
    fx: createFormulaFunctionsContext<any, any>(),
    ctx: undefined as never,
  } as Parameters<NonNullable<typeof params.column.formula>>[0]);

  return {
    kind: "formula" as const,
    formula: serializeFormulaExpr(
      toExpr(expr),
      params.columns,
      params.rowIndex,
      params.formulaMode,
      params.referenceRowsByColumnId,
      params.rowSeriesBoundsByColumnId,
    ),
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
  rowIndex: number;
  referenceRowsByColumnId?: Map<string, number>;
  rowSeriesBoundsByColumnId?: Map<string, { startRow: number; endRow: number }>;
}) {
  const scopeColumns = resolveFormulaScopeColumns(params.columns, params.scopeId);
  if (scopeColumns.length === 0) {
    throw new Error(`Unknown or empty formula scope reference '${params.scopeId}'.`);
  }

  if (params.mode === "excel-table") {
    const refs = scopeColumns.map((column) => `[@[${column.headerLabel.replaceAll("]", "]]")}]]`);
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

      return `[@[${headerLabel.replaceAll("]", "]]")}]]`;
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
          referenceRowsByColumnId,
          rowSeriesBoundsByColumnId,
        ),
      )
      .join(",")})`;
  }

  return `(${serializeFormulaExpr(expr.left, columns, rowIndex, mode, referenceRowsByColumnId, rowSeriesBoundsByColumnId)}${expr.op}${serializeFormulaExpr(expr.right, columns, rowIndex, mode, referenceRowsByColumnId, rowSeriesBoundsByColumnId)})`;
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
  const valuesByColumn = columns.map((column, columnIndex) => {
    if (!column.formula) {
      const values = rawValuesByColumn[columnIndex]!;
      seriesModeByColumnId.set(column.id, values.length > 1 ? "expanded" : "scalar");
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

    return seriesMode === "expanded"
      ? Array.from({ length: height }, (_, subRowIndex) =>
          resolveFormulaCell({
            column,
            columns,
            formulaMode,
            rowIndex: startingPhysicalRowIndex + subRowIndex,
            referenceRowsByColumnId: createReferenceRowsByColumnId(
              seriesModeByColumnId,
              startingPhysicalRowIndex,
              subRowIndex,
            ),
            rowSeriesBoundsByColumnId,
          }),
        )
      : [
          resolveFormulaCell({
            column,
            columns,
            formulaMode,
            rowIndex: startingPhysicalRowIndex,
            referenceRowsByColumnId: createReferenceRowsByColumnId(
              seriesModeByColumnId,
              startingPhysicalRowIndex,
              0,
            ),
            rowSeriesBoundsByColumnId,
          }),
        ];
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

    const rowHeight = params.expandedRow.physicalRowHeights[subRowIndex];
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
  if (!column.style) return undefined;
  if (typeof column.style === "function") {
    return invokeRowStyle({ row, rowIndex, style: column.style, subRowIndex });
  }
  return column.style;
}

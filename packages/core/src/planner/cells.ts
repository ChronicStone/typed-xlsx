import type { PrimitiveCellValue, SchemaContext } from "../schema/builder";
import { formulaCell, getCellPrimitiveValue, type CellData } from "../cell-data";
import {
  createFormulaFunctionsContext,
  createFormulaRefs,
  createFormulaRowContext,
  toExpr,
  type FormulaExpr,
} from "../formula/expr";
import type { FormulaEvaluationContext } from "../formula/evaluate";
import { withFormulaColumnId } from "../formula/empty-scope";
import { assertSafeHyperlinkTarget } from "../ooxml/cells";
import { resolveLazyText } from "../text";
import { resolveFormulaScopeColumns, serializeFormulaExpr } from "./formula-serialize";
import type { PlannedHyperlink, ResolvedColumn } from "./rows";

export type RowSeriesMode = "scalar" | "expanded";

export function createRowSeriesBoundsByColumnId(
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

export function createReferenceRowsByColumnId(
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

export function createFormulaEvaluationContext<T extends object>(params: {
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

export function formulaUsesExpandedRefs<T extends object>(
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

export function formulaUsesSeriesAggregate(expr: FormulaExpr<string, string>): boolean {
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

export function invokeRowHyperlink<T extends object>(params: {
  hyperlink: Extract<NonNullable<ResolvedColumn<T>["hyperlink"]>, (...args: any[]) => unknown>;
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx?: SchemaContext;
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
    ctx: params.ctx,
    row: params.row,
    rowIndex: params.rowIndex,
    subRowIndex: params.subRowIndex,
  });
}

export function buildFormulaExpr<T extends object>(
  formula: NonNullable<ResolvedColumn<T>["formula"]>,
  ctx: SchemaContext | undefined,
): FormulaExpr<string, string> {
  return toExpr(
    formula({
      row: createFormulaRowContext<any, any>(),
      refs: createFormulaRefs<any, any, any>(),
      fx: createFormulaFunctionsContext<any, any>(),
      ctx: ctx as never,
    } as Parameters<NonNullable<ResolvedColumn<T>["formula"]>>[0]),
  );
}

export function invokeRowTransform<T extends object>(params: {
  transform: NonNullable<ResolvedColumn<T>["transform"]>;
  value: unknown;
  row: T;
  rowIndex: number;
  ctx?: SchemaContext;
}) {
  if (params.transform.length >= 2) {
    return (
      params.transform as (value: unknown, row: T, rowIndex: number) => CellData | CellData[]
    )(params.value, params.row, params.rowIndex);
  }

  return (params.transform as (context: unknown) => CellData | CellData[])({
    ...params.row,
    ctx: params.ctx,
    row: params.row,
    rowIndex: params.rowIndex,
    value: params.value,
  });
}

export function resolveCellHyperlink<T extends object>(params: {
  column: ResolvedColumn<T>;
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx?: SchemaContext;
}): PlannedHyperlink | undefined {
  const hyperlink = params.column.hyperlink;
  if (!hyperlink) {
    return undefined;
  }

  const resolved =
    typeof hyperlink === "function"
      ? invokeRowHyperlink({
          ctx: params.ctx,
          hyperlink,
          row: params.row,
          rowIndex: params.rowIndex,
          subRowIndex: params.subRowIndex,
        })
      : hyperlink;

  if (!resolved) {
    return undefined;
  }

  assertSafeHyperlinkTarget(
    typeof resolved === "string" ? resolved : resolved.target,
    params.column.id,
  );

  if (typeof resolved === "string") {
    return { target: resolved };
  }

  return {
    ...resolved,
    tooltip: resolveLazyText(resolved.tooltip, {
      ...params.row,
      ctx: params.ctx,
      row: params.row,
      rowIndex: params.rowIndex,
      subRowIndex: params.subRowIndex,
    }),
  };
}

export function resolveFormulaCell<T extends object>(params: {
  column: ResolvedColumn<T>;
  columns: ResolvedColumn<T>[];
  expr?: FormulaExpr<string, string>;
  formulaMode: "report" | "excel-table";
  tableName?: string;
  rowIndex: number;
  ctx?: SchemaContext;
  referenceRowsByColumnId?: Map<string, number>;
  rowSeriesBoundsByColumnId?: Map<string, { startRow: number; endRow: number }>;
  value?: PrimitiveCellValue;
}) {
  if (!params.column.formula) {
    return undefined;
  }

  const expr = params.expr ?? buildFormulaExpr(params.column.formula, params.ctx);

  return formulaCell(
    withFormulaColumnId(params.column.id, () =>
      serializeFormulaExpr(
        expr,
        params.columns,
        params.rowIndex,
        params.formulaMode,
        params.tableName,
        params.referenceRowsByColumnId,
        params.rowSeriesBoundsByColumnId,
      ),
    ),
    params.value,
  );
}

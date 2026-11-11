import type { ResolvedColumn } from "../../planner/rows";
import {
  createFormulaFunctionsContext,
  createFormulaRefs,
  createFormulaRowContext,
  toExpr,
  type FormulaExpr,
} from "../../formula/expr";
import {
  serializeExcelTableCurrentRowRange,
  serializeExcelTableCurrentRowRef,
} from "../../formula/structured-reference";
import { serializeEmptyScopeAggregate, withFormulaColumnId } from "../../formula/empty-scope";
import type { ExcelTableStyle, ResolvedExcelTableOptions } from "../types";

import { EXCEL_MAX_TABLE_NAME } from "./limits";

const DEFAULT_EXCEL_TABLE_STYLE: ExcelTableStyle = "TableStyleMedium2";

export function resolveExcelTableOptions(params: {
  id: string;
  name?: string;
  style?: ExcelTableStyle;
  autoFilter?: boolean;
  hasMerges?: boolean;
  totalsRow?: boolean;
  columns: ResolvedColumn<any>[];
  context?: unknown;
}) {
  if (params.hasMerges) {
    throw new Error(
      "Native Excel tables require flat physical rows. Remove array-expanded columns and merged body cells, or use the default report table mode.",
    );
  }

  const name = resolveExcelTableName(params.name, params.id);
  assertValidTableHeaders(name, params.columns);

  return {
    name,
    style: params.style ?? DEFAULT_EXCEL_TABLE_STYLE,
    autoFilter: params.autoFilter ?? true,
    totalsRow: params.totalsRow ?? false,
    totalsRowColumns: params.columns.map((column) => ({
      id: column.id,
      headerLabel: column.headerLabel,
      formula: column.formula
        ? serializeCalculatedColumnFormula(column, params.columns, name, params.context)
        : undefined,
      totalsRow: column.totalsRow,
    })),
  } satisfies ResolvedExcelTableOptions;
}

function resolveScopeColumns(columns: ResolvedColumn<any>[], scopeId: string) {
  return columns.filter((candidate) => candidate.scopeIds.includes(scopeId));
}

function serializeCalculatedColumnFormula(
  column: ResolvedColumn<any>,
  columns: ResolvedColumn<any>[],
  tableName: string,
  context: unknown,
) {
  if (!column.formula) {
    return undefined;
  }

  const expr = column.formula({
    row: createFormulaRowContext<any, any>(),
    refs: createFormulaRefs<any, any, any>(),
    fx: createFormulaFunctionsContext<any, any>(),
    ctx: context as never,
  } as Parameters<NonNullable<typeof column.formula>>[0]);

  return withFormulaColumnId(column.id, () =>
    serializeFormulaExpr(toExpr(expr), columns, tableName),
  );
}

function serializeFormulaExpr(
  expr: FormulaExpr<string, string>,
  columns: ResolvedColumn<any>[],
  tableName: string,
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
    const target = columns.find((column) => column.id === expr.columnId);
    if (!target) {
      throw new Error(`Unknown formula column reference '${expr.columnId}'.`);
    }

    return serializeExcelTableCurrentRowRef(tableName, target.headerLabel);
  }

  if (expr.kind === "scope-aggregate") {
    const scopeColumns = resolveScopeColumns(columns, expr.scopeId);
    if (scopeColumns.length === 0) {
      return serializeEmptyScopeAggregate(expr.aggregate, expr.scopeId);
    }

    const orderedIndexes = scopeColumns
      .map((candidate) => columns.findIndex((column) => column.id === candidate.id))
      .sort((left, right) => left - right);
    const isContiguous = orderedIndexes.every((index, position) => {
      if (position === 0) return true;
      return index === orderedIndexes[position - 1]! + 1;
    });

    if (isContiguous) {
      return `${expr.aggregate}(${serializeExcelTableCurrentRowRange(
        tableName,
        scopeColumns[0]!.headerLabel,
        scopeColumns[scopeColumns.length - 1]!.headerLabel,
      )})`;
    }

    return `${expr.aggregate}(${scopeColumns
      .map((candidate) => serializeExcelTableCurrentRowRef(tableName, candidate.headerLabel))
      .join(",")})`;
  }

  if (expr.kind === "series" || expr.kind === "collection-aggregate") {
    throw new Error(`Unsupported Excel table formula expression kind '${expr.kind}'.`);
  }

  if (expr.kind === "function") {
    return `${expr.name}(${expr.args
      .map((arg) => serializeFormulaExpr(arg, columns, tableName))
      .join(",")})`;
  }

  return `(${serializeFormulaExpr(expr.left, columns, tableName)}${expr.op}${serializeFormulaExpr(
    expr.right,
    columns,
    tableName,
  )})`;
}

export function resolveExcelTableName(name: string | undefined, id: string) {
  const candidate = name ?? toExcelTableName(id);

  if (!isValidExcelTableName(candidate)) {
    throw new Error(
      `Invalid Excel table name '${candidate}'. Excel table names must start with a letter or underscore and contain only letters, numbers, or underscores.`,
    );
  }

  if (candidate.length > EXCEL_MAX_TABLE_NAME) {
    throw new Error(
      `Excel table name '${candidate.slice(0, 40)}…' is ${candidate.length} characters long; Excel allows ${EXCEL_MAX_TABLE_NAME}. Give the table a shorter name or id.`,
    );
  }

  if (
    /^[A-Za-z]{1,3}\d+$/.test(candidate) ||
    /^[Rr]\d*[Cc]\d*$/.test(candidate) ||
    /^[CcRr]$/.test(candidate)
  ) {
    throw new Error(
      `Excel table name '${candidate}' looks like a cell reference, which Excel does not allow. Give the table a different name or id.`,
    );
  }

  return candidate;
}

function assertValidTableHeaders(tableName: string, columns: ResolvedColumn<any>[]) {
  const seen = new Map<string, ResolvedColumn<any>>();

  for (const column of columns) {
    if (column.headerLabel.trim() === "") {
      throw new Error(
        `Column '${column.id}' of Excel table '${tableName}' has an empty header. Excel tables need a non-empty header on every column.`,
      );
    }
    if (/[\r\n]/.test(column.headerLabel)) {
      throw new Error(
        `Column '${column.id}' of Excel table '${tableName}' has a header with a line break. Remove it, or use report mode.`,
      );
    }

    const key = column.headerLabel.toLowerCase();
    const first = seen.get(key);
    if (first) {
      throw new Error(
        `Columns '${first.id}' and '${column.id}' of Excel table '${tableName}' have the same header ('${first.headerLabel}' and '${column.headerLabel}'). Excel table headers must be unique ignoring case: give one of them a different header.`,
      );
    }
    seen.set(key, column);
  }
}

function toExcelTableName(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, "_");
  const prefixed = /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
  return prefixed || "_table";
}

function isValidExcelTableName(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

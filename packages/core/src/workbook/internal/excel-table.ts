import type { ResolvedColumn } from "../../planner/rows";
import {
  createFormulaFunctionsContext,
  createFormulaRefs,
  createFormulaRowContext,
  toExpr,
  type FormulaExpr,
} from "../../formula/expr";
import type { ExcelTableStyle, ResolvedExcelTableOptions } from "../types";

const DEFAULT_EXCEL_TABLE_STYLE: ExcelTableStyle = "TableStyleMedium2";

export function resolveExcelTableOptions(params: {
  id: string;
  name?: string;
  style?: ExcelTableStyle;
  autoFilter?: boolean;
  hasMerges?: boolean;
  totalsRow?: boolean;
  columns: ResolvedColumn<any>[];
}) {
  if (params.hasMerges) {
    throw new Error(
      "Native Excel tables require flat physical rows. Remove array-expanded columns and merged body cells, or use the default report table mode.",
    );
  }

  return {
    name: resolveExcelTableName(params.name, params.id),
    style: params.style ?? DEFAULT_EXCEL_TABLE_STYLE,
    autoFilter: params.autoFilter ?? true,
    totalsRow: params.totalsRow ?? false,
    totalsRowColumns: params.columns.map((column) => ({
      id: column.id,
      headerLabel: column.headerLabel,
      formula: column.formula
        ? serializeCalculatedColumnFormula(
            column,
            params.columns,
            resolveExcelTableName(params.name, params.id),
          )
        : undefined,
      totalsRow: column.totalsRow,
    })),
  } satisfies ResolvedExcelTableOptions;
}

function escapeTableHeader(headerLabel: string) {
  return headerLabel.replaceAll("]", "]]");
}

function serializeQualifiedCurrentRowRef(tableName: string, headerLabel: string) {
  return `${tableName}[@[${escapeTableHeader(headerLabel)}]]`;
}

function serializeQualifiedCurrentRowRange(
  tableName: string,
  startHeaderLabel: string,
  endHeaderLabel: string,
) {
  return `${tableName}[@[${escapeTableHeader(startHeaderLabel)}]:[${escapeTableHeader(endHeaderLabel)}]]`;
}

function resolveScopeColumns(columns: ResolvedColumn<any>[], scopeId: string) {
  return columns.filter((candidate) => candidate.scopeIds.includes(scopeId));
}

function serializeCalculatedColumnFormula(
  column: ResolvedColumn<any>,
  columns: ResolvedColumn<any>[],
  tableName: string,
) {
  if (!column.formula) {
    return undefined;
  }

  const expr = column.formula({
    row: createFormulaRowContext<any, any>(),
    refs: createFormulaRefs<any, any, any>(),
    fx: createFormulaFunctionsContext<any, any>(),
    ctx: undefined as never,
  } as Parameters<NonNullable<typeof column.formula>>[0]);

  return serializeFormulaExpr(toExpr(expr), columns, tableName);
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

    return serializeQualifiedCurrentRowRef(tableName, target.headerLabel);
  }

  if (expr.kind === "scope-aggregate") {
    const scopeColumns = resolveScopeColumns(columns, expr.scopeId);
    if (scopeColumns.length === 0) {
      throw new Error(`Unknown or empty formula scope reference '${expr.scopeId}'.`);
    }

    const orderedIndexes = scopeColumns
      .map((candidate) => columns.findIndex((column) => column.id === candidate.id))
      .sort((left, right) => left - right);
    const isContiguous = orderedIndexes.every((index, position) => {
      if (position === 0) return true;
      return index === orderedIndexes[position - 1]! + 1;
    });

    if (isContiguous) {
      return `${expr.aggregate}(${serializeQualifiedCurrentRowRange(
        tableName,
        scopeColumns[0]!.headerLabel,
        scopeColumns[scopeColumns.length - 1]!.headerLabel,
      )})`;
    }

    return `${expr.aggregate}(${scopeColumns
      .map((candidate) => serializeQualifiedCurrentRowRef(tableName, candidate.headerLabel))
      .join(",")})`;
  }

  if (expr.kind === "series" || expr.kind === "collection-aggregate") {
    throw new Error(`Unsupported Excel table formula expression kind '${expr.kind}'.`);
  }

  if (expr.kind === "function") {
    return `${expr.name}(${expr.args.map((arg) => serializeFormulaExpr(arg, columns, tableName)).join(",")})`;
  }

  return `(${serializeFormulaExpr(expr.left, columns, tableName)}${expr.op}${serializeFormulaExpr(
    expr.right,
    columns,
    tableName,
  )})`;
}

function resolveExcelTableName(name: string | undefined, id: string) {
  const candidate = name ?? toExcelTableName(id);

  if (!isValidExcelTableName(candidate)) {
    throw new Error(
      `Invalid Excel table name '${candidate}'. Excel table names must start with a letter or underscore and contain only letters, numbers, or underscores.`,
    );
  }

  return candidate;
}

function toExcelTableName(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, "_");
  const prefixed = /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
  return prefixed || "_table";
}

function isValidExcelTableName(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

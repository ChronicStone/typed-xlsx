import type { ResolvedColumn } from "../../planner/rows";
import type { FormulaExpr } from "../../formula/expr";
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

function serializeCalculatedColumnFormula(
  column: ResolvedColumn<any>,
  columns: ResolvedColumn<any>[],
  tableName: string,
) {
  if (!column.formula) {
    return undefined;
  }

  const expr = column.formula({
    row: {
      ref(columnId: string) {
        const target = columns.find((candidate) => candidate.id === columnId);
        if (!target) {
          throw new Error(`Unknown formula column reference '${columnId}'.`);
        }

        return wrapExpr({ kind: "ref", columnId: target.id });
      },
      series(_columnId: string) {
        throw new Error("Series references are not supported in native Excel table formulas.");
      },
      group(groupId: string) {
        return {
          average() {
            return wrapExpr({ aggregate: "AVERAGE", groupId, kind: "group" });
          },
          count() {
            return wrapExpr({ aggregate: "COUNT", groupId, kind: "group" });
          },
          max() {
            return wrapExpr({ aggregate: "MAX", groupId, kind: "group" });
          },
          min() {
            return wrapExpr({ aggregate: "MIN", groupId, kind: "group" });
          },
          sum() {
            return wrapExpr({ aggregate: "SUM", groupId, kind: "group" });
          },
        };
      },
      if(condition: any, whenTrue: any, whenFalse: any) {
        return fx.if(condition, whenTrue, whenFalse);
      },
    },
    fx,
  } as unknown as Parameters<NonNullable<typeof column.formula>>[0]);

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

  if (expr.kind === "group") {
    const groupColumns = columns.filter((candidate) => candidate.groupId === expr.groupId);
    if (groupColumns.length === 0) {
      throw new Error(`Unknown or empty formula group reference '${expr.groupId}'.`);
    }

    const orderedIndexes = groupColumns
      .map((candidate) => columns.findIndex((column) => column.id === candidate.id))
      .sort((left, right) => left - right);
    const isContiguous = orderedIndexes.every((index, position) => {
      if (position === 0) return true;
      return index === orderedIndexes[position - 1]! + 1;
    });

    if (isContiguous) {
      return `${expr.aggregate}(${serializeQualifiedCurrentRowRange(
        tableName,
        groupColumns[0]!.headerLabel,
        groupColumns[groupColumns.length - 1]!.headerLabel,
      )})`;
    }

    return `${expr.aggregate}(${groupColumns
      .map((candidate) => serializeQualifiedCurrentRowRef(tableName, candidate.headerLabel))
      .join(",")})`;
  }

  if (expr.kind === "series" || expr.kind === "collection-aggregate") {
    throw new Error(`Unsupported Excel table formula expression kind '${expr.kind}'.`);
  }

  if (expr.kind === "function") {
    return `${expr.name}(${expr.args.map((arg) => serializeFormulaExpr(arg, columns, tableName)).join(",")})`;
  }

  if (expr.kind !== "binary") {
    throw new Error("Unsupported Excel table formula expression kind.");
  }

  return `(${serializeFormulaExpr(expr.left, columns, tableName)}${expr.op}${serializeFormulaExpr(
    expr.right,
    columns,
    tableName,
  )})`;
}

function literal(value: string | number | boolean): FormulaExpr<string, string> {
  return { kind: "literal", value };
}

function toExpr(value: any): FormulaExpr<string, string> {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return literal(value);
  }

  if (typeof value === "object" && value !== null && "toExpr" in value) {
    return value.toExpr();
  }

  return value;
}

function wrapExpr(expr: FormulaExpr<string, string>) {
  return {
    add(right: any) {
      return wrapExpr({ kind: "binary", left: expr, op: "+", right: toExpr(right) });
    },
    sub(right: any) {
      return wrapExpr({ kind: "binary", left: expr, op: "-", right: toExpr(right) });
    },
    mul(right: any) {
      return wrapExpr({ kind: "binary", left: expr, op: "*", right: toExpr(right) });
    },
    div(right: any) {
      return wrapExpr({ kind: "binary", left: expr, op: "/", right: toExpr(right) });
    },
    abs() {
      return wrapExpr({ args: [expr], kind: "function", name: "ABS" });
    },
    round(decimals = 0) {
      return wrapExpr({ args: [expr, literal(decimals)], kind: "function", name: "ROUND" });
    },
    eq(right: any) {
      return wrapCondition({ kind: "binary", left: expr, op: "=", right: toExpr(right) });
    },
    neq(right: any) {
      return wrapCondition({ kind: "binary", left: expr, op: "<>", right: toExpr(right) });
    },
    gt(right: any) {
      return wrapCondition({ kind: "binary", left: expr, op: ">", right: toExpr(right) });
    },
    gte(right: any) {
      return wrapCondition({ kind: "binary", left: expr, op: ">=", right: toExpr(right) });
    },
    lt(right: any) {
      return wrapCondition({ kind: "binary", left: expr, op: "<", right: toExpr(right) });
    },
    lte(right: any) {
      return wrapCondition({ kind: "binary", left: expr, op: "<=", right: toExpr(right) });
    },
    toExpr() {
      return expr;
    },
  };
}

function wrapCondition(expr: FormulaExpr<string, string>) {
  return {
    and(right: any) {
      return wrapCondition({ args: [expr, toExpr(right)], kind: "function", name: "AND" });
    },
    or(right: any) {
      return wrapCondition({ args: [expr, toExpr(right)], kind: "function", name: "OR" });
    },
    not() {
      return wrapCondition({ args: [expr], kind: "function", name: "NOT" });
    },
    toExpr() {
      return expr;
    },
  };
}

const fx = {
  abs(value: any) {
    return wrapExpr({ args: [toExpr(value)], kind: "function", name: "ABS" });
  },
  round(value: any, decimals = 0) {
    return wrapExpr({ args: [toExpr(value), literal(decimals)], kind: "function", name: "ROUND" });
  },
  min(...values: any[]) {
    return wrapExpr({ args: values.map(toExpr), kind: "function", name: "MIN" });
  },
  max(...values: any[]) {
    return wrapExpr({ args: values.map(toExpr), kind: "function", name: "MAX" });
  },
  if(condition: any, whenTrue: any, whenFalse: any) {
    return wrapExpr({
      args: [toExpr(condition), toExpr(whenTrue), toExpr(whenFalse)],
      kind: "function",
      name: "IF",
    });
  },
  and(...conditions: any[]) {
    return wrapCondition({ args: conditions.map(toExpr), kind: "function", name: "AND" });
  },
  or(...conditions: any[]) {
    return wrapCondition({ args: conditions.map(toExpr), kind: "function", name: "OR" });
  },
  not(condition: any) {
    return wrapCondition({ args: [toExpr(condition)], kind: "function", name: "NOT" });
  },
};

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

import { normalizeConditionalStyleInput } from "./conditional-types";
import { toCellRef } from "../ooxml/cells";
import type { ConditionalCellStyle } from "./conditional-types";
import type { FormulaExpr } from "../formula/expr";
import type { ResolvedColumn } from "../planner/rows";

export interface SerializedConditionalStyleRule {
  formula: string;
  priority: number;
  style: ConditionalCellStyle;
}

export interface WorksheetConditionalFormattingBlock {
  ref: string;
  rules: SerializedConditionalStyleRule[];
}

export function buildWorksheetConditionalFormatting<T extends object>(params: {
  columns: ResolvedColumn<T>[];
  rowStart: number;
  rowEnd: number;
  columnOffset: number;
  mode: "report" | "excel-table";
}) {
  if (params.rowEnd < params.rowStart) {
    return [] as WorksheetConditionalFormattingBlock[];
  }

  return params.columns.flatMap((column, columnIndex) => {
    const rules = normalizeConditionalStyleInput(column.conditionalStyle);
    if (!rules || rules.length === 0) {
      return [];
    }

    const absoluteColumnIndex = params.columnOffset + columnIndex;
    const ref = `${toCellRef(params.rowStart, absoluteColumnIndex)}:${toCellRef(params.rowEnd, absoluteColumnIndex)}`;

    return [
      {
        ref,
        rules: rules.map((rule, ruleIndex) => ({
          formula: serializeConditionalFormulaExpr(
            rule.condition,
            params.columns,
            columnIndex,
            params.mode,
          ),
          priority: ruleIndex + 1,
          style: rule.style,
        })),
      },
    ];
  });
}

function serializeConditionalFormulaExpr<T extends object>(
  expr: FormulaExpr<string, string>,
  columns: ResolvedColumn<T>[],
  targetColumnIndex: number,
  mode: "report" | "excel-table",
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

      return `INDIRECT("RC[${columnIndex - targetColumnIndex}]",FALSE)`;
    }

    return `${toConditionalColumnRef(columnIndex, targetColumnIndex)}2`;
  }

  if (expr.kind === "scope-aggregate") {
    const scopeColumns = columns.filter((column) => column.scopeIds.includes(expr.scopeId));
    if (scopeColumns.length === 0) {
      throw new Error(`Unknown or empty formula scope reference '${expr.scopeId}'.`);
    }

    const refs = scopeColumns.map((column) => {
      const columnIndex = columns.findIndex((candidate) => candidate.id === column.id);
      if (columnIndex < 0) {
        throw new Error(`Unknown formula column reference '${column.id}'.`);
      }

      if (mode === "excel-table") {
        return `INDIRECT("RC[${columnIndex - targetColumnIndex}]",FALSE)`;
      }

      return `${toConditionalColumnRef(columnIndex, targetColumnIndex)}2`;
    });

    return `${expr.aggregate}(${refs.join(",")})`;
  }

  if (expr.kind === "series" || expr.kind === "collection-aggregate") {
    throw new Error(`Unsupported conditional formula expression kind '${expr.kind}'.`);
  }

  if (expr.kind === "function") {
    return `${expr.name}(${expr.args
      .map((arg) => serializeConditionalFormulaExpr(arg, columns, targetColumnIndex, mode))
      .join(",")})`;
  }

  return `(${serializeConditionalFormulaExpr(expr.left, columns, targetColumnIndex, mode)}${expr.op}${serializeConditionalFormulaExpr(expr.right, columns, targetColumnIndex, mode)})`;
}

function toConditionalColumnRef(column: number, targetColumnIndex: number) {
  const absolute = toAbsoluteColumnRef(column);
  if (column === targetColumnIndex) {
    return absolute.replace(/\$$/, "");
  }

  return absolute.replaceAll("$", "");
}

function toAbsoluteColumnRef(column: number) {
  let result = "";
  let current = column;

  do {
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return `$${result}$`;
}

import type { FormulaExpr } from "../formula/expr";
import type { ResolvedColumn } from "../planner/rows";
import { toCellRef } from "../ooxml/cells";
import { relativeColumnRef } from "../ooxml/relative-refs";
import type { ResolvedValidationMessage } from "../text";
import type { ResolvedValidationRule, ValidationOperator, ValidationType } from "./types";

export interface WorksheetDataValidation {
  ref: string;
  type: ValidationType;
  operator?: ValidationOperator;
  formula1?: string;
  formula2?: string;
  allowBlank?: boolean;
  showDropDown?: boolean;
  prompt?: ResolvedValidationMessage;
  error?: ResolvedValidationMessage;
}

export function buildWorksheetDataValidations<T extends object>(params: {
  columns: ResolvedColumn<T>[];
  rowStart: number;
  rowEnd: number;
  columnOffset: number;
  mode: "report" | "excel-table";
}) {
  if (params.rowEnd < params.rowStart) {
    return [] as WorksheetDataValidation[];
  }

  return params.columns.flatMap((column, columnIndex) => {
    const validation = column.validation as ResolvedValidationRule<string, string> | undefined;
    if (!validation) {
      return [];
    }

    const absoluteColumnIndex = params.columnOffset + columnIndex;
    const ref = `${toCellRef(params.rowStart, absoluteColumnIndex)}:${toCellRef(params.rowEnd, absoluteColumnIndex)}`;

    return [
      {
        ref,
        type: validation.type,
        operator: validation.operator,
        formula1: serializeValidationFormula(
          validation.type === "list" ? validation.source : validation.formula1,
          params.columns,
          columnIndex,
          params.mode,
          params.columnOffset,
          validation.type,
        ),
        formula2: serializeValidationFormula(
          validation.formula2,
          params.columns,
          columnIndex,
          params.mode,
          params.columnOffset,
          validation.type,
        ),
        allowBlank: validation.allowBlank,
        showDropDown: validation.showDropDown,
        prompt: validation.prompt,
        error: validation.error,
      },
    ];
  });
}

function serializeValidationFormula<T extends object>(
  value: string | number | Date | Array<string | number> | FormulaExpr<string, string> | undefined,
  columns: ResolvedColumn<T>[],
  targetColumnIndex: number,
  mode: "report" | "excel-table",
  columnOffset: number,
  validationType?: ValidationType,
) {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    if (validationType !== "list") {
      return undefined;
    }

    return `"${value.map((entry) => String(entry).replaceAll('"', '""')).join(",")}"`;
  }

  if (value instanceof Date) {
    return String((value.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000);
  }

  if (typeof value === "string") {
    return validationType === "custom" ? value : `"${value.replaceAll('"', '""')}"`;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return serializeValidationExpr(value, columns, targetColumnIndex, mode, columnOffset);
}

function serializeValidationExpr<T extends object>(
  expr: FormulaExpr<string, string>,
  columns: ResolvedColumn<T>[],
  targetColumnIndex: number,
  mode: "report" | "excel-table",
  columnOffset: number,
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
      throw new Error(`Unknown validation column reference '${expr.columnId}'.`);
    }

    if (mode === "excel-table") {
      return `INDIRECT("RC[${columnIndex - targetColumnIndex}]",FALSE)`;
    }

    return relativeColumnRef(columnOffset + columnIndex, columnIndex === targetColumnIndex);
  }

  if (expr.kind === "scope-aggregate") {
    throw new Error("Scope references are not supported in data validation rules.");
  }

  if (expr.kind === "series" || expr.kind === "collection-aggregate") {
    throw new Error(`Unsupported validation expression kind '${expr.kind}'.`);
  }

  if (expr.kind === "function") {
    return `${expr.name}(${expr.args.map((arg) => serializeValidationExpr(arg, columns, targetColumnIndex, mode, columnOffset)).join(",")})`;
  }

  if (expr.kind !== "binary") {
    throw new Error("Unsupported validation expression kind.");
  }

  const left = serializeValidationExpr(expr.left, columns, targetColumnIndex, mode, columnOffset);
  const right = serializeValidationExpr(expr.right, columns, targetColumnIndex, mode, columnOffset);
  return `(${left}${expr.op}${right})`;
}

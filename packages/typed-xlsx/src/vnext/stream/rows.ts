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
  createFormulaFunctionsContext,
  createFormulaRowContext,
  toExpr,
  type FormulaExpr,
} from "../formula/expr";
import { toCellRef } from "../ooxml/cells";

interface ExpandedRow<T extends object> {
  row: T;
  sourceRowIndex: number;
  valuesByColumn: CellData[][];
  height: number;
  physicalRowHeights: number[];
}

function toValues(value: unknown): CellData[] {
  return Array.isArray(value) ? (value as CellData[]) : [value as CellData];
}

function resolveFormulaCell<T extends object>(params: {
  column: ResolvedColumn<T>;
  columns: ResolvedColumn<T>[];
  formulaMode: "report" | "excel-table";
  rowIndex: number;
}) {
  if (!params.column.formula) {
    return undefined;
  }

  const expr = params.column.formula({
    row: createFormulaRowContext<any>(),
    fx: createFormulaFunctionsContext<any>(),
  } as Parameters<NonNullable<typeof params.column.formula>>[0]);

  return {
    kind: "formula" as const,
    formula: serializeFormulaExpr(
      toExpr(expr),
      params.columns,
      params.rowIndex,
      params.formulaMode,
    ),
  };
}

function serializeFormulaExpr<T extends object>(
  expr: FormulaExpr<string>,
  columns: ResolvedColumn<T>[],
  rowIndex: number,
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

      return `[@${headerLabel.replaceAll("]", "]]")}]`;
    }

    return toCellRef(rowIndex + 1, columnIndex);
  }

  if (expr.kind === "function") {
    return `${expr.name}(${expr.args.map((arg) => serializeFormulaExpr(arg, columns, rowIndex, mode)).join(",")})`;
  }

  return `(${serializeFormulaExpr(expr.left, columns, rowIndex, mode)}${expr.op}${serializeFormulaExpr(expr.right, columns, rowIndex, mode)})`;
}

export function expandCommittedRow<T extends object>(
  columns: ResolvedColumn<T>[],
  row: T,
  sourceRowIndex: number,
  formulaMode: "report" | "excel-table" = "report",
) {
  let height = 1;
  const valuesByColumn = columns.map((column) => {
    const formulaCell = resolveFormulaCell({
      column,
      columns,
      formulaMode,
      rowIndex: sourceRowIndex,
    });
    const rawValue = column.formula
      ? undefined
      : column.accessor
        ? resolveAccessor(row, column.accessor)
        : undefined;
    const transformed = formulaCell
      ? formulaCell
      : column.transform
        ? column.transform(rawValue, row, sourceRowIndex)
        : ((rawValue ?? column.defaultValue ?? null) as PrimitiveCellValue | PrimitiveCellValue[]);
    const values = toValues(transformed);
    height = Math.max(height, values.length);
    return values;
  });
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
  sharedStrings: SharedStringsCollector,
  stringMode: "inline" | "shared",
  styleIndex?: number,
) {
  if (typeof value === "string" && stringMode === "inline") {
    return serializeInlineStringCell(row, column, value, styleIndex);
  }

  return serializeCell(row, column, value, sharedStrings, styleIndex);
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
    return column.style(row, rowIndex, subRowIndex);
  }
  return column.style;
}

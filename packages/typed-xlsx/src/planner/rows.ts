import { resolveAccessor } from "../core/accessor";
import type {
  ColumnDefinition,
  ColumnGroupDefinition,
  PrimitiveCellValue,
  ResolvedExcelTableTotalsRowDefinition,
  SchemaContext,
  SchemaDefinition,
} from "../schema/builder";
import { SchemaBuilder } from "../schema/builder";
import type { SummaryDefinition, SummaryRuntime } from "../summary/runtime";
import type { ResolvedValidationRule } from "../validation/types";
import {
  createSummaryRuntime,
  finalizeSummaryRuntime,
  stepSummaryRuntime,
} from "../summary/runtime";
import { normalizeSummaryInput } from "../summary/builder";
import { estimateRowHeight, measurePrimitiveValue, resolveColumnWidth } from "./metrics";
import type { CellStyle } from "../styles/types";
import { getCellPrimitiveValue, type CellData } from "../cell-data";
import {
  createFormulaFunctionsContext,
  createFormulaRowContext,
  toExpr,
  type FormulaExpr,
} from "../formula/expr";
import { toCellRef } from "../ooxml/cells";

export interface ResolvedColumn<T extends object> extends Omit<
  ColumnDefinition<T>,
  "header" | "summary" | "totalsRow" | "validation"
> {
  headerLabel: string;
  groupId?: string;
  summary?: SummaryDefinition<T, any>[];
  totalsRow?: ResolvedExcelTableTotalsRowDefinition;
  validation?: ResolvedValidationRule<string, string>;
}

function resolveFormulaGroupColumns<T extends object>(
  columns: ResolvedColumn<T>[],
  groupId: string,
) {
  return columns.filter((column) => column.groupId === groupId);
}

function serializeFormulaGroupExpr<T extends object>(params: {
  aggregate: "AVERAGE" | "COUNT" | "MAX" | "MIN" | "SUM";
  columns: ResolvedColumn<T>[];
  groupId: string;
  mode: "report" | "excel-table";
  rowIndex: number;
}) {
  const groupColumns = resolveFormulaGroupColumns(params.columns, params.groupId);
  if (groupColumns.length === 0) {
    throw new Error(`Unknown or empty formula group reference '${params.groupId}'.`);
  }

  if (params.mode === "excel-table") {
    const refs = groupColumns.map((column) => `[@[${column.headerLabel.replaceAll("]", "]]")}]]`);
    return `${params.aggregate}(${refs.join(",")})`;
  }

  const cellRefs = groupColumns.map((column) => {
    const columnIndex = params.columns.findIndex((candidate) => candidate.id === column.id);
    if (columnIndex < 0) {
      throw new Error(`Unknown formula column reference '${column.id}'.`);
    }
    return toCellRef(params.rowIndex + 1, columnIndex);
  });

  return `${params.aggregate}(${cellRefs.join(",")})`;
}

export interface PlannedCell<T extends object> {
  columnId: string;
  value: CellData;
  sourceRow: T;
  sourceRowIndex: number;
  subRowIndex: number;
}

export interface PlannedPhysicalRow<T extends object> {
  logicalRowIndex: number;
  physicalRowIndex: number;
  cells: PlannedCell<T>[];
  height: number;
}

export interface PlannedMergeRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface PlannerStats {
  columnWidths: Map<string, number>;
  rowHeights: Map<number, number>;
}

export interface PlannerResult<T extends object> {
  columns: ResolvedColumn<T>[];
  rows: PlannedPhysicalRow<T>[];
  merges: PlannedMergeRange[];
  stats: PlannerStats;
}

interface SummaryBinding<T extends object> {
  columnId: string;
  summaryIndex: number;
  definition: SummaryDefinition<T>;
  runtime: SummaryRuntime;
}

export type { SummaryBinding };

function defaultColumnHeader(id: string) {
  return (
    id.charAt(0).toUpperCase() +
    id
      .split(/(?=[A-Z])/)
      .join(" ")
      .toLowerCase()
      .slice(1)
      .replaceAll("_", " ")
  );
}

function toCellDataValues(value: unknown): CellData[] {
  return Array.isArray(value) ? (value as CellData[]) : [value as CellData];
}

function resolveFormulaCell<T extends object>(params: {
  column: ResolvedColumn<T>;
  columns: ResolvedColumn<T>[];
  columnIndex: number;
  formulaMode: "report" | "excel-table";
  rowIndex: number;
}) {
  if (!params.column.formula) {
    return undefined;
  }

  const expr = params.column.formula({
    row: createFormulaRowContext<any, any>(),
    fx: createFormulaFunctionsContext<any, any>(),
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
  expr: FormulaExpr<string, string>,
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

      return `[@[${headerLabel.replaceAll("]", "]]")}]]`;
    }

    return toCellRef(rowIndex + 1, columnIndex);
  }

  if (expr.kind === "group") {
    return serializeFormulaGroupExpr({
      aggregate: expr.aggregate,
      columns,
      groupId: expr.groupId,
      mode,
      rowIndex,
    });
  }

  if (expr.kind === "function") {
    return `${expr.name}(${expr.args.map((arg) => serializeFormulaExpr(arg, columns, rowIndex, mode)).join(",")})`;
  }

  return `(${serializeFormulaExpr(expr.left, columns, rowIndex, mode)}${expr.op}${serializeFormulaExpr(expr.right, columns, rowIndex, mode)})`;
}

function isColumnNode<T extends object>(
  node: ColumnDefinition<T> | ColumnGroupDefinition,
): node is ColumnDefinition<T> {
  return !("kind" in node && node.kind === "group");
}

export function resolveColumns<T extends object>(
  schema: SchemaDefinition<T, any, any, any, any>,
  context?: SchemaContext,
  selection?: { include?: readonly string[]; exclude?: readonly string[] },
): ResolvedColumn<T>[] {
  const columns: ResolvedColumn<T>[] = [];
  const include = selection?.include ? new Set<string>(selection.include) : null;
  const exclude = selection?.exclude ? new Set<string>(selection.exclude) : null;

  for (const node of schema.columns) {
    if (isColumnNode(node)) {
      if (include && !include.has(node.id)) {
        continue;
      }
      if (exclude?.has(node.id)) {
        continue;
      }
      columns.push({
        ...node,
        headerLabel: node.header ?? defaultColumnHeader(node.id),
      } as ResolvedColumn<T>);
      continue;
    }

    if (include && !include.has(node.id)) {
      continue;
    }
    if (exclude?.has(node.id)) {
      continue;
    }

    const groupContext = context?.[node.id];
    if (node.requiresContext && groupContext === undefined) {
      throw new Error(`Group '${node.id}' requires context.`);
    }

    const groupBuilder = SchemaBuilder.create<T>();
    node.build(groupBuilder as unknown as SchemaBuilder<T, any>, groupContext as never);
    columns.push(
      ...resolveColumns(groupBuilder.build(), context).map((column) => ({
        ...column,
        groupId: node.id,
      })),
    );
  }

  return columns;
}

export function createPlannerStats(columns: ResolvedColumn<any>[]): PlannerStats {
  const columnWidths = new Map<string, number>();

  for (const column of columns) {
    const headerWidth = measurePrimitiveValue(column.headerLabel);
    columnWidths.set(column.id, column.width ?? headerWidth);
  }

  return {
    columnWidths,
    rowHeights: new Map(),
  };
}

export function createSummaryBindings<T extends object>(
  columns: ResolvedColumn<T>[],
): Array<SummaryBinding<T>> {
  const bindings: Array<SummaryBinding<T>> = [];

  for (const column of columns) {
    if (!column.summary) continue;
    const summaries = normalizeSummaryInput(column.summary) ?? [];

    for (const [summaryIndex, definition] of summaries.entries()) {
      bindings.push({
        columnId: column.id,
        summaryIndex,
        definition,
        runtime: createSummaryRuntime(definition),
      });
    }
  }

  return bindings;
}

export function planRows<T extends object>(
  schema: SchemaDefinition<T, any, any, any, any>,
  rows: T[],
): PlannerResult<T>;
export function planRows<T extends object>(
  schema: { kind: "report" | "excel-table"; columns: ResolvedColumn<T>[] },
  rows: T[],
): PlannerResult<T>;
export function planRows<T extends object>(
  schema:
    | SchemaDefinition<T, any, any, any, any>
    | { kind: "report" | "excel-table"; columns: ResolvedColumn<T>[] },
  rows: T[],
): PlannerResult<T> {
  const columns = isResolvedColumnsInput(schema) ? schema.columns : resolveColumns(schema);
  const stats = createPlannerStats(columns);
  const summaryBindings = createSummaryBindings(columns);
  const plannedRows: PlannedPhysicalRow<T>[] = [];
  const merges: PlannedMergeRange[] = [];

  let physicalRowIndex = 0;

  rows.forEach((row, logicalRowIndex) => {
    let rowHeight = 1;
    const expandedCells: Array<{
      columnId: string;
      column: ResolvedColumn<T>;
      values: CellData[];
    }> = columns.map((column, columnIndex) => {
      const formulaCell = resolveFormulaCell({
        column,
        columns,
        columnIndex,
        formulaMode: schema.kind,
        rowIndex: logicalRowIndex,
      });
      const rawValue = column.formula
        ? undefined
        : column.accessor
          ? resolveAccessor(row, column.accessor)
          : undefined;
      const transformed = formulaCell
        ? formulaCell
        : column.transform
          ? column.transform(rawValue, row, logicalRowIndex)
          : ((rawValue ?? column.defaultValue ?? null) as
              | PrimitiveCellValue
              | PrimitiveCellValue[]);
      const values = toCellDataValues(transformed);
      rowHeight = Math.max(rowHeight, values.length);

      const measuredWidth = Math.max(
        ...values.map((value) => measurePrimitiveValue(getCellPrimitiveValue(value))),
        0,
      );
      const currentWidth = stats.columnWidths.get(column.id) ?? 0;
      stats.columnWidths.set(
        column.id,
        resolveColumnWidth({
          column,
          currentWidth,
          measuredWidth,
        }),
      );

      return {
        columnId: column.id,
        column,
        values,
      };
    });

    summaryBindings.forEach((binding) => {
      stepSummaryRuntime(binding.definition, binding.runtime, row, logicalRowIndex);
    });

    for (let subRowIndex = 0; subRowIndex < rowHeight; subRowIndex++) {
      const rowStyles: Array<CellStyle | undefined> = expandedCells.map((cell) => {
        if (!cell.column.style) return undefined;
        if (typeof cell.column.style === "function") {
          return cell.column.style(row, logicalRowIndex, subRowIndex);
        }
        return cell.column.style;
      });
      const rowValues = expandedCells.map((cell) =>
        getCellPrimitiveValue(cell.values[subRowIndex] ?? null),
      );
      const physicalHeight = estimateRowHeight(rowValues, rowStyles);

      plannedRows.push({
        logicalRowIndex,
        physicalRowIndex,
        height: physicalHeight,
        cells: expandedCells.map((cell) => ({
          columnId: cell.columnId,
          value: cell.values[subRowIndex] ?? null,
          sourceRow: row,
          sourceRowIndex: logicalRowIndex,
          subRowIndex,
        })),
      });

      stats.rowHeights.set(physicalRowIndex, physicalHeight);
      physicalRowIndex += 1;
    }

    if (rowHeight > 1) {
      expandedCells.forEach((cell, columnIndex) => {
        if (cell.values.length === 1) {
          merges.push({
            startRow: physicalRowIndex - rowHeight,
            endRow: physicalRowIndex - 1,
            startCol: columnIndex,
            endCol: columnIndex,
          });
        }
      });
    }
  });

  for (const binding of summaryBindings) {
    void finalizeSummaryRuntime(binding.definition, binding.runtime);
  }

  return {
    columns,
    rows: plannedRows,
    merges,
    stats,
  };
}

function isResolvedColumnsInput<T extends object>(
  value:
    | SchemaDefinition<T, any, any, any, any>
    | { kind: "report" | "excel-table"; columns: ResolvedColumn<T>[] },
): value is { kind: "report" | "excel-table"; columns: ResolvedColumn<T>[] } {
  return value.columns.length > 0 && "headerLabel" in value.columns[0]!;
}

import { resolveAccessor } from "../core/accessor";
import type {
  ColumnDefinition,
  ColumnGroupDefinition,
  PrimitiveCellValue,
  SchemaDefinition,
} from "../schema/builder";
import type { SummaryDefinition, SummaryRuntime } from "../summary/runtime";
import {
  createSummaryRuntime,
  finalizeSummaryRuntime,
  stepSummaryRuntime,
} from "../summary/runtime";
import { estimateRowHeight, measurePrimitiveValue, resolveColumnWidth } from "./metrics";
import type { CellStyle } from "../styles/types";

export interface ResolvedColumn<T extends object> extends ColumnDefinition<T> {
  headerLabel: string;
}

export interface PlannedCell<T extends object> {
  columnId: string;
  value: PrimitiveCellValue;
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

function toPrimitiveValues(value: PrimitiveCellValue | PrimitiveCellValue[]): PrimitiveCellValue[] {
  return Array.isArray(value) ? value : [value];
}

function isColumnNode<T extends object>(
  node: ColumnDefinition<T> | ColumnGroupDefinition<T>,
): node is ColumnDefinition<T> {
  return !("kind" in node && node.kind === "group");
}

export function resolveColumns<T extends object>(schema: SchemaDefinition<T>): ResolvedColumn<T>[] {
  const columns: ResolvedColumn<T>[] = [];

  for (const node of schema.columns) {
    if (!isColumnNode(node)) continue;
    columns.push({
      ...node,
      headerLabel: node.header ?? defaultColumnHeader(node.id),
    });
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
    const summaries = Array.isArray(column.summary) ? column.summary : [column.summary];

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
  schema: SchemaDefinition<T>,
  rows: T[],
): PlannerResult<T> {
  const columns = resolveColumns(schema);
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
      values: PrimitiveCellValue[];
    }> = columns.map((column) => {
      const rawValue = resolveAccessor(row, column.accessor);
      const transformed = column.transform
        ? column.transform(rawValue, row, logicalRowIndex)
        : ((rawValue ?? column.defaultValue ?? null) as PrimitiveCellValue | PrimitiveCellValue[]);
      const values = toPrimitiveValues(transformed);
      rowHeight = Math.max(rowHeight, values.length);

      const measuredWidth = Math.max(...values.map(measurePrimitiveValue), 0);
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
      const rowValues = expandedCells.map((cell) => cell.values[subRowIndex] ?? null);
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

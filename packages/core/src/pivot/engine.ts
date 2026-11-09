import type { PrimitiveCellValue } from "../schema/builder";
import { pivotDateKey, pivotDateLabel } from "./dates";
import type { PivotAreaStyle, SpreadsheetPivotSlotName } from "../styles/theme";
import type { PivotAggregate, PivotDateUnit, PivotShowAs, PivotSort } from "./types";

/** A source cell whose value only Excel knows, such as a report-mode formula. */
export const UNKNOWN_PIVOT_VALUE: unique symbol = Symbol("typed-xlsx.unknown-pivot-value");
export type PivotSourceValue = PrimitiveCellValue | typeof UNKNOWN_PIVOT_VALUE;

export interface PivotFieldDefinition {
  /** Index of the field in the pivot cache: a source column, or a date level added after them. */
  index: number;
  header: string;
  /** Source column the field reads, when it is a date level added after the source columns. */
  source?: number;
  /** Calendar unit of a grouped date field. */
  group?: PivotDateUnit;
}

export interface PivotValueDefinition extends PivotFieldDefinition {
  aggregate: PivotAggregate;
  name: string;
  format?: string;
  show?: PivotShowAs;
}

/** A grouped date column: one cache field per level, the source column holding the finest. */
export interface PivotDateGroupDefinition {
  source: number;
  /** Levels, outermost first. The last one is the source column itself. */
  levels: Array<{ index: number; unit: PivotDateUnit; name: string }>;
}

export interface PivotDefinition {
  id: string;
  /** Header of every source column, in order. They become the pivot cache fields. */
  sourceHeaders: string[];
  rows: PivotFieldDefinition[];
  column?: PivotFieldDefinition;
  filters: PivotFieldDefinition[];
  values: PivotValueDefinition[];
  dateGroups: PivotDateGroupDefinition[];
  sort: PivotSort;
  rowTotals: boolean;
  columnTotals: boolean;
  grandTotalLabel: string;
  /** Built-in style, used when no theme styles the pivot. */
  style: string;
  /** Pivot slots of the theme that styles the pivot. */
  theme?: Record<SpreadsheetPivotSlotName, PivotAreaStyle>;
  banded?: { rows: boolean; columns: boolean };
}

interface Accumulator {
  count: number;
  numbers: number;
  sum: number;
  min: number;
  max: number;
  unknown: boolean;
}

export interface PivotFieldItems {
  /** Distinct values in the order they first appear, as the pivot cache lists them. */
  values: PrimitiveCellValue[];
  keys: Map<string, number>;
}

const AGGREGATE_LABEL: Record<PivotAggregate, string> = {
  sum: "Sum",
  count: "Count",
  average: "Average",
  min: "Min",
  max: "Max",
};

export function defaultPivotValueName(aggregate: PivotAggregate, header: string) {
  return `${AGGREGATE_LABEL[aggregate]} of ${header}`;
}

function isBlank(value: PrimitiveCellValue) {
  return value === null || value === undefined || value === "";
}

/** Excel groups pivot items case-insensitively and keeps the first spelling. */
export function pivotItemKey(value: PrimitiveCellValue) {
  if (isBlank(value)) return "blank";
  // Whole seconds, as the cache writes dates: two items a millisecond apart would be duplicates.
  if (value instanceof Date) return `d:${Math.floor(value.getTime() / 1000)}`;
  if (typeof value === "number") return `n:${value}`;
  if (typeof value === "boolean") return `b:${value}`;
  return `s:${String(value).toLocaleLowerCase()}`;
}

function newAccumulator(): Accumulator {
  return { count: 0, numbers: 0, sum: 0, min: Infinity, max: -Infinity, unknown: false };
}

function addToAccumulator(accumulator: Accumulator, value: PivotSourceValue) {
  if (value === UNKNOWN_PIVOT_VALUE) {
    accumulator.unknown = true;
    return;
  }
  if (isBlank(value)) return;
  accumulator.count += 1;
  if (typeof value === "number" && Number.isFinite(value)) {
    accumulator.numbers += 1;
    accumulator.sum += value;
    accumulator.min = Math.min(accumulator.min, value);
    accumulator.max = Math.max(accumulator.max, value);
  }
}

function aggregateValue(accumulator: Accumulator | undefined, aggregate: PivotAggregate) {
  if (!accumulator) return null;
  if (accumulator.unknown) return null;
  switch (aggregate) {
    case "count":
      return accumulator.count;
    case "sum":
      return accumulator.numbers > 0 ? accumulator.sum : null;
    case "average":
      return accumulator.numbers > 0 ? accumulator.sum / accumulator.numbers : null;
    case "min":
      return accumulator.numbers > 0 ? accumulator.min : null;
    case "max":
      return accumulator.numbers > 0 ? accumulator.max : null;
  }
}

export class PivotFieldError extends Error {}

/** Number of pivot cache fields: the source columns, then the date levels added after them. */
export function pivotCacheFieldCount(definition: PivotDefinition) {
  return (
    definition.sourceHeaders.length +
    definition.dateGroups.reduce((count, group) => count + group.levels.length - 1, 0)
  );
}

function describeValue(value: PrimitiveCellValue) {
  return isBlank(value) ? "a blank cell" : JSON.stringify(value);
}

/** Tallies a pivot row by row, so streamed tables can feed it as batches are committed. */
export class PivotAccumulator {
  readonly items = new Map<number, PivotFieldItems>();
  /** Earliest and latest time of each grouped date column, by source column. */
  readonly dateRanges = new Map<number, { min: number; max: number }>();
  private readonly cells = new Map<string, Accumulator[]>();
  private readonly leafPaths = new Map<string, number[]>();
  recordCount = 0;

  constructor(readonly definition: PivotDefinition) {
    for (const field of this.axisFields()) {
      this.items.set(field.index, { values: [], keys: new Map() });
    }
  }

  private axisFields() {
    const { rows, column, filters } = this.definition;
    return [...rows, ...(column ? [column] : []), ...filters];
  }

  private itemOf(field: PivotFieldDefinition, value: PivotSourceValue) {
    if (value === UNKNOWN_PIVOT_VALUE) {
      throw new PivotFieldError(
        `Pivot "${this.definition.id}": "${field.header}" is computed by Excel, so it cannot be a row, column or filter.`,
      );
    }
    if (field.group) value = this.dateKey(field, value);
    const items = this.items.get(field.index)!;
    const key = pivotItemKey(value);
    let index = items.keys.get(key);
    if (index === undefined) {
      index = items.values.length;
      items.keys.set(key, index);
      items.values.push(isBlank(value) ? null : value);
    }
    return index;
  }

  private dateKey(field: PivotFieldDefinition, value: PrimitiveCellValue) {
    const source = field.source ?? field.index;
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new PivotFieldError(
        `Pivot "${this.definition.id}": "${this.definition.sourceHeaders[source]}" is grouped by ${field.group}, so every row needs a date, got ${describeValue(value)}.`,
      );
    }
    const time = value.getTime();
    const range = this.dateRanges.get(source);
    if (range) {
      range.min = Math.min(range.min, time);
      range.max = Math.max(range.max, time);
    } else {
      this.dateRanges.set(source, { min: time, max: time });
    }
    return pivotDateKey(field.group!, value);
  }

  /** Text shown for an item: its value, `(blank)`, or a date group such as `Qtr1`. */
  label(field: PivotFieldDefinition, item: number): PrimitiveCellValue {
    const value = this.items.get(field.index)!.values[item]!;
    if (field.group) return pivotDateLabel(field.group, value as number);
    return isBlank(value) ? "(blank)" : value;
  }

  add(read: (index: number) => PivotSourceValue) {
    const { rows, column, filters, values } = this.definition;
    this.recordCount += 1;
    const readField = (field: PivotFieldDefinition) => read(field.source ?? field.index);
    const path = rows.map((field) => this.itemOf(field, readField(field)));
    const columnItem = column ? this.itemOf(column, readField(column)) : undefined;
    for (const field of filters) this.itemOf(field, readField(field));
    const cellValues = values.map((value) => read(value.index));

    this.leafPaths.set(path.join(","), path);
    const columnKeys = columnItem === undefined ? ["*"] : [String(columnItem), "*"];
    for (let depth = 0; depth <= path.length; depth += 1) {
      const prefix = path.slice(0, depth).join(",");
      for (const columnKey of columnKeys) {
        const key = `${depth}|${prefix}|${columnKey}`;
        let accumulators = this.cells.get(key);
        if (!accumulators) {
          accumulators = values.map(() => newAccumulator());
          this.cells.set(key, accumulators);
        }
        cellValues.forEach((value, index) => addToAccumulator(accumulators![index]!, value));
      }
    }
  }

  value(depth: number, prefix: number[], columnKey: string, valueIndex: number) {
    const accumulator = this.cells.get(`${depth}|${prefix.join(",")}|${columnKey}`)?.[valueIndex];
    return aggregateValue(accumulator, this.definition.values[valueIndex]!.aggregate);
  }

  /** The value as the pivot shows it: the aggregate, or its share of a total. */
  shown(depth: number, prefix: number[], columnKey: string, valueIndex: number) {
    const amount = this.value(depth, prefix, columnKey, valueIndex);
    const show = this.definition.values[valueIndex]!.show;
    if (!show) return amount;
    const total =
      show === "percentOfTotal"
        ? this.value(0, [], "*", valueIndex)
        : show === "percentOfRow"
          ? this.value(depth, prefix, "*", valueIndex)
          : this.value(0, [], columnKey, valueIndex);
    if (!total) return null;
    // Excel shows 0% where a row and a column have no rows in common.
    return (amount ?? 0) / total;
  }

  paths() {
    return [...this.leafPaths.values()];
  }
}

// ── Ordering ─────────────────────────────────────────────────────────────────

function rank(value: PrimitiveCellValue) {
  if (isBlank(value)) return 3;
  if (typeof value === "number" || value instanceof Date) return 0;
  if (typeof value === "string") return 1;
  return 2;
}

function compareItems(left: PrimitiveCellValue, right: PrimitiveCellValue) {
  const byRank = rank(left) - rank(right);
  if (byRank !== 0) return byRank;
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
  }
  return Number(left) - Number(right);
}

/** Item indexes of a field in display order. Blanks always come last, as in Excel. */
export function orderPivotItems(items: PivotFieldItems, sort: PivotSort) {
  const indexes = items.values.map((_, index) => index);
  if (sort === "source") return indexes;
  const blanks = indexes.filter((index) => isBlank(items.values[index]!));
  const present = indexes
    .filter((index) => !isBlank(items.values[index]!))
    .sort((left, right) => compareItems(items.values[left]!, items.values[right]!));
  if (sort === "descending") present.reverse();
  return [...present, ...blanks];
}

// ── Layout ───────────────────────────────────────────────────────────────────

export type PivotCellRole = "page" | "header" | "label" | "value" | "total";

export interface PivotLayoutCell {
  row: number;
  col: number;
  value: PrimitiveCellValue;
  role: PivotCellRole;
  /** Value definition a numeric cell shows, for its number format. */
  valueIndex?: number;
  /** Nesting level of a row label, for indentation. */
  depth?: number;
}

export interface PivotDataColumn {
  col: number;
  valueIndex: number;
  /** Header cell naming the column, for chart series. */
  headerRow: number;
  total: boolean;
}

export interface PivotLayout {
  width: number;
  height: number;
  cells: PivotLayoutCell[];
  /** Rows used by filters above the table, including the blank row after them. */
  pageRows: number;
  /** Table part of the pivot, relative to the anchor. */
  table: { firstRow: number; lastRow: number; lastCol: number };
  firstHeaderRow: number;
  firstDataRow: number;
  firstDataCol: number;
  /** Body rows, without the grand total. */
  body: { firstRow: number; lastRow: number };
  dataColumns: PivotDataColumn[];
  /**
   * Body rows of innermost row items, with the labels of their whole path, outermost first.
   * Other body rows are the subtotals of outer items.
   */
  leaves: Array<{ row: number; labels: string[] }>;
  columnWidths: number[];
  /** Display order of each axis or filter field's items, as cache item indexes. */
  order: Map<number, number[]>;
}

function textLength(value: PrimitiveCellValue) {
  if (value === null || value === undefined) return 0;
  if (value instanceof Date) return 10;
  if (typeof value === "number")
    return Math.min(String(Math.round(value * 100) / 100).length + 3, 16);
  return String(value).length;
}

/** Cells of Excel's default compact pivot layout, relative to the pivot's top-left cell. */
export function layoutPivot(accumulator: PivotAccumulator): PivotLayout {
  const definition = accumulator.definition;
  const { rows, column, filters, values } = definition;
  const order = new Map<number, number[]>();
  for (const field of [...rows, ...(column ? [column] : []), ...filters]) {
    // Date groups keep calendar order: Excel cannot show them in the order rows arrived.
    const sort = field.group && definition.sort === "source" ? "ascending" : definition.sort;
    order.set(field.index, orderPivotItems(accumulator.items.get(field.index)!, sort));
  }

  const cells: PivotLayoutCell[] = [];
  const put = (cell: PivotLayoutCell) => cells.push(cell);

  // Filters sit above the table, followed by a blank row.
  filters.forEach((field, index) => {
    put({ row: index, col: 0, value: field.header, role: "page" });
    put({ row: index, col: 1, value: "(All)", role: "page" });
  });
  const pageRows = filters.length > 0 ? filters.length + 1 : 0;

  // Data columns: each column item × value, then the grand totals per value.
  const columnItems = column ? order.get(column.index)! : [];
  const columnLabel = (item: number) => accumulator.label(column!, item);
  const dataColumns: Array<{
    valueIndex: number;
    columnKey: string;
    item?: number;
    total: boolean;
  }> = column
    ? [
        ...columnItems.flatMap((item) =>
          values.map((_, valueIndex) => ({
            valueIndex,
            columnKey: String(item),
            item,
            total: false,
          })),
        ),
        ...(definition.columnTotals
          ? values.map((_, valueIndex) => ({ valueIndex, columnKey: "*", total: true }))
          : []),
      ]
    : values.map((_, valueIndex) => ({ valueIndex, columnKey: "*", total: false }));

  const rowCaption = rows.map((field) => field.header).join(" / ");
  const top = pageRows;
  let headerRows: number;
  const dataColumnHeaderRow: number[] = [];

  if (!column && values.length === 1) {
    headerRows = 1;
    put({ row: top, col: 0, value: rowCaption, role: "header" });
    put({ row: top, col: 1, value: values[0]!.name, role: "header" });
    dataColumnHeaderRow.push(top);
  } else if (!column) {
    // Several values without a column field: Excel puts its "Values" field above their names.
    headerRows = 2;
    put({ row: top, col: 1, value: "Values", role: "header" });
    put({ row: top + 1, col: 0, value: rowCaption, role: "header" });
    dataColumns.forEach((entry, index) => {
      put({ row: top + 1, col: index + 1, value: values[entry.valueIndex]!.name, role: "header" });
      dataColumnHeaderRow.push(top + 1);
    });
  } else if (values.length === 1) {
    headerRows = 2;
    put({ row: top, col: 0, value: values[0]!.name, role: "header" });
    put({ row: top, col: 1, value: column.header, role: "header" });
    put({ row: top + 1, col: 0, value: rowCaption, role: "header" });
    dataColumns.forEach((entry, index) => {
      const label = entry.total ? definition.grandTotalLabel : columnLabel(entry.item!);
      put({ row: top + 1, col: index + 1, value: label, role: "header" });
      dataColumnHeaderRow.push(top + 1);
    });
  } else {
    headerRows = 3;
    put({ row: top, col: 1, value: column.header, role: "header" });
    put({ row: top + 2, col: 0, value: rowCaption, role: "header" });
    dataColumns.forEach((entry, index) => {
      if (entry.total) {
        put({
          row: top + 1,
          col: index + 1,
          value: `Total ${values[entry.valueIndex]!.name}`,
          role: "header",
        });
        dataColumnHeaderRow.push(top + 1);
        return;
      }
      if (entry.valueIndex === 0) {
        put({ row: top + 1, col: index + 1, value: columnLabel(entry.item!), role: "header" });
      }
      put({ row: top + 2, col: index + 1, value: values[entry.valueIndex]!.name, role: "header" });
      dataColumnHeaderRow.push(top + 2);
    });
  }

  // Body: row items depth-first; outer items carry their subtotals on their own line.
  const childSets = new Map<string, Set<number>>();
  for (const path of accumulator.paths()) {
    path.forEach((item, depth) => {
      const key = path.slice(0, depth).join(",");
      let children = childSets.get(key);
      if (!children) {
        children = new Set();
        childSets.set(key, children);
      }
      children.add(item);
    });
  }
  const childrenOf = (prefix: number[]) => {
    const children = childSets.get(prefix.join(",")) ?? new Set<number>();
    const field = rows[prefix.length]!;
    return order.get(field.index)!.filter((item) => children.has(item));
  };

  let row = top + headerRows;
  const bodyFirstRow = row;
  const leaves: PivotLayout["leaves"] = [];
  const writeValues = (rowIndex: number, depth: number, prefix: number[], role: PivotCellRole) => {
    dataColumns.forEach((entry, index) => {
      put({
        row: rowIndex,
        col: index + 1,
        value: accumulator.shown(depth, prefix, entry.columnKey, entry.valueIndex),
        role,
        valueIndex: entry.valueIndex,
      });
    });
  };
  const visit = (prefix: number[]) => {
    for (const item of childrenOf(prefix)) {
      const path = [...prefix, item];
      const field = rows[prefix.length]!;
      put({
        row,
        col: 0,
        value: accumulator.label(field, item),
        role: "label",
        depth: prefix.length,
      });
      writeValues(row, path.length, path, "value");
      if (path.length === rows.length)
        leaves.push({
          row,
          labels: path.map((entry, depth) => String(accumulator.label(rows[depth]!, entry) ?? "")),
        });
      row += 1;
      if (path.length < rows.length) visit(path);
    }
  };
  visit([]);
  const bodyLastRow = row - 1;

  if (definition.rowTotals) {
    put({ row, col: 0, value: definition.grandTotalLabel, role: "total" });
    writeValues(row, 0, [], "total");
    row += 1;
  }

  const lastCol = dataColumns.length;
  const columnWidths = Array.from({ length: lastCol + 1 }, () => 8);
  for (const cell of cells) {
    const indent = (cell.depth ?? 0) * 2;
    columnWidths[cell.col] = Math.max(columnWidths[cell.col]!, textLength(cell.value) + indent);
  }

  return {
    width: lastCol + 1,
    height: row,
    cells,
    pageRows,
    table: { firstRow: top, lastRow: row - 1, lastCol },
    firstHeaderRow: 1,
    firstDataRow: headerRows,
    firstDataCol: 1,
    body: { firstRow: bodyFirstRow, lastRow: bodyLastRow },
    dataColumns: dataColumns.map((entry, index) => ({
      col: index + 1,
      valueIndex: entry.valueIndex,
      headerRow: dataColumnHeaderRow[index]!,
      total: entry.total,
    })),
    leaves,
    columnWidths: columnWidths.map((width) => Math.min(Math.max(width, 6), 60)),
    order,
  };
}

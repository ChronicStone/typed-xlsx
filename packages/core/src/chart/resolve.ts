import type { PrimitiveCellValue } from "../schema/builder";
import type { PivotLayout } from "../pivot/engine";
import { toCellRef } from "../ooxml/cells";
import type {
  ChartAxes,
  ChartAxisId,
  ChartDataLabels,
  ChartLegendPosition,
  ChartMark,
  ChartMarkType,
  ChartPlan,
  ChartSpec,
} from "./types";

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 320;
const DEFAULT_ROW_HEIGHT_PX = 20;
const MAX_SERIES = 255;

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface ChartTableColumnLocation {
  id: string;
  headerLabel: string;
  /** Group and dynamic block ids the column belongs to. */
  scopeIds?: readonly string[];
}

/** Where a laid-out table sits on its worksheet. Rows and columns are 0-based. */
export interface ChartTableLocation {
  worksheetName: string;
  headerRow: number;
  bodyRow: number;
  columnOffset: number;
  columns: readonly ChartTableColumnLocation[];
  physicalRowCount: number;
  logicalRowCount: number;
  /** Body cell values, when the workbook still holds them (buffered output). */
  value?: (row: number, column: number) => PrimitiveCellValue;
  /** Name of the native Excel table, for pivot sources. */
  excelTableName?: string;
}

/** Where a placed pivot sits, for pivot charts. Rows and columns are 0-based. */
export interface ChartPivotLocation {
  worksheetName: string;
  name: string;
  anchor: { row: number; col: number };
  layout: PivotLayout;
}

export interface ChartSheetInput {
  name: string;
  charts: readonly ChartPlan[];
  /** Last worksheet column used by the sheet's tables, or -1. */
  tablesEndColumn: number;
}

/** Index of every laid-out table, keyed by the sheet name given in the chain. */
export class ChartTableIndex {
  private readonly tables = new Map<string, ChartTableLocation[]>();
  private readonly pivots = new Map<string, ChartPivotLocation>();
  private readonly sheetNames = new Map<string, number>();

  addPivot(sheet: string, pivot: string, location: ChartPivotLocation) {
    this.pivots.set(`${sheet}\u0000${pivot}`, location);
  }

  locatePivot(chartId: string, source: ChartMark["source"]) {
    this.assertUniqueSheet(chartId, source);
    const location = this.pivots.get(`${source.sheet}\u0000${source.table}`);
    if (!location) {
      throw new Error(`Chart "${chartId}": no pivot "${source.table}" on sheet "${source.sheet}".`);
    }
    return location;
  }

  private assertUniqueSheet(chartId: string, source: ChartMark["source"]) {
    if ((this.sheetNames.get(source.sheet) ?? 0) > 1) {
      throw new Error(
        `Chart "${chartId}": sheet "${source.sheet}" is declared more than once, so "${sourceLabel(source)}" is ambiguous.`,
      );
    }
  }

  addSheet(name: string) {
    this.sheetNames.set(name, (this.sheetNames.get(name) ?? 0) + 1);
  }

  addTable(sheet: string, table: string, location: ChartTableLocation) {
    const key = `${sheet}\u0000${table}`;
    const entries = this.tables.get(key) ?? [];
    entries.push(location);
    this.tables.set(key, entries);
  }

  locate(chartId: string, source: ChartMark["source"]) {
    this.assertUniqueSheet(chartId, source);
    const entries = this.tables.get(`${source.sheet}\u0000${source.table}`) ?? [];
    if (entries.length === 0) {
      throw new Error(`Chart "${chartId}": no table "${source.table}" on sheet "${source.sheet}".`);
    }
    if (entries.length > 1) {
      throw new Error(
        `Chart "${chartId}": sheet "${source.sheet}" has several tables with id "${source.table}".`,
      );
    }
    return entries[0]!;
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────

export interface ChartDataRef {
  /** Sheet-qualified absolute range. Absent for an empty table, written as an empty literal. */
  formula?: string;
  count: number;
  /** Cached values, when known. */
  values?: readonly PrimitiveCellValue[];
  /**
   * Multi-level category labels, innermost level first. Each level has `count` entries; outer
   * levels name a group on its first entry only.
   */
  levels?: ReadonlyArray<ReadonlyArray<string | null>>;
}

export interface ChartSeriesName {
  text: string;
  /** Cell holding the name, so the legend follows edits to the header. */
  formula?: string;
}

export interface ResolvedDataLabels {
  value: boolean;
  category: boolean;
  series: boolean;
  percent: boolean;
  format?: string;
}

export interface ResolvedChartSeries {
  name: ChartSeriesName;
  categories: ChartDataRef;
  values: ChartDataRef;
  color?: string;
  pointColors?: string[];
  labels?: ResolvedDataLabels;
  smooth?: boolean;
  markers?: boolean;
  dashed?: boolean;
  width?: number;
  lines?: boolean;
}

export interface ResolvedChartGroup {
  type: ChartMarkType;
  axis: ChartAxisId;
  stack?: "stacked" | "percent";
  horizontal?: boolean;
  gap?: number;
  hole?: number;
  series: ResolvedChartSeries[];
}

export interface ResolvedChartAnchor {
  col: number;
  row: number;
  width: number;
  height: number;
}

export interface ResolvedChart {
  id: string;
  title?: string;
  kind: "category" | "scatter" | "pie";
  legend: ChartLegendPosition | false;
  axes: ChartAxes;
  groups: ResolvedChartGroup[];
  anchor: ResolvedChartAnchor;
  /** `[]Sheet!PivotName` when the chart is a pivot chart. */
  pivotSource?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sourceLabel(source: ChartMark["source"]) {
  return `${source.sheet}/${source.table}`;
}

function absoluteRef(row: number, column: number) {
  const match = /^([A-Z]+)(\d+)$/.exec(toCellRef(row, column))!;
  return `$${match[1]}$${match[2]}`;
}

function qualify(worksheetName: string, from: string, to?: string) {
  const sheet = `'${worksheetName.replaceAll("'", "''")}'`;
  return to && to !== from ? `${sheet}!${from}:${to}` : `${sheet}!${from}`;
}

function parseCellRef(chartId: string, value: string) {
  const match = /^\s*([A-Za-z]{1,3})(\d+)\s*$/.exec(value);
  if (!match) {
    throw new Error(`Chart "${chartId}": "at" must be a cell such as "B2", got "${value}".`);
  }
  let column = 0;
  for (const letter of match[1]!.toUpperCase()) {
    column = column * 26 + (letter.charCodeAt(0) - 64);
  }
  const row = Number(match[2]);
  // Excel sheets have rows 1 to 1,048,576 and columns A to XFD.
  if (row < 1 || row > 1_048_576 || column > 16_384) {
    throw new Error(
      `Chart "${chartId}": "at" must be a cell inside the sheet, such as "B2", got "${value}".`,
    );
  }
  return { col: column - 1, row: row - 1 };
}

export function normalizeChartColor(chartId: string, color: string) {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(color.trim());
  if (!match) {
    throw new Error(`Chart "${chartId}": color "${color}" must be a hex color such as "#2563EB".`);
  }
  return match[1]!.toUpperCase();
}

function matchKey(value: PrimitiveCellValue) {
  if (value instanceof Date) return `date:${value.getTime()}`;
  if (value === null || value === undefined || value === "") return "empty";
  return `${typeof value}:${String(value)}`;
}

function displayValue(value: PrimitiveCellValue) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value === null || value === undefined || value === "") return "(empty)";
  return JSON.stringify(value);
}

function assertRange(
  chartId: string,
  name: string,
  value: number | undefined,
  min: number,
  max: number,
) {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Chart "${chartId}": ${name} must be between ${min} and ${max}, got ${value}.`);
  }
}

function resolveLabels(labels: unknown): ResolvedDataLabels | undefined {
  if (!labels) return undefined;
  const options = labels === true ? {} : (labels as ChartDataLabels);
  return {
    value: options.value ?? !(options.percent || options.category || options.series),
    category: options.category ?? false,
    series: options.series ?? false,
    percent: options.percent ?? false,
    ...(options.format !== undefined ? { format: options.format } : {}),
  };
}

// ── Table reading ────────────────────────────────────────────────────────────

class TableReader {
  constructor(
    readonly chartId: string,
    readonly source: ChartMark["source"],
    readonly location: ChartTableLocation,
  ) {
    if (location.physicalRowCount !== location.logicalRowCount) {
      throw new Error(
        `Chart "${chartId}": table "${sourceLabel(source)}" expands rows into sub-rows, which charts do not support.`,
      );
    }
  }

  get label() {
    return sourceLabel(this.source);
  }

  columnIndex(columnId: string) {
    const index = this.location.columns.findIndex((column) => column.id === columnId);
    if (index < 0) {
      throw new Error(
        `Chart "${this.chartId}": column "${columnId}" is not rendered in table "${this.label}".`,
      );
    }
    return index;
  }

  dynamicColumns(dynamicId: string) {
    const indexes = this.location.columns.flatMap((column, index) =>
      column.scopeIds?.includes(dynamicId) ? [index] : [],
    );
    if (indexes.length === 0) {
      throw new Error(
        `Chart "${this.chartId}": dynamic block "${dynamicId}" renders no columns in table "${this.label}".`,
      );
    }
    return indexes;
  }

  header(index: number): ChartSeriesName {
    const column = this.location.columns[index]!;
    return {
      text: column.headerLabel,
      formula: qualify(
        this.location.worksheetName,
        absoluteRef(this.location.headerRow, this.location.columnOffset + index),
      ),
    };
  }

  column(index: number): ChartDataRef {
    const { location } = this;
    const count = location.physicalRowCount;
    if (count === 0) return { count: 0, values: [] };
    const sheetColumn = location.columnOffset + index;
    return {
      formula: qualify(
        location.worksheetName,
        absoluteRef(location.bodyRow, sheetColumn),
        absoluteRef(location.bodyRow + count - 1, sheetColumn),
      ),
      count,
      ...(location.value
        ? { values: Array.from({ length: count }, (_, row) => location.value!(row, index)) }
        : {}),
    };
  }

  headerRange(indexes: number[]): ChartDataRef {
    const { location } = this;
    this.assertContiguous(indexes);
    return {
      formula: qualify(
        location.worksheetName,
        absoluteRef(location.headerRow, location.columnOffset + indexes[0]!),
        absoluteRef(location.headerRow, location.columnOffset + indexes[indexes.length - 1]!),
      ),
      count: indexes.length,
      values: indexes.map((index) => location.columns[index]!.headerLabel),
    };
  }

  rowRange(row: number, indexes: number[]): ChartDataRef {
    const { location } = this;
    this.assertContiguous(indexes);
    const sheetRow = location.bodyRow + row;
    return {
      formula: qualify(
        location.worksheetName,
        absoluteRef(sheetRow, location.columnOffset + indexes[0]!),
        absoluteRef(sheetRow, location.columnOffset + indexes[indexes.length - 1]!),
      ),
      count: indexes.length,
      ...(location.value ? { values: indexes.map((index) => location.value!(row, index)) } : {}),
    };
  }

  cellName(row: number, index: number): ChartSeriesName {
    const { location } = this;
    const value = location.value?.(row, index);
    return {
      text: value === null || value === undefined ? `Row ${row + 1}` : String(value),
      formula: qualify(
        location.worksheetName,
        absoluteRef(location.bodyRow + row, location.columnOffset + index),
      ),
    };
  }

  private assertContiguous(indexes: number[]) {
    indexes.forEach((index, position) => {
      if (position > 0 && index !== indexes[position - 1]! + 1) {
        throw new Error(
          `Chart "${this.chartId}": the dynamic columns of "${this.label}" must be adjacent.`,
        );
      }
    });
  }
}

// ── Marks ────────────────────────────────────────────────────────────────────

interface ResolvedMark {
  mark: ChartMark;
  reader: TableReader;
  series: ResolvedChartSeries[];
  /** Categories used to line marks up, with the table they come from. */
  categories?: ChartDataRef;
}

type SeriesInput = string | { column: string; name?: string; color?: string } | { dynamic: string };

function toSeriesInputs(y: unknown): SeriesInput[] {
  if (y === undefined) return [];
  return Array.isArray(y) ? (y as SeriesInput[]) : [y as SeriesInput];
}

function resolveSeriesMark(chartId: string, mark: ChartMark, reader: TableReader): ResolvedMark {
  const options = mark.options as Record<string, any>;
  const labels = resolveLabels(options.labels);
  const style = {
    ...(options.smooth !== undefined ? { smooth: Boolean(options.smooth) } : {}),
    ...(options.markers !== undefined ? { markers: Boolean(options.markers) } : {}),
    ...(options.dashed !== undefined ? { dashed: Boolean(options.dashed) } : {}),
    ...(options.width !== undefined ? { width: Number(options.width) } : {}),
    ...(options.lines !== undefined ? { lines: Boolean(options.lines) } : {}),
    ...(labels ? { labels } : {}),
  };
  assertRange(chartId, "width", options.width, 0.25, 20);

  if (typeof options.x === "object" && options.x !== null && "dynamic" in options.x) {
    if (mark.type === "scatter") {
      throw new Error(`Chart "${chartId}": scatter marks need a numeric x column.`);
    }
    if (typeof options.series !== "string") {
      throw new Error(
        `Chart "${chartId}": a mark with x: { dynamic } needs series: the column naming each row.`,
      );
    }
    if (options.y !== undefined) {
      throw new Error(
        `Chart "${chartId}": a mark with x: { dynamic } takes its values from the dynamic columns, so drop y.`,
      );
    }
    const block = reader.dynamicColumns(String(options.x.dynamic));
    const nameColumn = reader.columnIndex(options.series);
    const categories = reader.headerRange(block);
    const rowCount = reader.location.physicalRowCount;
    if (rowCount > MAX_SERIES) {
      throw new Error(
        `Chart "${chartId}": "${reader.label}" has ${rowCount} rows, but a chart holds at most ${MAX_SERIES} series.`,
      );
    }
    return {
      mark,
      reader,
      categories,
      series: Array.from({ length: rowCount }, (_, row) => ({
        name: reader.cellName(row, nameColumn),
        categories,
        values: reader.rowRange(row, block),
        ...style,
      })),
    };
  }

  if (typeof options.x !== "string") {
    throw new Error(`Chart "${chartId}": every mark needs x.`);
  }
  if (options.series !== undefined) {
    throw new Error(`Chart "${chartId}": series only applies with x: { dynamic }.`);
  }
  const inputs = toSeriesInputs(options.y);
  if (inputs.length === 0) {
    throw new Error(`Chart "${chartId}": this mark needs y: the column(s) to plot.`);
  }
  const first = inputs[0];
  const single = inputs.length === 1 && !(typeof first === "object" && "dynamic" in first);
  if (!single && (options.name !== undefined || options.color !== undefined)) {
    throw new Error(
      `Chart "${chartId}": name and color apply to a single y column; set them per column with { column, name, color }.`,
    );
  }

  const xIndex = reader.columnIndex(options.x);
  const categories = reader.column(xIndex);
  const series = inputs.flatMap((input): ResolvedChartSeries[] => {
    if (typeof input === "object" && "dynamic" in input) {
      return reader.dynamicColumns(input.dynamic).map((index) => ({
        name: reader.header(index),
        categories,
        values: reader.column(index),
        ...style,
      }));
    }
    const columnId = typeof input === "string" ? input : input.column;
    const index = reader.columnIndex(columnId);
    const name = (typeof input === "object" ? input.name : undefined) ?? options.name;
    const color = (typeof input === "object" ? input.color : undefined) ?? options.color;
    return [
      {
        name: name !== undefined ? { text: String(name) } : reader.header(index),
        categories,
        values: reader.column(index),
        ...(color !== undefined ? { color: normalizeChartColor(chartId, String(color)) } : {}),
        ...style,
      },
    ];
  });

  return { mark, reader, categories, series };
}

function resolvePieMark(chartId: string, mark: ChartMark, reader: TableReader): ResolvedMark {
  const options = mark.options as Record<string, any>;
  const labelIndex = reader.columnIndex(String(options.label));
  const valueIndex = reader.columnIndex(String(options.value));
  const colors = Array.isArray(options.colors)
    ? (options.colors as string[]).map((color) => normalizeChartColor(chartId, color))
    : undefined;
  const labels = resolveLabels(options.labels);
  return {
    mark,
    reader,
    series: [
      {
        name:
          options.name !== undefined ? { text: String(options.name) } : reader.header(valueIndex),
        categories: reader.column(labelIndex),
        values: reader.column(valueIndex),
        ...(colors ? { pointColors: colors } : {}),
        ...(labels ? { labels } : {}),
      },
    ],
  };
}

function assertMarksLineUp(chartId: string, marks: ResolvedMark[]) {
  const withCategories = marks.filter((entry) => entry.categories);
  const reference = withCategories[0];
  if (!reference) return;
  for (const entry of withCategories.slice(1)) {
    const left = reference.categories!;
    const right = entry.categories!;
    if (left.count !== right.count) {
      throw new Error(
        `Chart "${chartId}": "${entry.reader.label}" has ${right.count} categories but "${reference.reader.label}" has ${left.count}. Marks line up row by row on their x column.`,
      );
    }
    if (!left.values || !right.values) continue;
    left.values.forEach((value, index) => {
      const other = right.values![index]!;
      if (matchKey(value) !== matchKey(other)) {
        throw new Error(
          `Chart "${chartId}": "${entry.reader.label}" row ${index + 1} is ${displayValue(other)} but "${reference.reader.label}" row ${index + 1} is ${displayValue(value)}. Marks line up row by row on their x column.`,
        );
      }
    });
  }
}

function chartKind(chartId: string, marks: readonly ChartMark[]): ResolvedChart["kind"] {
  const types = new Set(marks.map((mark) => mark.type));
  if (types.has("pie") || types.has("doughnut")) {
    if (marks.length > 1) {
      throw new Error(`Chart "${chartId}": a pie or doughnut chart takes a single mark.`);
    }
    return "pie";
  }
  if (types.has("scatter")) {
    if (types.size > 1) {
      throw new Error(`Chart "${chartId}": scatter marks cannot share a chart with other marks.`);
    }
    return "scatter";
  }
  const horizontal = marks.filter(
    (mark) => mark.type === "bar" && mark.options.horizontal === true,
  );
  if (horizontal.length > 0 && horizontal.length !== marks.length) {
    throw new Error(`Chart "${chartId}": horizontal bars cannot share a chart with other marks.`);
  }
  return "category";
}

function stackMode(value: unknown): ResolvedChartGroup["stack"] {
  if (value === "percent") return "percent";
  return value ? "stacked" : undefined;
}

function buildGroups(chartId: string, resolved: ResolvedMark[]) {
  const groups: ResolvedChartGroup[] = [];
  for (const { mark, series } of resolved) {
    const options = mark.options as Record<string, any>;
    const axis: ChartAxisId = options.axis === "y2" ? "y2" : "y";
    const stack =
      mark.type === "scatter" || mark.type === "pie" || mark.type === "doughnut"
        ? undefined
        : stackMode(options.stack);
    let group = groups.find((candidate) => candidate.type === mark.type && candidate.axis === axis);
    if (group && group.stack !== stack) {
      throw new Error(
        `Chart "${chartId}": ${mark.type} marks on axis "${axis}" must share the same stack option.`,
      );
    }
    if (!group) {
      assertRange(chartId, "gap", options.gap, 0, 500);
      assertRange(chartId, "hole", options.hole, 10, 90);
      group = {
        type: mark.type,
        axis,
        ...(stack ? { stack } : {}),
        ...(mark.type === "bar" && options.horizontal === true ? { horizontal: true } : {}),
        ...(options.gap !== undefined ? { gap: Number(options.gap) } : {}),
        ...(mark.type === "doughnut" ? { hole: Number(options.hole ?? 55) } : {}),
        series: [],
      };
      groups.push(group);
    }
    group.series.push(...series);
  }

  if (groups.length > 0 && groups.every((group) => group.axis === "y2")) {
    throw new Error(`Chart "${chartId}": marks on axis "y2" need at least one mark on axis "y".`);
  }
  const count = groups.reduce((total, group) => total + group.series.length, 0);
  if (count > MAX_SERIES) {
    throw new Error(
      `Chart "${chartId}": ${count} series, but a chart holds at most ${MAX_SERIES}.`,
    );
  }
  return groups;
}

function applyPalette(chartId: string, groups: ResolvedChartGroup[], palette?: readonly string[]) {
  if (!palette || palette.length === 0) return;
  const colors = palette.map((color) => normalizeChartColor(chartId, color));
  let index = 0;
  for (const group of groups) {
    for (const series of group.series) {
      if (group.type === "pie" || group.type === "doughnut") {
        series.pointColors ??= colors;
        continue;
      }
      series.color ??= colors[index % colors.length];
      index += 1;
    }
  }
}

function resolvePivotChart(
  chartId: string,
  mark: ChartMark,
  pivot: ChartPivotLocation,
): { kind: ResolvedChart["kind"]; groups: ResolvedChartGroup[]; pivotSource: string } {
  const { layout, anchor, worksheetName } = pivot;
  const options = mark.options as Record<string, any>;
  const valueAt = new Map(layout.cells.map((cell) => [`${cell.row},${cell.col}`, cell.value]));
  const bodyRows = Math.max(layout.body.lastRow - layout.body.firstRow + 1, 0);
  const columnRange = (col: number): ChartDataRef =>
    bodyRows === 0
      ? { count: 0, values: [] }
      : {
          formula: qualify(
            worksheetName,
            absoluteRef(anchor.row + layout.body.firstRow, anchor.col + col),
            absoluteRef(anchor.row + layout.body.lastRow, anchor.col + col),
          ),
          count: bodyRows,
          values: Array.from(
            { length: bodyRows },
            (_, offset) => valueAt.get(`${layout.body.firstRow + offset},${col}`) ?? null,
          ),
        };
  // With nested row fields, the body interleaves subtotal rows of outer items. The chart range
  // stays the whole body, which Excel rebuilds from the pivot, but the caches that apps without
  // pivot refresh draw from hold the innermost items only, labelled by their path.
  const nested = layout.leaves.length < bodyRows;
  const leafRange = (col: number): ChartDataRef => ({
    ...columnRange(col),
    count: layout.leaves.length,
    values: layout.leaves.map((leaf) => valueAt.get(`${leaf.row},${col}`) ?? null),
  });
  const categories: ChartDataRef = nested
    ? {
        ...leafRange(0),
        values: layout.leaves.map((leaf) => leaf.labels[leaf.labels.length - 1] ?? ""),
        levels: Array.from({ length: layout.leaves[0]?.labels.length ?? 1 }, (_, fromInner) => {
          const depth = (layout.leaves[0]?.labels.length ?? 1) - 1 - fromInner;
          return layout.leaves.map((leaf, i) => {
            const previous = layout.leaves[i - 1];
            const sameGroup =
              fromInner > 0 &&
              previous !== undefined &&
              previous.labels.slice(0, depth + 1).join("\u0000") ===
                leaf.labels.slice(0, depth + 1).join("\u0000");
            return sameGroup ? null : (leaf.labels[depth] ?? "");
          });
        }),
      }
    : columnRange(0);
  const labels = resolveLabels(options.labels);
  const pie = mark.type === "pie" || mark.type === "doughnut";
  const dataColumns = layout.dataColumns.filter((column) => !column.total);
  const series = (pie ? dataColumns.slice(0, 1) : dataColumns).map((column) => ({
    name: {
      text: String(valueAt.get(`${column.headerRow},${column.col}`) ?? ""),
      formula: qualify(
        worksheetName,
        absoluteRef(anchor.row + column.headerRow, anchor.col + column.col),
      ),
    },
    categories,
    values: nested ? leafRange(column.col) : columnRange(column.col),
    ...(options.smooth !== undefined ? { smooth: Boolean(options.smooth) } : {}),
    ...(options.markers !== undefined ? { markers: Boolean(options.markers) } : {}),
    ...(labels ? { labels } : {}),
  }));
  if (series.length > MAX_SERIES) {
    throw new Error(
      `Chart "${chartId}": the pivot has ${series.length} columns of values, but a chart holds at most ${MAX_SERIES} series.`,
    );
  }
  assertRange(chartId, "gap", options.gap, 0, 500);
  assertRange(chartId, "hole", options.hole, 10, 90);
  const stack = pie ? undefined : stackMode(options.stack);

  return {
    kind: pie ? "pie" : "category",
    pivotSource: `[]${worksheetName}!${pivot.name}`,
    groups: [
      {
        type: mark.type,
        axis: "y",
        ...(stack ? { stack } : {}),
        ...(mark.type === "bar" && options.horizontal === true ? { horizontal: true } : {}),
        ...(options.gap !== undefined ? { gap: Number(options.gap) } : {}),
        ...(mark.type === "doughnut" ? { hole: Number(options.hole ?? 55) } : {}),
        series,
      },
    ],
  };
}

function resolveChart(
  plan: ChartPlan,
  index: ChartTableIndex,
  defaultAnchor: () => { col: number; row: number },
): ResolvedChart {
  const { id, spec } = plan;
  const marks = spec.marks as readonly ChartMark[];
  if (!Array.isArray(marks) || marks.length === 0) {
    throw new Error(`Chart "${id}": needs at least one mark.`);
  }

  let kind: ResolvedChart["kind"];
  let groups: ResolvedChartGroup[];
  let pivotSource: string | undefined;
  if (marks.some((mark) => mark.source.pivot)) {
    if (marks.length > 1) throw new Error(`Chart "${id}": a pivot chart takes a single mark.`);
    const pivotChart = resolvePivotChart(id, marks[0]!, index.locatePivot(id, marks[0]!.source));
    ({ kind, groups, pivotSource } = pivotChart);
  } else {
    kind = chartKind(id, marks);
    const resolved = marks.map((mark) => {
      const reader = new TableReader(id, mark.source, index.locate(id, mark.source));
      return mark.type === "pie" || mark.type === "doughnut"
        ? resolvePieMark(id, mark, reader)
        : resolveSeriesMark(id, mark, reader);
    });
    if (kind === "category") assertMarksLineUp(id, resolved);
    groups = buildGroups(id, resolved);
  }
  applyPalette(id, groups, spec.colors);
  const seriesCount = groups.reduce((total, group) => total + group.series.length, 0);
  const legend =
    spec.legend === undefined
      ? kind === "pie" || seriesCount > 1
        ? "bottom"
        : false
      : spec.legend;

  const width = spec.size?.width ?? DEFAULT_WIDTH;
  const height = spec.size?.height ?? DEFAULT_HEIGHT;
  assertRange(id, "size.width", width, 50, 5000);
  assertRange(id, "size.height", height, 50, 5000);
  const from = spec.at ? parseCellRef(id, spec.at) : defaultAnchor();

  return {
    id,
    ...(spec.title !== undefined ? { title: spec.title } : {}),
    kind,
    legend,
    axes: spec.axes ?? {},
    groups,
    anchor: { col: from.col, row: from.row, width, height },
    ...(pivotSource ? { pivotSource } : {}),
  };
}

/** Resolves every sheet's charts against the laid-out tables of the whole workbook. */
export function resolveWorkbookCharts(
  sheets: readonly ChartSheetInput[],
  index: ChartTableIndex,
): ResolvedChart[][] {
  return sheets.map((sheet) => {
    const col = sheet.tablesEndColumn >= 0 ? sheet.tablesEndColumn + 2 : 1;
    let row = 1;
    return sheet.charts.map((plan) => {
      const spec = plan.spec as ChartSpec;
      return resolveChart(plan, index, () => {
        const anchor = { col, row };
        const height = spec.size?.height ?? DEFAULT_HEIGHT;
        row += Math.ceil(height / DEFAULT_ROW_HEIGHT_PX) + 1;
        return anchor;
      });
    });
  });
}

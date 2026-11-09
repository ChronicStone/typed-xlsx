import { isFormulaCell, type CellData } from "../../cell-data";
import {
  defaultPivotValueName,
  layoutPivot,
  PivotAccumulator,
  UNKNOWN_PIVOT_VALUE,
  type PivotDefinition,
  type PivotFieldDefinition,
  type PivotLayout,
  type PivotSourceValue,
  type PivotValueDefinition,
} from "../../pivot/engine";
import type { PivotAggregate, PivotSort, PivotSpec } from "../../pivot/types";
import {
  pivotCacheFieldNames,
  serializePivotCell,
  writePivotCacheDefinitionXml,
  writePivotTableXml,
  type PivotCacheSource,
} from "../../ooxml/pivot";
import type { StylesCollector } from "../../styles/collector";

const AGGREGATES = new Set<PivotAggregate>(["sum", "count", "average", "min", "max"]);
const SORTS = new Set<PivotSort>(["ascending", "descending", "source"]);
const DEFAULT_STYLE = "PivotStyleLight16";
/** Rows kept above a pivot without filters, as Excel does, so readers can add filters later. */
const ROWS_ABOVE_PIVOT = 2;

export interface PivotSourceColumn {
  id: string;
  headerLabel: string;
  /** Static number format of the column, used by default for sums, averages, mins and maxes. */
  format?: string;
}

/** Reads a planned cell for a pivot. Report-mode formulas have no value until Excel computes them. */
export function pivotValueOf(value: CellData | undefined): PivotSourceValue {
  if (value === undefined) return null;
  if (isFormulaCell(value)) return value.value === undefined ? UNKNOWN_PIVOT_VALUE : value.value;
  return value;
}

type ValueEntry = PivotAggregate | { aggregate: PivotAggregate; name?: string; format?: string };

/** Turns pivot options into a definition over the source table's rendered columns. */
export function createPivotDefinition(
  id: string,
  spec: PivotSpec,
  columns: readonly PivotSourceColumn[],
): PivotDefinition {
  const options = spec.options as Record<string, any>;
  const label = `${spec.source.sheet}/${spec.source.table}`;
  const fieldNames = pivotCacheFieldNames(
    columns.map((column) => column.headerLabel),
    id,
  );
  const indexOf = (columnId: unknown, role: string) => {
    const index = columns.findIndex((column) => column.id === columnId);
    if (index < 0) {
      throw new Error(
        `Pivot "${id}": ${role} "${String(columnId)}" is not rendered in table "${label}".`,
      );
    }
    return index;
  };
  const field = (columnId: unknown, role: string): PivotFieldDefinition => {
    const index = indexOf(columnId, role);
    return { index, header: fieldNames[index]! };
  };

  const rows = ((options.rows ?? []) as unknown[]).map((columnId) => field(columnId, "row"));
  if (rows.length === 0) throw new Error(`Pivot "${id}": needs at least one row field.`);
  const columnIds = (options.columns ?? []) as unknown[];
  if (columnIds.length > 1) {
    throw new Error(`Pivot "${id}": takes at most one column field.`);
  }
  const column = columnIds[0] === undefined ? undefined : field(columnIds[0], "column");
  const filters = ((options.filters ?? []) as unknown[]).map((columnId) =>
    field(columnId, "filter"),
  );

  const seen = new Set<number>();
  for (const entry of [...rows, ...(column ? [column] : []), ...filters]) {
    if (seen.has(entry.index)) {
      throw new Error(
        `Pivot "${id}": field "${columns[entry.index]!.id}" is used twice: a field is a row, a column or a filter, once.`,
      );
    }
    seen.add(entry.index);
  }

  const takenNames = new Set(fieldNames.map((name) => name.toLocaleLowerCase()));
  const values: PivotValueDefinition[] = Object.entries(
    (options.values ?? {}) as Record<string, ValueEntry | ValueEntry[]>,
  ).flatMap(([columnId, input]) => {
    const index = indexOf(columnId, "value");
    return (Array.isArray(input) ? input : [input]).map((entry) => {
      const aggregate = typeof entry === "string" ? entry : entry.aggregate;
      if (!AGGREGATES.has(aggregate)) {
        throw new Error(`Pivot "${id}": unknown aggregate "${String(aggregate)}".`);
      }
      // Excel rejects a value named like a source field; a trailing space is its own workaround.
      let name =
        (typeof entry === "object" ? entry.name : undefined) ??
        defaultPivotValueName(aggregate, fieldNames[index]!);
      while (takenNames.has(name.toLocaleLowerCase())) name = `${name} `;
      takenNames.add(name.toLocaleLowerCase());
      const format =
        (typeof entry === "object" ? entry.format : undefined) ??
        (aggregate === "count" ? undefined : columns[index]!.format);
      return {
        index,
        header: fieldNames[index]!,
        aggregate,
        name,
        ...(format ? { format } : {}),
      };
    });
  });
  if (values.length === 0) throw new Error(`Pivot "${id}": needs at least one value.`);

  const sort = (options.sort ?? "ascending") as PivotSort;
  if (!SORTS.has(sort)) throw new Error(`Pivot "${id}": unknown sort "${String(sort)}".`);
  const totals = options.totals as boolean | { row?: boolean; column?: boolean } | undefined;

  return {
    id,
    sourceHeaders: fieldNames,
    rows,
    ...(column ? { column } : {}),
    filters,
    values,
    sort,
    rowTotals: typeof totals === "object" ? (totals.row ?? true) : (totals ?? true),
    columnTotals: typeof totals === "object" ? (totals.column ?? true) : (totals ?? true),
    grandTotalLabel: (options.grandTotalLabel as string | undefined) ?? "Grand Total",
    style: (options.style as string | undefined) ?? DEFAULT_STYLE,
  };
}

export function parsePivotCell(pivotId: string, value: string) {
  const match = /^\s*([A-Za-z]{1,3})(\d+)\s*$/.exec(value);
  if (!match) {
    throw new Error(`Pivot "${pivotId}": "at" must be a cell such as "A3", got "${value}".`);
  }
  let column = 0;
  for (const letter of match[1]!.toUpperCase()) {
    column = column * 26 + (letter.charCodeAt(0) - 64);
  }
  return { col: column - 1, row: Number(match[2]) - 1 };
}

export interface RenderedPivot {
  id: string;
  cacheIndex: number;
  anchor: { row: number; col: number };
  layout: PivotLayout;
  cacheXml: string;
  tableXml: string;
  /** Serialized cells, keyed by worksheet row. */
  cells: Map<number, string[]>;
  columns: Array<{ index: number; width: number }>;
  lastRow: number;
  lastCol: number;
}

/** Places pivots on a sheet: at `at`, or stacked below the sheet's tables. */
export class PivotPlacer {
  private nextTop: number;

  constructor(tablesBottomRow: number) {
    this.nextTop = tablesBottomRow >= 0 ? tablesBottomRow + 2 : 0;
  }

  place(pivotId: string, at: unknown, layout: PivotLayout) {
    if (typeof at === "string") return parsePivotCell(pivotId, at);
    const row = this.nextTop + Math.max(0, ROWS_ABOVE_PIVOT - layout.pageRows);
    this.nextTop = row + layout.height + 1;
    return { row, col: 0 };
  }
}

export function renderPivot(params: {
  accumulator: PivotAccumulator;
  layout?: PivotLayout;
  source: PivotCacheSource;
  anchor: { row: number; col: number };
  cacheIndex: number;
  styles: StylesCollector;
}): RenderedPivot {
  const { accumulator, anchor, styles } = params;
  const definition = accumulator.definition;
  const layout = params.layout ?? layoutPivot(accumulator);
  const valueStyles = definition.values.map((value) =>
    value.format ? styles.addStyle({ numFmt: value.format }) : undefined,
  );
  const boldValueStyles = definition.values.map((value) =>
    styles.addStyle({ numFmt: value.format, font: { bold: true } }),
  );
  const boldStyle = styles.addStyle({ font: { bold: true } });
  const indentStyles = new Map<number, number>();
  const indentStyle = (depth: number) => {
    let style = indentStyles.get(depth);
    if (style === undefined) {
      style = styles.addStyle({ alignment: { horizontal: "left", indent: depth } });
      indentStyles.set(depth, style);
    }
    return style;
  };

  const cells = new Map<number, string[]>();
  for (const cell of layout.cells) {
    const style =
      cell.role === "header" || (cell.role === "total" && cell.valueIndex === undefined)
        ? boldStyle
        : cell.role === "total"
          ? boldValueStyles[cell.valueIndex!]
          : cell.role === "value"
            ? valueStyles[cell.valueIndex!]
            : cell.role === "label" && cell.depth
              ? indentStyle(cell.depth)
              : cell.role === "page" && cell.col === 0
                ? boldStyle
                : undefined;
    const row = anchor.row + cell.row;
    const xml = serializePivotCell(row, anchor.col + cell.col, cell.value, style);
    if (!xml) continue;
    const entries = cells.get(row) ?? [];
    entries.push(xml);
    cells.set(row, entries);
  }

  return {
    id: definition.id,
    cacheIndex: params.cacheIndex,
    anchor,
    layout,
    cacheXml: writePivotCacheDefinitionXml({
      accumulator,
      fieldNames: definition.sourceHeaders,
      source: params.source,
    }),
    tableXml: writePivotTableXml({
      name: definition.id,
      cacheId: params.cacheIndex,
      accumulator,
      layout,
      fieldCount: definition.sourceHeaders.length,
      anchor,
      valueNames: definition.values.map((value) => value.name),
      valueNumFmtIds: definition.values.map((value) =>
        value.format ? styles.numberFormatId(value.format) : undefined,
      ),
    }),
    cells,
    columns: layout.columnWidths.map((width, index) => ({ index: anchor.col + index, width })),
    lastRow: anchor.row + layout.height - 1,
    lastCol: anchor.col + layout.width - 1,
  };
}

/** Sheet-qualified range of a table's header row and body, as a pivot cache source. */
export function pivotCacheSource(params: {
  worksheetName: string;
  excelTableName?: string;
  headerRow: number;
  bodyRow: number;
  columnOffset: number;
  columnCount: number;
  rowCount: number;
  toCellRef: (row: number, col: number) => string;
}): PivotCacheSource {
  if (params.excelTableName) return { tableName: params.excelTableName };
  const lastRow = params.bodyRow + Math.max(params.rowCount, 1) - 1;
  return {
    sheet: params.worksheetName,
    ref: `${params.toCellRef(params.headerRow, params.columnOffset)}:${params.toCellRef(
      lastRow,
      params.columnOffset + params.columnCount - 1,
    )}`,
  };
}

/** Cells, column widths and bounds a sheet's pivots add to its worksheet. */
export interface WorksheetExtras {
  cells: Map<number, string[]>;
  columns: Array<{ index: number; width: number }>;
  lastRow: number;
  lastCol: number;
}

export function mergePivotExtras(pivots: readonly RenderedPivot[]): WorksheetExtras | undefined {
  if (pivots.length === 0) return undefined;
  const cells = new Map<number, string[]>();
  const widths = new Map<number, number>();
  for (const pivot of pivots) {
    for (const [row, entries] of pivot.cells)
      cells.set(row, [...(cells.get(row) ?? []), ...entries]);
    for (const column of pivot.columns) {
      widths.set(column.index, Math.max(widths.get(column.index) ?? 0, column.width));
    }
  }
  return {
    cells,
    columns: [...widths.entries()].map(([index, width]) => ({ index, width })),
    lastRow: Math.max(...pivots.map((pivot) => pivot.lastRow)),
    lastCol: Math.max(...pivots.map((pivot) => pivot.lastCol)),
  };
}

import { isFormulaCell, type CellData } from "../../cell-data";
import { PIVOT_DATE_FIELD_NAMES, PIVOT_DATE_UNITS } from "../../pivot/dates";
import {
  defaultPivotValueName,
  layoutPivot,
  PivotAccumulator,
  pivotCacheFieldCount,
  UNKNOWN_PIVOT_VALUE,
  type PivotDateGroupDefinition,
  type PivotDefinition,
  type PivotFieldDefinition,
  type PivotLayout,
  type PivotSourceValue,
  type PivotValueDefinition,
} from "../../pivot/engine";
import type {
  PivotAggregate,
  PivotDateUnit,
  PivotShowAs,
  PivotSort,
  PivotSpec,
} from "../../pivot/types";
import {
  pivotCacheFieldNames,
  serializePivotCell,
  writePivotCacheDefinitionXml,
  writePivotTableXml,
  type PivotCacheSource,
} from "../../ooxml/pivot";
import type { StylesCollector } from "../../styles/collector";
import { spreadsheetThemes } from "../../styles/theme";
import { deepMerge } from "../../styles/merge";
import type { CellStyle } from "../../styles/types";
import type { SpreadsheetTheme } from "../../styles/theme";
import { pivotStyleElements, pivotThemeSlots, themedPivotCellStyles } from "./pivot-theme";

const AGGREGATES = new Set<PivotAggregate>(["sum", "count", "average", "min", "max"]);
const SORTS = new Set<PivotSort>(["ascending", "descending", "source"]);
const SHOW_SUFFIX: Record<PivotShowAs, string> = {
  percentOfTotal: "% of total",
  percentOfRow: "% of row",
  percentOfColumn: "% of column",
};
const DEFAULT_PERCENT_FORMAT = "0.0%";
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

type ValueEntry =
  | PivotAggregate
  | { aggregate: PivotAggregate; show?: PivotShowAs; name?: string; format?: string };

/** Turns pivot options into a definition over the source table's rendered columns. */
export function createPivotDefinition(
  id: string,
  spec: PivotSpec,
  columns: readonly PivotSourceColumn[],
  /** Theme of the source table, which the pivot follows unless it names a style or a theme. */
  sourceTheme?: SpreadsheetTheme,
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
  const takenNames = new Set(fieldNames.map((name) => name.toLocaleLowerCase()));
  const used = new Set<number>();
  const dateGroups: PivotDateGroupDefinition[] = [];
  let nextFieldIndex = columns.length;

  /** One user field: a column, or a grouped date that becomes one field per level. */
  const fields = (input: unknown, role: "row" | "column" | "filter"): PivotFieldDefinition[] => {
    const grouped = typeof input === "object" && input !== null;
    const columnId = grouped ? (input as { field?: unknown }).field : input;
    const index = indexOf(columnId, role);
    if (used.has(index)) {
      throw new Error(
        `Pivot "${id}": field "${columns[index]!.id}" is used twice: a field is a row, a column or a filter, once.`,
      );
    }
    used.add(index);
    if (!grouped) return [{ index, header: fieldNames[index]! }];

    const by = (input as { by?: unknown }).by;
    const units = (Array.isArray(by) ? by : [by]) as PivotDateUnit[];
    const ranks = units.map((unit) => PIVOT_DATE_UNITS.indexOf(unit));
    if (
      units.length === 0 ||
      ranks.some((rank, position) => rank < 0 || (position > 0 && rank <= ranks[position - 1]!))
    ) {
      throw new Error(
        `Pivot "${id}": "${String(columnId)}" must be grouped by "year", "quarter" or "month", or several of them from the largest, got ${JSON.stringify(by)}.`,
      );
    }
    if (role !== "row" && units.length > 1) {
      throw new Error(
        `Pivot "${id}": a ${role} groups "${String(columnId)}" by one unit; only rows take several.`,
      );
    }
    const levels = units.map((unit, position) => {
      if (position === units.length - 1) return { index, unit, name: fieldNames[index]! };
      // Excel numbers repeated names, such as "Years2" for a second grouped date.
      let name = PIVOT_DATE_FIELD_NAMES[unit];
      for (let suffix = 2; takenNames.has(name.toLocaleLowerCase()); suffix += 1) {
        name = `${PIVOT_DATE_FIELD_NAMES[unit]}${suffix}`;
      }
      takenNames.add(name.toLocaleLowerCase());
      return { index: nextFieldIndex++, unit, name };
    });
    dateGroups.push({ source: index, levels });
    return levels.map((level) => ({
      index: level.index,
      header: level.name,
      source: index,
      group: level.unit,
    }));
  };

  const rows = ((options.rows ?? []) as unknown[]).flatMap((input) => fields(input, "row"));
  if (rows.length === 0) throw new Error(`Pivot "${id}": needs at least one row field.`);
  const columnInputs = (options.columns ?? []) as unknown[];
  if (columnInputs.length > 1) {
    throw new Error(`Pivot "${id}": takes at most one column field.`);
  }
  const column = columnInputs[0] === undefined ? undefined : fields(columnInputs[0], "column")[0];
  const filters = ((options.filters ?? []) as unknown[]).flatMap((input) =>
    fields(input, "filter"),
  );

  const values: PivotValueDefinition[] = Object.entries(
    (options.values ?? {}) as Record<string, ValueEntry | ValueEntry[]>,
  ).flatMap(([columnId, input]) => {
    const index = indexOf(columnId, "value");
    return (Array.isArray(input) ? input : [input]).map((entry) => {
      const aggregate = typeof entry === "string" ? entry : entry.aggregate;
      if (!AGGREGATES.has(aggregate)) {
        throw new Error(`Pivot "${id}": unknown aggregate "${String(aggregate)}".`);
      }
      const show = typeof entry === "object" ? entry.show : undefined;
      if (show !== undefined && !(show in SHOW_SUFFIX)) {
        throw new Error(`Pivot "${id}": unknown "show" value "${String(show)}".`);
      }
      // Excel rejects a value named like a source field; a trailing space is its own workaround.
      let name =
        (typeof entry === "object" ? entry.name : undefined) ??
        defaultPivotValueName(aggregate, fieldNames[index]!) +
          (show ? ` (${SHOW_SUFFIX[show]})` : "");
      while (takenNames.has(name.toLocaleLowerCase())) name = `${name} `;
      takenNames.add(name.toLocaleLowerCase());
      const format =
        (typeof entry === "object" ? entry.format : undefined) ??
        (show
          ? DEFAULT_PERCENT_FORMAT
          : aggregate === "count"
            ? undefined
            : columns[index]!.format);
      return {
        index,
        header: fieldNames[index]!,
        aggregate,
        name,
        ...(format ? { format } : {}),
        ...(show ? { show } : {}),
      };
    });
  });
  if (values.length === 0) throw new Error(`Pivot "${id}": needs at least one value.`);
  if (!column && values.some((value) => value.show === "percentOfRow")) {
    throw new Error(
      `Pivot "${id}": "percentOfRow" needs a column field: without one, every row is 100%.`,
    );
  }

  const sort = (options.sort ?? "ascending") as PivotSort;
  if (!SORTS.has(sort)) throw new Error(`Pivot "${id}": unknown sort "${String(sort)}".`);
  const totals = options.totals as boolean | { row?: boolean; column?: boolean } | undefined;
  const style = options.style as string | undefined;
  const explicitTheme = options.theme as SpreadsheetTheme | undefined;
  if (style !== undefined && explicitTheme !== undefined) {
    throw new Error(`Pivot "${id}": takes a built-in style or a theme, not both.`);
  }
  // Without a style or a theme, a pivot looks like the tables: the source table's theme, or the
  // classic theme every table uses by default.
  const theme =
    explicitTheme ?? (style === undefined ? (sourceTheme ?? spreadsheetThemes.classic) : undefined);
  const banded = options.banded as boolean | { rows?: boolean; columns?: boolean } | undefined;

  return {
    id,
    sourceHeaders: fieldNames,
    rows,
    ...(column ? { column } : {}),
    filters,
    values,
    dateGroups,
    sort,
    rowTotals: typeof totals === "object" ? (totals.row ?? true) : (totals ?? true),
    columnTotals: typeof totals === "object" ? (totals.column ?? true) : (totals ?? true),
    grandTotalLabel: (options.grandTotalLabel as string | undefined) ?? "Grand Total",
    style: style ?? DEFAULT_STYLE,
    ...(theme ? { theme: pivotThemeSlots(theme) } : {}),
    banded: {
      rows: typeof banded === "object" ? (banded.rows ?? false) : (banded ?? false),
      columns: typeof banded === "object" ? (banded.columns ?? false) : false,
    },
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
  const row = Number(match[2]);
  // Excel sheets have rows 1 to 1,048,576 and columns A to XFD.
  if (row < 1 || row > 1_048_576 || column > 16_384) {
    throw new Error(
      `Pivot "${pivotId}": "at" must be a cell inside the sheet, such as "A3", got "${value}".`,
    );
  }
  return { col: column - 1, row: row - 1 };
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

/** Zero-based, inclusive cell rectangle. */
export interface CellArea {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

const overlaps = (a: CellArea, b: CellArea) =>
  a.top <= b.bottom && b.top <= a.bottom && a.left <= b.right && b.left <= a.right;

/**
 * Places pivots on a sheet: at `at`, or stacked below everything placed so far. Excel repairs a
 * file whose pivot covers a table or another pivot, so an `at` that overlaps one throws.
 */
export class PivotPlacer {
  private nextTop: number;
  private readonly taken: Array<CellArea & { what: string }>;

  constructor(tablesBottomRow: number, tableAreas: ReadonlyArray<CellArea> = []) {
    this.nextTop = tablesBottomRow >= 0 ? tablesBottomRow + 2 : 0;
    this.taken = tableAreas.map((area) => ({ ...area, what: "a table" }));
  }

  place(pivotId: string, at: unknown, layout: PivotLayout) {
    let anchor: { row: number; col: number };
    if (typeof at === "string") {
      anchor = parsePivotCell(pivotId, at);
    } else {
      anchor = { row: this.nextTop + Math.max(0, ROWS_ABOVE_PIVOT - layout.pageRows), col: 0 };
    }
    const area = {
      top: anchor.row,
      left: anchor.col,
      bottom: anchor.row + layout.height - 1,
      right: anchor.col + layout.width - 1,
    };
    if (area.bottom > 1_048_575 || area.right > 16_383) {
      throw new Error(
        `Pivot "${pivotId}": it needs ${layout.height} rows and ${layout.width} columns from "${typeof at === "string" ? at : "its position"}", which runs past the end of the sheet.`,
      );
    }
    const clash = this.taken.find((taken) => overlaps(taken, area));
    if (clash) {
      throw new Error(
        `Pivot "${pivotId}": at "${at}" overlaps ${clash.what}. Pick a cell outside it, or leave "at" out to place the pivot below.`,
      );
    }
    this.taken.push({ ...area, what: `pivot "${pivotId}"` });
    this.nextTop = Math.max(this.nextTop, area.bottom + 2);
    return anchor;
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

  const themed = definition.theme
    ? themedPivotCellStyles(layout, definition, definition.theme)
    : undefined;
  const styleName = definition.theme
    ? styles.addPivotTableStyle(pivotStyleElements(definition.theme))
    : definition.style;
  const themedStyle = (cell: (typeof layout.cells)[number]) => {
    const format =
      cell.valueIndex === undefined ? undefined : definition.values[cell.valueIndex]!.format;
    return styles.addStyle(
      deepMerge<CellStyle>(
        themed!.get(`${cell.row},${cell.col}`),
        format ? { numFmt: format } : undefined,
        cell.role === "label" && cell.depth
          ? { alignment: { horizontal: "left", indent: cell.depth } }
          : undefined,
      ),
    );
  };

  const cells = new Map<number, string[]>();
  const put = (row: number, xml: string) => {
    if (!xml) return;
    const entries = cells.get(row) ?? [];
    entries.push(xml);
    cells.set(row, entries);
  };
  const written = new Set<string>();
  for (const cell of layout.cells) {
    written.add(`${cell.row},${cell.col}`);
    if (themed) {
      put(
        anchor.row + cell.row,
        serializePivotCell(
          anchor.row + cell.row,
          anchor.col + cell.col,
          cell.value,
          themedStyle(cell),
        ),
      );
      continue;
    }
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
    put(row, serializePivotCell(row, anchor.col + cell.col, cell.value, style));
  }
  // A themed pivot fills its whole area, so empty cells get the body's fill and borders too.
  for (const [key, style] of themed ?? []) {
    if (written.has(key)) continue;
    const [row, col] = key.split(",").map(Number) as [number, number];
    put(
      anchor.row + row,
      serializePivotCell(anchor.row + row, anchor.col + col, null, styles.addStyle(style)),
    );
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
      fieldCount: pivotCacheFieldCount(definition),
      anchor,
      styleName,
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

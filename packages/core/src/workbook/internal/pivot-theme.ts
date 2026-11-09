import type { PivotDefinition, PivotLayout } from "../../pivot/engine";
import type {
  AreaBorderStyle,
  DifferentialStyle,
  PivotStyleElementType,
} from "../../styles/collector";
import { deepMerge } from "../../styles/merge";
import type {
  PivotAreaStyle,
  SpreadsheetPivotSlotName,
  SpreadsheetTheme,
} from "../../styles/theme";
import type { BorderStyle, CellStyle } from "../../styles/types";

export type PivotThemeSlots = Record<SpreadsheetPivotSlotName, PivotAreaStyle>;

const PIVOT_SLOTS: readonly SpreadsheetPivotSlotName[] = [
  "pivotBody",
  "pivotFrame",
  "pivotHeader",
  "pivotSubheading",
  "pivotTotal",
  "pivotStripe",
];

export function pivotThemeSlots(theme: SpreadsheetTheme): PivotThemeSlots {
  return Object.fromEntries(
    PIVOT_SLOTS.map((name) => [name, (theme.slots[name] ?? {}) as PivotAreaStyle]),
  ) as PivotThemeSlots;
}

/** Drops unset keys, so equal styles serialize, and deduplicate, the same way. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isEmpty(style: DifferentialStyle) {
  const border = style.border ?? {};
  return (
    !style.font &&
    !style.fill &&
    !Object.values(border).some((side) => side !== undefined && side.style !== undefined)
  );
}

/** An area whose every cell has the slot's border: its edges, and the lines between its cells. */
function area(style: PivotAreaStyle): DifferentialStyle {
  if (!style.border) return style;
  const { left, right, top, bottom } = style.border;
  return {
    ...style,
    border: { ...style.border, vertical: left ?? right, horizontal: top ?? bottom },
  };
}

/** Elements of the custom pivot table style that a theme's pivot slots describe. */
export function pivotStyleElements(slots: PivotThemeSlots) {
  const body = slots.pivotBody;
  const cell = body.border ?? {};
  const frame = slots.pivotFrame.border ?? {};
  const wholeTable: DifferentialStyle = {
    ...(body.font ? { font: body.font } : {}),
    ...(body.fill ? { fill: body.fill } : {}),
    border: {
      left: frame.left ?? cell.left,
      right: frame.right ?? cell.right,
      top: frame.top ?? cell.top,
      bottom: frame.bottom ?? cell.bottom,
      vertical: cell.left ?? cell.right,
      horizontal: cell.top ?? cell.bottom,
    } satisfies AreaBorderStyle,
  };
  // Excel draws these areas over the whole table: along the pivot's edges they keep the frame.
  const framed = (
    style: PivotAreaStyle,
    edges: ReadonlyArray<"left" | "right" | "top" | "bottom">,
  ): DifferentialStyle => {
    const styled = area(style);
    if (!styled.border) return styled;
    const border: AreaBorderStyle = { ...styled.border };
    for (const edge of edges) if (frame[edge]) border[edge] = frame[edge];
    return { ...styled, border };
  };
  const subheading = framed(slots.pivotSubheading, ["left", "right"]);
  const elements: Array<{ type: PivotStyleElementType; style: DifferentialStyle }> = [
    { type: "wholeTable", style: wholeTable },
    { type: "headerRow", style: area(slots.pivotHeader) },
    { type: "totalRow", style: framed(slots.pivotTotal, ["left", "right", "bottom"]) },
    { type: "lastColumn", style: framed(slots.pivotTotal, ["top", "right", "bottom"]) },
    { type: "firstRowStripe", style: slots.pivotStripe },
    { type: "firstColumnStripe", style: slots.pivotStripe },
    { type: "firstRowSubheading", style: subheading },
    { type: "secondRowSubheading", style: subheading },
    { type: "thirdRowSubheading", style: subheading },
    // Filter labels look like headers, framed like the body's cells.
    { type: "pageFieldLabels", style: area({ ...slots.pivotHeader, border: body.border }) },
    { type: "pageFieldValues", style: area(body) },
  ];
  return elements
    .map((element) => ({ type: element.type, style: clean(element.style) }))
    .filter((element) => !isEmpty(element.style));
}

function cellStyle(style: PivotAreaStyle): CellStyle {
  return style as CellStyle;
}

/**
 * Styles of the cells written before Excel refreshes the pivot, for apps that never refresh it.
 * Excel replaces them with the pivot style on refresh. Keys are `row,col`, relative to the anchor.
 */
export function themedPivotCellStyles(
  layout: PivotLayout,
  definition: PivotDefinition,
  slots: PivotThemeSlots,
) {
  const styles = new Map<string, CellStyle>();
  const { firstRow, lastRow, lastCol } = layout.table;
  const frame: BorderStyle = slots.pivotFrame.border ?? {};
  const banded = definition.banded ?? { rows: false, columns: false };
  const labelDepth = new Map(
    layout.cells.filter((cell) => cell.role === "label").map((cell) => [cell.row, cell.depth ?? 0]),
  );
  const totalColumns = new Set(
    layout.dataColumns.filter((column) => column.total).map((column) => column.col),
  );
  const grandTotalRow = definition.rowTotals ? lastRow : -1;

  const areaAt = (row: number, col: number): PivotAreaStyle | undefined => {
    if (row < layout.body.firstRow) return slots.pivotHeader;
    if (row === grandTotalRow || totalColumns.has(col)) return slots.pivotTotal;
    const depth = labelDepth.get(row);
    if (depth !== undefined && depth < definition.rows.length - 1) return slots.pivotSubheading;
    return undefined;
  };
  const striped = (row: number, col: number) =>
    (banded.rows && (row - layout.body.firstRow) % 2 === 0) ||
    (banded.columns && col > 0 && !totalColumns.has(col) && (col - 1) % 2 === 0);

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let col = 0; col <= lastCol; col += 1) {
      const inBody = row >= layout.body.firstRow && row !== grandTotalRow;
      const style = deepMerge<CellStyle>(
        cellStyle(slots.pivotBody),
        inBody && striped(row, col) ? cellStyle(slots.pivotStripe) : undefined,
        cellStyle(areaAt(row, col) ?? {}),
      );
      // The frame replaces the outer edges of the cells along it.
      const border: BorderStyle = {
        ...style.border,
        ...(row === firstRow && frame.top ? { top: frame.top } : {}),
        ...(row === lastRow && frame.bottom ? { bottom: frame.bottom } : {}),
        ...(col === 0 && frame.left ? { left: frame.left } : {}),
        ...(col === lastCol && frame.right ? { right: frame.right } : {}),
      };
      styles.set(
        `${row},${col}`,
        clean({ ...style, ...(Object.keys(border).length > 0 ? { border } : {}) }),
      );
    }
  }

  definition.filters.forEach((_, index) => {
    styles.set(
      `${index},0`,
      clean(deepMerge<CellStyle>(cellStyle(slots.pivotBody), cellStyle(slots.pivotHeader))),
    );
    styles.set(`${index},1`, clean(cellStyle(slots.pivotBody)));
  });
  return styles;
}

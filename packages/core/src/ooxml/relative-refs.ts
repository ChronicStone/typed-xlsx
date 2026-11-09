import { toCellRef } from "./cells";

/**
 * Excel evaluates conditional-format and data-validation formulas relative to the top-left cell of
 * their range. Those formulas are serialized before the table is placed on the sheet, so the cell
 * references they generate are written as placeholders and resolved once the final range is known.
 *
 * The marker is U+0000, which cannot appear in XML text, so user strings (literals, list sources,
 * raw custom formulas) can never be mistaken for a placeholder.
 */
const MARK = "\u0000";
const PLACEHOLDER = new RegExp(`${MARK}(\\$?)(\\d+)${MARK}`, "g");

/** A same-row reference to `columnIndex`, resolved later against the range's top-left row. */
export function relativeColumnRef(columnIndex: number, absoluteColumn: boolean) {
  return `${MARK}${absoluteColumn ? "$" : ""}${columnIndex}${MARK}`;
}

/**
 * Resolves placeholders against a placed range: rows anchor on the range's first row, and columns
 * move by `columnShift`, the offset the range was shifted by when its table was placed.
 */
export function resolveRelativeRefs(
  formula: string,
  placedRange: string,
  columnShift: number,
): string;
export function resolveRelativeRefs(
  formula: string | undefined,
  placedRange: string,
  columnShift: number,
): string | undefined;
export function resolveRelativeRefs(
  formula: string | undefined,
  placedRange: string,
  columnShift: number,
) {
  if (formula === undefined || !formula.includes(MARK)) {
    return formula;
  }

  const anchorRow = rangeStartRow(placedRange);
  return formula.replace(PLACEHOLDER, (_match, absolute: string, column: string) => {
    const ref = toCellRef(anchorRow, Number(column) + columnShift);
    return absolute ? `$${ref}` : ref;
  });
}

export function assertRelativeRefsResolved(formula: string | undefined) {
  if (formula?.includes(MARK)) {
    throw new Error(
      "Internal error: a conditional format or data validation was written before its table was placed.",
    );
  }
}

/** 0-based row of the first cell in an A1 range such as `C3:C9`. */
function rangeStartRow(range: string) {
  const match = /^\$?[A-Z]+\$?(\d+)/.exec(range);
  if (!match) {
    throw new Error(`Invalid worksheet range '${range}'.`);
  }

  return Number(match[1]) - 1;
}

import { textElement, xmlElement, xmlEscape } from "./xml";
import type { PrimitiveCellValue } from "../schema/builder";
import type { SharedStringsCollector } from "./shared-strings";
import { assertCellTextLength } from "../workbook/internal/limits";
import { isFormulaCell, type CellData } from "../cell-data";

const EXCEL_MIN_DATE_MS = Date.UTC(1900, 0, 1);
const EXCEL_MAX_DATE_MS = Date.UTC(9999, 11, 31, 23, 59, 59, 999);

function toExcelSerialDate(ref: string, value: Date) {
  const time = value.getTime();
  if (Number.isNaN(time)) {
    throw new Error(
      `Cell ${ref} has an invalid Date. Return a valid Date or null from the accessor.`,
    );
  }
  if (time < EXCEL_MIN_DATE_MS || time > EXCEL_MAX_DATE_MS) {
    throw new Error(
      `Cell ${ref} has the date ${value.toISOString()}, which is outside Excel's range (1900-01-01 to 9999-12-31). Return a date in that range, a string or null from the accessor.`,
    );
  }
  return (time - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/**
 * Maps a raw accessor result to a value Excel can store. Throws for values that would otherwise
 * produce an invalid file or silently become an empty cell.
 */
function toWritableValue(ref: string, value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  switch (typeof value) {
    case "string":
      assertCellTextLength(ref, value);
      return value;
    case "boolean":
      return value;
    case "number":
      if (!Number.isFinite(value)) {
        throw new Error(
          `Cell ${ref} has the number ${String(value)}. Excel cannot store it: map it to null or a finite number in the accessor.`,
        );
      }
      return value;
    case "bigint": {
      const asNumber = Number(value);
      return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
    }
    case "object":
      if (value instanceof Date) return value;
      break;
    default:
      break;
  }
  throw new Error(
    `Cell ${ref} got a ${typeof value} value. Return a string, number, boolean, Date or null from the accessor (for a Decimal, call .toNumber() or .toString()).`,
  );
}

export function toCellRef(row: number, column: number) {
  let result = "";
  let current = column;

  do {
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return `${result}${row + 1}`;
}

const BLOCKED_HYPERLINK_SCHEME = /^(javascript|vbscript|data):/i;

/** Rejects hyperlink targets that run script when clicked. Other schemes are left alone. */
export function assertSafeHyperlinkTarget(target: string, columnId: string) {
  // Browsers ignore whitespace and control characters inside a scheme ("java\tscript:").
  // eslint-disable-next-line no-control-regex
  const normalized = target.replace(/[\u0000-\u0020\u007F]+/g, "");
  const match = BLOCKED_HYPERLINK_SCHEME.exec(normalized);
  if (match) {
    throw new Error(
      `Column '${columnId}' has a hyperlink with the '${match[1]!.toLowerCase()}:' scheme, which is not allowed. Use an http(s), mailto, file, relative or '#Sheet!A1' target.`,
    );
  }
}

export function serializeCell(
  row: number,
  column: number,
  value: CellData,
  sharedStrings: SharedStringsCollector,
  styleIndex?: number,
  _hyperlink?: import("../planner/rows").PlannedHyperlink,
) {
  const ref = toCellRef(row, column);
  const style = styleIndex && styleIndex > 0 ? ` s="${styleIndex}"` : "";
  const opening = `<c r="${ref}"${style}`;

  if (isFormulaCell(value)) {
    return serializeFormulaCell(
      ref,
      { r: ref, s: styleIndex && styleIndex > 0 ? styleIndex : undefined },
      value.formula,
      value.value,
    );
  }

  const writable = toWritableValue(ref, value);

  if (writable === null) {
    return `${opening}/>`;
  }

  if (typeof writable === "string") {
    const index = sharedStrings.add(writable);
    return `${opening} t="s"><v>${index}</v></c>`;
  }

  if (typeof writable === "number") {
    return `${opening}><v>${writable}</v></c>`;
  }

  if (typeof writable === "boolean") {
    return `${opening} t="b"><v>${writable ? "1" : "0"}</v></c>`;
  }

  return `${opening}><v>${toExcelSerialDate(ref, writable)}</v></c>`;
}

function serializeFormulaCell(
  ref: string,
  attributes: { r: string; s: number | undefined },
  formula: string,
  rawValue?: PrimitiveCellValue,
) {
  const value = toWritableValue(ref, rawValue);
  const children = [xmlElement("f", undefined, xmlEscape(formula))];
  const formulaAttributes: Record<string, number | string | undefined> = { ...attributes };

  if (value === null) {
    return xmlElement("c", formulaAttributes, children);
  }

  if (typeof value === "string") {
    formulaAttributes.t = "str";
    children.push(xmlElement("v", undefined, xmlEscape(value)));
    return xmlElement("c", formulaAttributes, children);
  }

  if (typeof value === "boolean") {
    formulaAttributes.t = "b";
    children.push(xmlElement("v", undefined, value ? "1" : "0"));
    return xmlElement("c", formulaAttributes, children);
  }

  if (value instanceof Date) {
    children.push(xmlElement("v", undefined, String(toExcelSerialDate(ref, value))));
    return xmlElement("c", formulaAttributes, children);
  }

  children.push(xmlElement("v", undefined, String(value)));
  return xmlElement("c", formulaAttributes, children);
}

export function serializeInlineStringCell(
  row: number,
  column: number,
  value: string,
  styleIndex?: number,
  _hyperlink?: import("../planner/rows").PlannedHyperlink,
) {
  const ref = toCellRef(row, column);

  const style = styleIndex && styleIndex > 0 ? ` s="${styleIndex}"` : "";
  assertCellTextLength(ref, value);
  return `<c r="${ref}" t="inlineStr"${style}><is>${textElement(value)}</is></c>`;
}

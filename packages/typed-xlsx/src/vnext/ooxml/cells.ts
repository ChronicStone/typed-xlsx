import { xmlElement, xmlSelfClosing } from "./xml";
import type { PrimitiveCellValue } from "../schema/builder";
import type { SharedStringsCollector } from "./shared-strings";

function toExcelSerialDate(value: Date) {
  return (value.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000;
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

export function serializeCell(
  row: number,
  column: number,
  value: PrimitiveCellValue,
  sharedStrings: SharedStringsCollector,
  styleIndex?: number,
) {
  const ref = toCellRef(row, column);
  const attributes = {
    r: ref,
    s: styleIndex && styleIndex > 0 ? styleIndex : undefined,
  };

  if (value === null || value === undefined) {
    return xmlSelfClosing("c", attributes);
  }

  if (typeof value === "string") {
    const index = sharedStrings.add(value);
    return xmlElement("c", { ...attributes, t: "s" }, xmlElement("v", undefined, String(index)));
  }

  if (typeof value === "number") {
    return xmlElement("c", attributes, xmlElement("v", undefined, String(value)));
  }

  if (typeof value === "boolean") {
    return xmlElement(
      "c",
      { ...attributes, t: "b" },
      xmlElement("v", undefined, value ? "1" : "0"),
    );
  }

  if (value instanceof Date) {
    return xmlElement(
      "c",
      attributes,
      xmlElement("v", undefined, String(toExcelSerialDate(value))),
    );
  }

  return xmlSelfClosing("c", attributes);
}

export function serializeInlineStringCell(
  row: number,
  column: number,
  value: string,
  styleIndex?: number,
) {
  const ref = toCellRef(row, column);

  return xmlElement(
    "c",
    {
      r: ref,
      t: "inlineStr",
      s: styleIndex && styleIndex > 0 ? styleIndex : undefined,
    },
    xmlElement("is", undefined, xmlElement("t", undefined, value)),
  );
}

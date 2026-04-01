import { xmlElement, xmlEscape, xmlSelfClosing } from "./xml";
import type { PrimitiveCellValue } from "../schema/builder";
import type { SharedStringsCollector } from "./shared-strings";
import { isFormulaCell, type CellData } from "../cell-data";

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
  value: CellData,
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

  if (isFormulaCell(value)) {
    return serializeFormulaCell(attributes, value.formula, value.value);
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

function serializeFormulaCell(
  attributes: { r: string; s: number | undefined },
  formula: string,
  value?: PrimitiveCellValue,
) {
  const children = [xmlElement("f", undefined, xmlEscape(formula))];
  const formulaAttributes: Record<string, number | string | undefined> = { ...attributes };

  if (value === undefined || value === null) {
    return xmlElement("c", formulaAttributes, children);
  }

  if (typeof value === "string") {
    formulaAttributes.t = "str";
    children.push(xmlElement("v", undefined, value));
    return xmlElement("c", formulaAttributes, children);
  }

  if (typeof value === "boolean") {
    formulaAttributes.t = "b";
    children.push(xmlElement("v", undefined, value ? "1" : "0"));
    return xmlElement("c", formulaAttributes, children);
  }

  if (value instanceof Date) {
    children.push(xmlElement("v", undefined, String(toExcelSerialDate(value))));
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

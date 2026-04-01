import { xmlDocument, xmlElement, xmlEscape } from "./xml";

export interface SharedStringsCollector {
  add(value: string): number;
  count(): number;
  values(): string[];
}

export function createSharedStringsCollector(): SharedStringsCollector {
  const index = new Map<string, number>();
  const values: string[] = [];

  return {
    add(value: string) {
      const existing = index.get(value);
      if (existing !== undefined) return existing;

      const next = values.length;
      values.push(value);
      index.set(value, next);
      return next;
    },
    count() {
      return values.length;
    },
    values() {
      return [...values];
    },
  };
}

export function writeSharedStringsXml(sharedStrings: SharedStringsCollector) {
  const values = sharedStrings.values();
  const items = values.map((value) =>
    xmlElement("si", undefined, xmlElement("t", undefined, xmlEscape(value))),
  );

  return xmlDocument(
    "sst",
    {
      xmlns: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      count: values.length,
      uniqueCount: values.length,
    },
    items,
  );
}

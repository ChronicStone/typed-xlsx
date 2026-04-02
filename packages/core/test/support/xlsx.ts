import { DOMParser } from "@xmldom/xmldom";
import { unzipSync } from "fflate";

export function unzipWorkbookEntries(bytes: Uint8Array | Buffer) {
  const archive = unzipSync(Buffer.from(bytes));

  return new Map(
    Object.entries(archive).map(([entry, content]) => [
      entry,
      Buffer.from(content).toString("utf8"),
    ]),
  );
}

export function expectWorkbookXmlToBeWellFormed(entries: Map<string, string>) {
  for (const [entry, xml] of entries) {
    if (!entry.endsWith(".xml") && !entry.endsWith(".rels")) {
      continue;
    }

    const doc = new DOMParser({
      errorHandler: (level, message) => {
        if (level === "warning") {
          return;
        }

        throw new Error(`${entry}: ${message}`);
      },
    }).parseFromString(xml, "application/xml");

    const root = doc.documentElement;
    if (!root) {
      throw new Error(`${entry}: Missing document element.`);
    }

    if (root.nodeName === "parsererror") {
      throw new Error(`${entry}: ${root.textContent ?? "XML parse error"}`);
    }
  }
}

export function readWorkbookEntry(entries: Map<string, string>, entry: string) {
  const value = entries.get(entry);
  if (!value) {
    throw new Error(`Missing workbook entry '${entry}'.`);
  }
  return value;
}

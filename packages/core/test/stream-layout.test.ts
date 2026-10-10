import { describe, expect, it } from "vite-plus/test";
import * as Internal from "../src/index-internal";
import { MemorySpoolFactory, MemoryWorkbookSink } from "./helpers";
import { readWorkbookEntry, unzipWorkbookEntries } from "./support/xlsx";

type Line = { value: number };

function createSchemas() {
  const top = Internal.SchemaBuilder.create<Line>().column("value", { accessor: "value" }).build();
  const bottom = Internal.SchemaBuilder.create<Line>()
    .column("value", { accessor: "value" })
    .column("double", {
      formula: ({ refs }) => refs.column("value").mul(2),
      summary: (summary) => [summary.formula("sum")],
    })
    .build();

  return { top, bottom };
}

function worksheetShape(xml: string) {
  return {
    rows: [...xml.matchAll(/<row r="(\d+)"/g)].map((match) => Number(match[1])),
    refs: [...xml.matchAll(/<c r="([A-Z]+\d+)"/g)].map((match) => match[1]),
    formulas: [...xml.matchAll(/<f>([^<]*)<\/f>/g)].map((match) => match[1]),
    dimension: xml.match(/<dimension ref="([^"]+)"\/>/)?.[1],
    merges: [...xml.matchAll(/<mergeCell ref="([^"]+)"\/>/g)].map((match) => match[1]),
  };
}

const topRows: Line[] = [{ value: 1 }, { value: 2 }];
const bottomRows: Line[] = [{ value: 3 }, { value: 4 }, { value: 5 }];

describe("stacked streamed tables", () => {
  it("streams vertically stacked tables in row order with the same layout as the buffered builder", async () => {
    const { top, bottom } = createSchemas();

    const buffered = Internal.BufferedWorkbookBuilder.create();
    const bufferedSheet = buffered.sheet("Stacked");
    bufferedSheet.table("top", { rows: topRows, schema: top, title: "Top table" });
    bufferedSheet.table("bottom", { rows: bottomRows, schema: bottom });
    const bufferedXml = readWorkbookEntry(
      unzipWorkbookEntries(buffered.buildXlsx()),
      "xl/worksheets/sheet1.xml",
    );

    const sink = new MemoryWorkbookSink();
    const workbook = Internal.StreamWorkbookBuilder.create({
      sink,
      spoolFactory: new MemorySpoolFactory(),
    });
    const sheet = workbook.sheet("Stacked");
    const topTable = await sheet.table("top", { schema: top, title: "Top table" });
    const bottomTable = await sheet.table("bottom", { schema: bottom });
    await topTable.commit({ rows: topRows.slice(0, 1) });
    await bottomTable.commit({ rows: bottomRows.slice(0, 2) });
    await topTable.commit({ rows: topRows.slice(1) });
    await bottomTable.commit({ rows: bottomRows.slice(2) });
    await workbook.finish();
    const streamedXml = readWorkbookEntry(
      unzipWorkbookEntries(sink.toUint8Array()),
      "xl/worksheets/sheet1.xml",
    );

    const streamed = worksheetShape(streamedXml);
    const bufferedShape = worksheetShape(bufferedXml);

    expect(streamed.rows).toEqual([...streamed.rows].sort((left, right) => left - right));
    expect(new Set(streamed.rows).size).toBe(streamed.rows.length);
    expect(streamed).toEqual(bufferedShape);
    expect(streamed.formulas).toContain("(A8*2)");
    expect(streamed.formulas.some((formula) => formula.startsWith("SUM(B"))).toBe(true);
  });

  it("keeps side-by-side tables on shared rows", async () => {
    const { top, bottom } = createSchemas();
    const sink = new MemoryWorkbookSink();
    const workbook = Internal.StreamWorkbookBuilder.create({
      sink,
      spoolFactory: new MemorySpoolFactory(),
    });
    const sheet = workbook.sheet("Side by side", { tablesPerRow: 2 });
    const left = await sheet.table("left", { schema: top });
    const right = await sheet.table("right", { schema: bottom });
    await left.commit({ rows: topRows });
    await right.commit({ rows: bottomRows });
    await workbook.finish();

    const shape = worksheetShape(
      readWorkbookEntry(unzipWorkbookEntries(sink.toUint8Array()), "xl/worksheets/sheet1.xml"),
    );

    expect(shape.rows).toEqual([1, 2, 3, 4, 5]);
    expect(shape.refs.slice(0, 6)).toEqual(["A1", "C1", "D1", "A2", "C2", "D2"]);
    expect(shape.formulas).toContain("(C2*2)");
  });
});

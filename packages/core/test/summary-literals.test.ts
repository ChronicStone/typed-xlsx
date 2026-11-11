import { describe, expect, it } from "vite-plus/test";
import { createExcelSchema, createWorkbook } from "../src";
import * as Internal from "../src/index-internal";
import { MemorySpoolFactory, MemoryWorkbookSink } from "./helpers";
import { readWorkbookEntry, unzipWorkbookEntries } from "./support/xlsx";

type Row = { amount: number };

const rows: Row[] = [{ amount: 1 }, { amount: 2 }];

const literals = ["B1:B3", "A1", "AB12", 'say "hi"'];

function createSchema(literal: string) {
  return createExcelSchema<Row>()
    .column("amount", {
      header: "Amount",
      accessor: "amount",
      summary: (s) => [
        s.formula("sum"),
        s.formula(({ fx }) => fx.if(fx.literal(1).eq(1), literal, "no")),
      ],
    })
    .build();
}

function summaryFormulas(xml: string) {
  return [...xml.matchAll(/<f>([^<]*)<\/f>/g)].map((match) => match[1]);
}

function expectedFormula(literal: string) {
  const quoted = `"${literal.replaceAll('"', '""')}"`.replaceAll('"', "&quot;");
  return `IF((1=1),${quoted},${"&quot;no&quot;"})`;
}

function buildBuffered(literal: string) {
  const workbook = createWorkbook();
  workbook.sheet("S").table("t", { schema: createSchema(literal), rows });
  return readWorkbookEntry(
    unzipWorkbookEntries(workbook.toUint8Array()),
    "xl/worksheets/sheet1.xml",
  );
}

async function buildStreamed(literal: string) {
  const sink = new MemoryWorkbookSink();
  const workbook = Internal.StreamWorkbookBuilder.create({
    sink,
    spoolFactory: new MemorySpoolFactory(),
  });
  const table = await workbook.sheet("S").table("t", { schema: createSchema(literal) });
  await table.commit({ rows });
  await workbook.finish();
  return readWorkbookEntry(unzipWorkbookEntries(sink.toUint8Array()), "xl/worksheets/sheet1.xml");
}

describe("summary formula string literals", () => {
  for (const literal of literals) {
    it(`keeps ${JSON.stringify(literal)} as text in the buffered builder`, () => {
      expect(summaryFormulas(buildBuffered(literal))).toContain(expectedFormula(literal));
    });

    it(`keeps ${JSON.stringify(literal)} as text in the stream builder`, async () => {
      expect(summaryFormulas(await buildStreamed(literal))).toContain(expectedFormula(literal));
    });
  }

  it("still writes the column range for built-in aggregates", () => {
    expect(summaryFormulas(buildBuffered("x"))).toContain("SUM(A2:A3)");
  });
});

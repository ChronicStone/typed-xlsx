import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createExcelSchema, createWorkbook, createWorkbookStream } from "../src";

type Row = { a: number };

const schema = createExcelSchema<Row, { rate: number }>({ mode: "excel-table" })
  .column("a", { accessor: "a" })
  .column("b", { formula: ({ refs, ctx }) => refs.column("a").mul(1 + ctx.rate) })
  .build();

function readPart(bytes: Uint8Array, path: string) {
  const entry = unzipSync(bytes)[path];
  if (!entry) throw new Error(`missing part ${path}`);
  return new TextDecoder().decode(entry);
}

async function streamBytes(workbook: ReturnType<typeof createWorkbookStream>) {
  const reader = workbook.toReadableStream().getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function expectContextInFormulas(bytes: Uint8Array) {
  const table = readPart(bytes, "xl/tables/table1.xml");
  const sheet = readPart(bytes, "xl/worksheets/sheet1.xml");

  expect(table).toMatch(/<calculatedColumnFormula>[^<]*1\.5[^<]*<\/calculatedColumnFormula>/);
  expect(sheet).toMatch(/<f>[^<]*1\.5[^<]*<\/f>/);
}

describe("excel-table formula columns", () => {
  it("receive the table context in buffered workbooks", () => {
    const bytes = createWorkbook()
      .sheet("S")
      .table("t", { schema, rows: [{ a: 2 }], context: { rate: 0.5 } })
      .toUint8Array();

    expectContextInFormulas(bytes);
  });

  it("receive the table context in streamed workbooks", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook.sheet("S").table("t", { schema, context: { rate: 0.5 } });
    await table.commit({ rows: [{ a: 2 }] });

    expectContextInFormulas(await streamBytes(workbook));
  });
});

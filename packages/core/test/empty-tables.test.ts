import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createExcelSchema, createWorkbook, createWorkbookStream } from "../src";

type Row = { amount: number };

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

function formulaTexts(xml: string) {
  return [...xml.matchAll(/<f>([^<]*)<\/f>/g)].map((match) => match[1] as string);
}

const summarySchema = createExcelSchema<Row>()
  .column("amount", {
    header: "Amount",
    accessor: "amount",
    summary: (summary) => [
      summary.formula(({ column }) => column.rows().sum((row) => row.cells().sum())),
      summary.formula(({ column }) => column.rows().average((row) => row.cells().sum())),
    ],
  })
  .build();

describe("row-aware summaries on a table with no rows", () => {
  it("writes 0 for sums and an empty string for averages (buffered)", () => {
    const bytes = createWorkbook()
      .sheet("S")
      .table("t", { schema: summarySchema, rows: [] })
      .toUint8Array();

    expect(formulaTexts(readPart(bytes, "xl/worksheets/sheet1.xml"))).toEqual([
      "0",
      "&quot;&quot;",
    ]);
  });

  it("writes 0 for sums and an empty string for averages (stream)", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook.sheet("S").table("t", { schema: summarySchema });
    await table.commit({ rows: [] });

    const sheet = readPart(await streamBytes(workbook), "xl/worksheets/sheet1.xml");
    expect(formulaTexts(sheet)).toEqual(["0", "&quot;&quot;"]);
  });
});

type OrgRow = { amount: number };
type OrgContext = { ids: number[] };

const reportOrgSchema = createExcelSchema<OrgRow, OrgContext>()
  .column("amount", { header: "Amount", accessor: "amount" })
  .dynamic("orgs", (builder, { ctx }) => {
    for (const id of ctx.ids) {
      builder.column(`org${id}`, { header: `Org ${id}`, accessor: () => id });
    }
  })
  .column("total", { header: "Total", formula: ({ refs, fx }) => fx.sum(refs.dynamic("orgs")) })
  .build();

const excelOrgSchema = createExcelSchema<OrgRow, OrgContext>({ mode: "excel-table" })
  .column("amount", { header: "Amount", accessor: "amount" })
  .dynamic("orgs", (builder, { ctx }) => {
    for (const id of ctx.ids) {
      builder.column(`org${id}`, { header: `Org ${id}`, accessor: () => id });
    }
  })
  .column("total", { header: "Total", formula: ({ refs, fx }) => fx.sum(refs.dynamic("orgs")) })
  .build();

function averageSchema() {
  return createExcelSchema<OrgRow, OrgContext>()
    .column("amount", { header: "Amount", accessor: "amount" })
    .dynamic("orgs", (builder, { ctx }) => {
      for (const id of ctx.ids) {
        builder.column(`org${id}`, { header: `Org ${id}`, accessor: () => id });
      }
    })
    .column("mean", {
      header: "Mean",
      formula: ({ refs, fx }) => fx.average(refs.dynamic("orgs")),
    })
    .build();
}

describe("aggregates over a dynamic block that generated no columns", () => {
  it("sums to 0 in report mode (buffered)", () => {
    const bytes = createWorkbook()
      .sheet("S")
      .table("t", { schema: reportOrgSchema, rows: [{ amount: 1 }], context: { ids: [] } })
      .toUint8Array();

    expect(formulaTexts(readPart(bytes, "xl/worksheets/sheet1.xml"))).toEqual(["0"]);
  });

  it("sums to 0 in excel-table mode (buffered)", () => {
    const bytes = createWorkbook()
      .sheet("S")
      .table("t", { schema: excelOrgSchema, rows: [{ amount: 1 }], context: { ids: [] } })
      .toUint8Array();

    expect(formulaTexts(readPart(bytes, "xl/worksheets/sheet1.xml"))).toEqual(["0"]);
    expect(readPart(bytes, "xl/tables/table1.xml")).toContain(
      "<calculatedColumnFormula>0</calculatedColumnFormula>",
    );
  });

  it("sums to 0 in report mode (stream)", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook
      .sheet("S")
      .table("t", { schema: reportOrgSchema, context: { ids: [] } });
    await table.commit({ rows: [{ amount: 1 }] });

    const sheet = readPart(await streamBytes(workbook), "xl/worksheets/sheet1.xml");
    expect(formulaTexts(sheet)).toEqual(["0"]);
  });

  it("sums to 0 in excel-table mode (stream)", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook
      .sheet("S")
      .table("t", { schema: excelOrgSchema, context: { ids: [] } });
    await table.commit({ rows: [{ amount: 1 }] });

    const bytes = await streamBytes(workbook);
    expect(formulaTexts(readPart(bytes, "xl/worksheets/sheet1.xml"))).toEqual(["0"]);
    expect(readPart(bytes, "xl/tables/table1.xml")).toContain(
      "<calculatedColumnFormula>0</calculatedColumnFormula>",
    );
  });

  it("still sums the generated columns when the block is not empty", () => {
    const bytes = createWorkbook()
      .sheet("S")
      .table("t", { schema: reportOrgSchema, rows: [{ amount: 1 }], context: { ids: [1, 2] } })
      .toUint8Array();

    expect(formulaTexts(readPart(bytes, "xl/worksheets/sheet1.xml"))).toEqual(["SUM(B2,C2)"]);
  });

  it("names the formula column and the block when an average has nothing to average (buffered)", () => {
    const workbook = createWorkbook()
      .sheet("S")
      .table("t", { schema: averageSchema(), rows: [{ amount: 1 }], context: { ids: [] } });

    expect(() => workbook.toUint8Array()).toThrow(
      "Formula column 'mean' aggregates dynamic block 'orgs', which generated no columns for this export.",
    );
  });

  it("names the formula column and the block when an average has nothing to average (stream)", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook
      .sheet("S")
      .table("t", { schema: averageSchema(), context: { ids: [] } });

    await expect(table.commit({ rows: [{ amount: 1 }] })).rejects.toThrow(
      "Formula column 'mean' aggregates dynamic block 'orgs', which generated no columns for this export.",
    );
  });
});

describe("pivots over a table with no rows", () => {
  const sourceSchema = createExcelSchema<{ region: string; amount: number }>()
    .column("region", { header: "Region", accessor: "region" })
    .column("amount", {
      header: "Amount",
      accessor: "amount",
      summary: (summary) => [summary.formula("sum")],
    })
    .build();
  const message = 'Pivot "byRegion": table "Data/data" has no rows, so there is nothing to pivot.';

  it("refuses to point the cache at the summary row (buffered)", () => {
    const workbook = createWorkbook()
      .sheet("Data")
      .table("data", { schema: sourceSchema, rows: [] })
      .sheet("Analysis")
      .pivot("byRegion", ({ refs }) =>
        refs
          .sheet("Data")
          .table("data")
          .pivot({ rows: ["region"], values: { amount: "sum" } }),
      );

    expect(() => workbook.toUint8Array()).toThrow(message);
  });

  it("refuses to point the cache at the summary row (stream)", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const data = await workbook.sheet("Data").table("data", { schema: sourceSchema });
    workbook
      .sheet("Analysis")
      .pivot("byRegion", data.pivot({ rows: ["region"], values: { amount: "sum" } }));
    await data.commit({ rows: [] });

    await expect(streamBytes(workbook)).rejects.toThrow(message);
  });
});

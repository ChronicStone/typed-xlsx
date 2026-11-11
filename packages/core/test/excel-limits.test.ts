import { describe, expect, it } from "vitest";
import { createExcelSchema, createWorkbook, createWorkbookStream } from "../src";
import { buildWorksheetNames } from "../src/ooxml/sheet-names";
import { EXCEL_MAX_ROWS } from "../src/workbook/internal/limits";
import { unzipWorkbookEntries } from "./support/xlsx";

type NumberRow = { n: number };

const numberSchema = createExcelSchema<NumberRow>()
  .column("n", { header: "N", accessor: "n" })
  .build();

const tableSchema = createExcelSchema<NumberRow>({ mode: "excel-table" })
  .column("n", { header: "N", accessor: "n" })
  .build();

describe("Excel limits", () => {
  it("stream: throws from the commit that crosses the row limit", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const table = await workbook.sheet("Big").table("big", { schema: numberSchema });
    const batch = Array.from({ length: 100_000 }, (_, n) => ({ n }));
    const header = 1;
    const room = EXCEL_MAX_ROWS - header;

    let committed = 0;
    while (room - committed >= batch.length) {
      await table.commit({ rows: batch });
      committed += batch.length;
    }
    await table.commit({ rows: batch.slice(0, room - committed) });

    await expect(table.commit({ rows: [{ n: 1 }] })).rejects.toThrow(
      /Sheet 'Big' would need 1,048,577 rows; Excel allows 1,048,576 per sheet/,
    );
  }, 60_000);

  it("buffered: throws before serialization when the rows do not fit", () => {
    const row = { n: 1 };
    const rows = new Array<NumberRow>(EXCEL_MAX_ROWS).fill(row);
    const workbook = createWorkbook().sheet("Big").table("big", { schema: numberSchema, rows });

    expect(() => workbook.toUint8Array()).toThrow(
      /Sheet 'Big' would need 1,048,577 rows; Excel allows 1,048,576 per sheet/,
    );
  }, 60_000);

  it("throws when a table needs more than 16,384 columns", () => {
    const schema = createExcelSchema<NumberRow, { count: number }>()
      .dynamic("many", (builder, { ctx }) => {
        for (let index = 0; index < ctx.count; index += 1) {
          builder.column(`c${index}`, { header: `C${index}`, accessor: "n" });
        }
      })
      .build();

    expect(() =>
      createWorkbook()
        .sheet("Wide")
        .table("wide", { schema, context: { count: 16_385 }, rows: [{ n: 1 }] })
        .toUint8Array(),
    ).toThrow(/Sheet 'Wide' would need 16,385 columns; Excel allows 16,384 per sheet/);

    expect(() =>
      createWorkbook()
        .sheet("Wide")
        .table("wide", { schema, context: { count: 16_384 }, rows: [{ n: 1 }] })
        .toUint8Array(),
    ).not.toThrow();
  });

  it("compares sheet names ignoring case and reserves History", () => {
    expect(buildWorksheetNames(["Sales", "sales"])).toEqual(["Sales", "sales (2)"]);
    expect(buildWorksheetNames(["History"])).toEqual(["History (2)"]);
  });

  it("buffered: rejects two Excel tables with the same name ignoring case", () => {
    const workbook = createWorkbook();
    workbook.sheet("First").table("orders", { schema: tableSchema, rows: [{ n: 1 }] });
    workbook.sheet("Second").table("Orders", { schema: tableSchema, rows: [{ n: 1 }] });

    expect(() => workbook.toUint8Array()).toThrow(
      /Two Excel tables are named 'orders' and 'Orders' \(sheets 'First' and 'Second'\)/,
    );
  });

  it("stream: rejects two Excel tables with the same name when the second is created", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    await workbook.sheet("First").table("orders", { schema: tableSchema });

    await expect(workbook.sheet("Second").table("Orders", { schema: tableSchema })).rejects.toThrow(
      /sheets 'First' and 'Second'/,
    );
  });

  it("rejects table names that look like cell references, and duplicate headers", () => {
    expect(() =>
      createWorkbook()
        .sheet("S")
        .table("a1", { schema: tableSchema, name: "A1", rows: [{ n: 1 }] })
        .toUint8Array(),
    ).toThrow(/'A1' looks like a cell reference/);

    const duplicateHeaders = createExcelSchema<{ a: number; b: number }>({ mode: "excel-table" })
      .column("a", { header: "Amount", accessor: "a" })
      .column("b", { header: "amount", accessor: "b" })
      .build();
    expect(() =>
      createWorkbook()
        .sheet("S")
        .table("t", { schema: duplicateHeaders, rows: [{ a: 1, b: 2 }] })
        .toUint8Array(),
    ).toThrow(
      /Columns 'a' and 'b' of Excel table 't' have the same header \('Amount' and 'amount'\)/,
    );
  });

  it("rejects an inline dropdown list over 255 characters", () => {
    const options = Array.from({ length: 40 }, (_, index) => `option number ${index}`);
    const schema = createExcelSchema<{ status: string }>()
      .column("status", { accessor: "status", validation: (v) => v.list(options) })
      .build();

    expect(() =>
      createWorkbook()
        .sheet("S")
        .table("t", { schema, rows: [{ status: "x" }] })
        .toUint8Array(),
    ).toThrow(/Dropdown list on column 'status' is \d+ characters long; Excel allows 255/);
  });

  it("rejects a column id that a dynamic block generates twice", () => {
    const schema = createExcelSchema<{ a: number }, { ids: string[] }>()
      .column("a", { accessor: "a" })
      .dynamic("extra", (builder, { ctx }) => {
        for (const id of ctx.ids) builder.column(id as never, { accessor: "a" });
      })
      .build();

    expect(() =>
      createWorkbook()
        .sheet("S")
        .table("t", { schema, context: { ids: ["a"] }, rows: [{ a: 1 }] })
        .toUint8Array(),
    ).toThrow(/Column id 'a' is used twice in table 't' \(one comes from dynamic block 'extra'\)/);
  });

  it("escapes brackets in a header with an apostrophe in structured references", () => {
    const schema = createExcelSchema<{ q: number }>({ mode: "excel-table" })
      .column("q", { header: "Q[1]", accessor: "q" })
      .column("double", { header: "Double", formula: ({ refs }) => refs.column("q").mul(2) })
      .build();

    const entries = unzipWorkbookEntries(
      createWorkbook()
        .sheet("S")
        .table("t", { schema, rows: [{ q: 1 }] })
        .toUint8Array(),
    );
    const table = entries.get("xl/tables/table1.xml") ?? "";
    expect(table).toContain("Q&apos;[1&apos;]");
    expect(table).not.toContain("Q[1]]");
  });

  it("rejects text over 32,767 characters and clamps column widths to 255", () => {
    expect(() =>
      createWorkbook()
        .sheet("S")
        .table("t", {
          schema: createExcelSchema<{ s: string }>().column("s", { accessor: "s" }).build(),
          rows: [{ s: "x".repeat(32_768) }],
        })
        .toUint8Array(),
    ).toThrow(/Cell A2 has 32,768 characters; Excel allows 32,767 per cell/);

    const wide = createExcelSchema<{ s: string }>()
      .column("s", { accessor: "s", width: 400 })
      .build();
    const sheet = unzipWorkbookEntries(
      createWorkbook()
        .sheet("S")
        .table("t", { schema: wide, rows: [{ s: "x" }] })
        .toUint8Array(),
    ).get("xl/worksheets/sheet1.xml");
    expect(sheet).toContain('width="255"');
  });
});

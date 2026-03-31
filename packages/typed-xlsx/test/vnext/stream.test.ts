import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as VNext from "../../src/vnext";
import { appendExpandedRowXml } from "../../src/vnext/stream/rows";
import { MemorySpoolFactory, MemoryWorkbookSink } from "./helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("vnext stream builder", () => {
  it("commits batches, updates summaries, and writes a final manifest report to the sink", async () => {
    const schema = VNext.SchemaBuilder.create<{ amount: number; name: string }>()
      .column("name", {
        accessor: "name",
      })
      .column("amount", {
        accessor: "amount",
        summary: (summary) => [
          summary.cell({
            init: () => 0,
            step: (acc: number, row) => acc + row.amount,
            finalize: (acc: number) => acc,
          }),
        ],
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });

    const sheet = workbook.sheet("Orders");
    const table = await sheet.table("orders", {
      schema,
    });

    await table.commit({
      rows: [
        { amount: 3, name: "A" },
        { amount: 7, name: "B" },
      ],
    });

    await workbook.finish();

    const bytes = sink.toUint8Array();

    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
    expect(bytes.byteLength).toBeGreaterThan(100);
    expect(sink.closed).toBe(true);
  });

  it("supports file-backed spooling for bounded-memory streaming", async () => {
    const schema = VNext.SchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "typed-xlsx-vnext-"));
    const sink = new MemoryWorkbookSink();
    const spoolFactory = new VNext.FileSpoolFactory(directory);
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Logs").table("logs", {
      schema,
    });

    await table.commit({
      rows: [{ value: "line-1" }, { value: "line-2" }],
    });
    await workbook.finish();

    const files = fs.readdirSync(directory);
    expect(files.length).toBe(1);
    const spoolContent = fs.readFileSync(path.join(directory, files[0]!), "utf8");
    expect(spoolContent).toContain("<row");
    expect(spoolContent).toContain('r="A2"');
    expect(spoolContent).toContain('r="A3"');
    expect(spoolContent).toContain("<v>0</v>");
    expect(spoolContent).toContain("<v>1</v>");
  });

  it("tracks stream column widths and merge ranges in finalized worksheet xml", async () => {
    const schema = VNext.SchemaBuilder.create<{ name: string; tags: string[] }>()
      .column("name", {
        accessor: "name",
      })
      .column("tags", {
        accessor: (row) => row.tags,
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Merged").table("rows", {
      schema,
    });

    await table.commit({
      rows: [{ name: "Alpha", tags: ["x", "yy"] }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("<cols>");
    expect(content).toContain('customWidth="1"');
    expect(content).toContain("<mergeCells");
    expect(content).toContain("A2:A3");
  });

  it("writes custom row height metadata into streamed worksheet rows", async () => {
    const schema = VNext.SchemaBuilder.create<{ notes: string }>()
      .column("notes", {
        accessor: "notes",
        style: {
          font: { size: 14 },
        },
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Heights").table("rows", {
      schema,
    });

    await table.commit({
      rows: [{ notes: "line 1\nline 2" }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain('customHeight="1"');
    expect(content).toContain(' ht="');
  });

  it("writes native Excel table parts and worksheet relationships in streamed workbooks", async () => {
    const schema = VNext.ExcelTableSchemaBuilder.create<{ amount: number; id: string }>()
      .column("id", {
        accessor: "id",
      })
      .column("amount", {
        accessor: "amount",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Orders").table("orders", {
      autoFilter: true,
      name: "OrdersTable",
      schema,
      style: "TableStyleDark2",
    });

    await table.commit({
      rows: [{ amount: 42, id: "A-1" }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain('Target="../tables/table1.xml"');
    expect(content).toContain('<tableParts count="1">');
    expect(content).toContain('displayName="OrdersTable"');
    expect(content).toContain('tableStyleInfo name="TableStyleDark2"');
    expect(content).toContain('ref="A1:B2"');
  });

  it("writes native Excel table totals-row metadata in streamed workbooks", async () => {
    const schema = VNext.ExcelTableSchemaBuilder.create<{ amount: number; label: string }>()
      .column("label", {
        accessor: "label",
        totalsRow: { label: "TOTAL" },
      })
      .column("amount", {
        accessor: "amount",
        totalsRow: { function: "sum" },
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Orders").table("orders", {
      schema,
      totalsRow: true,
    });

    await table.commit({
      rows: [
        { amount: 3, label: "A" },
        { amount: 7, label: "B" },
      ],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain('ref="A1:B4"');
    expect(content).toContain('totalsRowCount="1"');
    expect(content).not.toContain('totalsRowShown="1"');
    expect(content).toContain('totalsRowLabel="TOTAL"');
    expect(content).toContain('totalsRowFunction="sum"');
    expect(content).toContain("TOTAL");
    expect(content).toContain("SUBTOTAL(109,[Amount])");
  });

  it("serializes excel-table formula columns with structured references in streamed worksheets", async () => {
    const schema = VNext.ExcelTableSchemaBuilder.create<{ qty: number; unitPrice: number }>()
      .column("qty", {
        accessor: "qty",
      })
      .column("unitPrice", {
        accessor: "unitPrice",
      })
      .column("lineTotal", {
        formula: ({ row }) => row.ref("qty").mul(row.ref("unitPrice")),
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Orders").table("orders", {
      schema,
    });

    await table.commit({ rows: [{ qty: 3, unitPrice: 7 }] });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>([@[Qty]]*[@[Unit price]])</f>");
  });

  it("uses workbook-global native Excel table numbering across streamed sheets", async () => {
    const schema = VNext.ExcelTableSchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const left = await workbook.sheet("Left").table("left", {
      schema,
    });
    const right = await workbook.sheet("Right").table("right", {
      schema,
    });

    await left.commit({ rows: [{ value: "A" }] });
    await right.commit({ rows: [{ value: "B" }] });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("xl/tables/table1.xml");
    expect(content).toContain("xl/tables/table2.xml");
    expect(content).toContain('Target="../tables/table1.xml"');
    expect(content).toContain('Target="../tables/table2.xml"');
  });

  it("lays out multiple streamed tables on the same worksheet when tablesPerRow is set", async () => {
    const schema = VNext.SchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const sheet = workbook.sheet("Summary", { tablesPerRow: 2 });
    const left = await sheet.table("left", { schema });
    const right = await sheet.table("right", { schema });

    await left.commit({ rows: [{ value: "A" }] });
    await right.commit({ rows: [{ value: "B" }] });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("xl/worksheets/sheet1.xml");
    expect(content).not.toContain("xl/worksheets/sheet2.xml");
    expect(content).toContain('r="A1"');
    expect(content).toContain('r="C1"');
    expect(content).toContain('r="A2"');
    expect(content).toContain('r="C2"');
  });

  it("registers default header and body styles in streamed workbooks", async () => {
    const schema = VNext.SchemaBuilder.create<{ name: string; tags: string[] }>()
      .column("name", {
        accessor: "name",
      })
      .column("tags", {
        accessor: (row) => row.tags,
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Styled").table("rows", {
      schema,
    });

    await table.commit({
      rows: [{ name: "Alpha", tags: ["x", "yy"] }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("xl/styles.xml");
    expect(content).toContain("<borders");
    expect(content).toContain('applyBorder="1"');
    expect(content).toContain(' s="1"');
  });

  it("supports stream sheet view options and inline string mode", async () => {
    const schema = VNext.SchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({
      sink,
      spoolFactory,
      stringMode: "inline",
    });
    const table = await workbook
      .sheet("View", {
        rightToLeft: true,
        freezePane: { rows: 1 },
      })
      .table("rows", {
        schema,
      });

    await table.commit({
      rows: [{ value: "hello" }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain('rightToLeft="1"');
    expect(content).toContain('state="frozen"');
    expect(content).toContain('t="inlineStr"');
    expect(content).not.toContain("sharedStrings.xml");
  });

  it("writes sparse summary rows and numeric date cells in streamed worksheets", async () => {
    const schema = VNext.SchemaBuilder.create<{ createdAt: Date; amount: number; name: string }>()
      .column("name", {
        accessor: "name",
      })
      .column("amount", {
        accessor: "amount",
        summary: (summary) => [
          summary.cell({
            init: () => 0,
            step: (acc: number, row) => acc + row.amount,
            finalize: (acc: number) => acc,
          }),
        ],
      })
      .column("createdAt", {
        accessor: "createdAt",
        style: {
          numFmt: "yyyy-mm-dd",
        },
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Summary").table("rows", {
      schema,
    });

    await table.commit({
      rows: [{ name: "A", amount: 5, createdAt: new Date(Date.UTC(2025, 2, 3, 0, 0, 0)) }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain('<row r="3" ht="30" customHeight="1">');
    expect(content).toContain('r="B3"');
    expect(content).not.toContain('r="A3" s="');
    expect(content).not.toContain('r="C3" s="');
    expect(content).not.toContain("2025-03-03T00:00:00.000Z");
  });

  it("writes multiple summary rows in streamed worksheets", async () => {
    const schema = VNext.SchemaBuilder.create<{ amount: number; label: string }>()
      .column("label", {
        accessor: "label",
        summary: (summary) => [summary.label("TOTAL BEFORE VAT"), summary.label("TOTAL")],
      })
      .column("amount", {
        accessor: "amount",
        summary: (summary) => [
          summary.cell({
            init: () => 0,
            step: (acc: number, row) => acc + row.amount,
            finalize: (acc: number) => acc,
          }),
          summary.cell({
            init: () => 0,
            step: (acc: number, row) => acc + row.amount,
            finalize: (acc: number) => acc * 1.2,
          }),
        ],
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Summary").table("rows", {
      schema,
    });

    await table.commit({
      rows: [{ label: "A", amount: 5 }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain('<row r="3" ht="30" customHeight="1">');
    expect(content).toContain('<row r="4" ht="30" customHeight="1">');
    expect(content).toContain('r="A3"');
    expect(content).toContain('r="A4"');
    expect(content).toContain('r="B3"');
    expect(content).toContain('r="B4"');
    expect(content).toContain("TOTAL BEFORE VAT");
    expect(content).toContain(">TOTAL<");
    expect(content).toContain("<v>5</v>");
    expect(content).toContain("<v>6</v>");
  });

  it("sanitizes long streamed worksheet names for excel compatibility", async () => {
    const schema = VNext.SchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Financial Report | Full").table("financial-report", {
      schema,
    });

    await table.commit({
      rows: [{ value: "hello" }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain('name="Financial Report Full"');
    expect(content).not.toContain("Financial Report | Full-financial-report");
  });

  it("can expose a readable byte stream sink for downstream piping", async () => {
    const schema = VNext.SchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const sink = new VNext.WorkbookByteStream();
    const workbook = VNext.StreamWorkbookBuilder.create({
      sink,
      spoolFactory: new MemorySpoolFactory(),
    });
    const table = await workbook.sheet("Pipeable").table("rows", {
      schema,
    });

    await table.commit({
      rows: [{ value: "hello" }, { value: "world" }],
    });

    const chunks: Uint8Array[] = [];
    const reader = (async () => {
      for await (const chunk of sink) {
        chunks.push(chunk);
      }
    })();

    await workbook.finish();
    await reader;

    const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it("serializes formula cells in streamed row fragments", () => {
    const schema = VNext.SchemaBuilder.create<{ amount: number }>()
      .column("amount", {
        accessor: "amount",
      })
      .build();

    const columns = VNext.resolveColumns(schema);
    const xml = appendExpandedRowXml({
      columns,
      expandedRow: {
        row: { amount: 2 },
        sourceRowIndex: 0,
        valuesByColumn: [[{ kind: "formula", formula: "A2*2", value: 4 }]],
        height: 1,
        physicalRowHeights: [VNext.getDefaultRowHeight()],
      },
      startingRowIndex: 1,
      sharedStrings: {
        add: () => 0,
        count: () => 0,
        values: () => [],
      },
    });

    expect(xml).toContain('<row r="2"');
    expect(xml).toContain('<c r="A2"');
    expect(xml).toContain("<f>A2*2</f>");
    expect(xml).toContain("<v>4</v>");
  });

  it("writes worksheet autoFilter metadata in streamed worksheets", async () => {
    const schema = VNext.SchemaBuilder.create<{ amount: number; name: string }>()
      .column("name", {
        accessor: "name",
      })
      .column("amount", {
        accessor: "amount",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Orders").table("orders", {
      autoFilter: true,
      schema,
    });

    await table.commit({
      rows: [
        { amount: 3, name: "A" },
        { amount: 7, name: "B" },
      ],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain('<autoFilter ref="A1:B3"/>');
    expect(content.indexOf("<sheetData>")).toBeLessThan(
      content.indexOf('<autoFilter ref="A1:B3"/>'),
    );
  });

  it("writes formula-based summary cells in streamed worksheets", async () => {
    const schema = VNext.SchemaBuilder.create<{ amount: number; label: string }>()
      .column("label", {
        accessor: "label",
        summary: (summary) => [summary.label("TOTAL")],
      })
      .column("amount", {
        accessor: "amount",
        summary: (summary) => [summary.formula("sum")],
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Orders").table("orders", {
      schema,
    });

    await table.commit({
      rows: [
        { amount: 3, label: "A" },
        { amount: 7, label: "B" },
      ],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>SUM(B2:B3)</f>");
  });

  it("writes richer summary formula callbacks in streamed worksheets", async () => {
    const schema = VNext.SchemaBuilder.create<{ amount: number; label: string }>()
      .column("label", {
        accessor: "label",
        summary: (summary) => [summary.label("TOTAL")],
      })
      .column("amount", {
        accessor: "amount",
        summary: (summary) => [
          summary.formula(({ column, fx }) => fx.round(column.cells().sum(), 2)),
        ],
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Orders").table("orders", {
      schema,
    });

    await table.commit({
      rows: [
        { amount: 3.125, label: "A" },
        { amount: 7.333, label: "B" },
      ],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>ROUND(SUM(B2:B3),2)</f>");
  });

  it("renders summary spacer cells without default summary styling in streamed worksheets", async () => {
    const schema = VNext.SchemaBuilder.create<{ amount: number; label: string }>()
      .column("label", {
        accessor: "label",
        summary: (summary) => [summary.label("TOTAL"), summary.spacer()],
      })
      .column("amount", {
        accessor: "amount",
        summary: (summary) => [summary.formula("sum"), summary.formula("average")],
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Orders").table("orders", {
      schema,
    });

    await table.commit({
      rows: [
        { amount: 3, label: "A" },
        { amount: 7, label: "B" },
      ],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain('<c r="A5"/>');
  });

  it("writes formula-based derived columns in streamed worksheets", async () => {
    const schema = VNext.SchemaBuilder.create<{ qty: number; unitPrice: number }>()
      .column("qty", {
        accessor: "qty",
      })
      .column("unitPrice", {
        accessor: "unitPrice",
      })
      .column("lineTotal", {
        formula: ({ row }) => row.ref("qty").mul(row.ref("unitPrice")),
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Orders").table("orders", {
      schema,
    });

    await table.commit({
      rows: [{ qty: 3, unitPrice: 7 }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>(A2*B2)</f>");
  });

  it("writes richer formula functions in streamed worksheets", async () => {
    const schema = VNext.SchemaBuilder.create<{ qty: number; unitPrice: number }>()
      .column("qty", {
        accessor: "qty",
      })
      .column("unitPrice", {
        accessor: "unitPrice",
      })
      .column("roundedTotal", {
        formula: ({ row, fx }) => fx.round(row.ref("qty").mul(row.ref("unitPrice")), 2),
      })
      .column("status", {
        formula: ({ row, fx }) => fx.if(row.ref("qty").gt(10), "HIGH", "NORMAL"),
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Orders").table("orders", {
      schema,
    });

    await table.commit({
      rows: [{ qty: 3, unitPrice: 7 }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>ROUND((A2*B2),2)</f>");
    expect(content).toContain("IF((A2&gt;10),&quot;HIGH&quot;,&quot;NORMAL&quot;)");
  });

  it("disables worksheet autoFilter for streamed tables with merged body rows", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const schema = VNext.SchemaBuilder.create<{ id: string; tags: string[] }>()
      .column("id", {
        accessor: "id",
      })
      .column("tags", {
        accessor: (row) => row.tags,
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Orders").table("orders", {
      autoFilter: true,
      schema,
    });

    await table.commit({
      rows: [{ id: "1", tags: ["a", "b"] }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).not.toContain("<autoFilter");
    expect(warn).toHaveBeenCalledWith(
      "[typed-xlsx] Disabled autoFilter for stream table 'orders' because the rendered report contains vertically merged body cells from sub-row expansion. Worksheet auto-filters operate on flat physical rows; use a flat report table or native Excel tables for filtered views.",
    );
  });
});

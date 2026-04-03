import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Internal from "../src/index-internal";
import { appendExpandedRowXml } from "../src/stream/rows";
import { MemorySpoolFactory, MemoryWorkbookSink } from "./helpers";
import { unzipWorkbookEntries } from "./support/xlsx";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("stream builder", () => {
  it("commits batches, updates summaries, and writes a final manifest report to the sink", async () => {
    const schema = Internal.SchemaBuilder.create<{ amount: number; name: string }>()
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
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });

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
    const schema = Internal.SchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "typed-xlsx-stream-"));
    const sink = new MemoryWorkbookSink();
    const spoolFactory = new Internal.FileSpoolFactory(directory);
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.SchemaBuilder.create<{ name: string; tags: string[] }>()
      .column("name", {
        accessor: "name",
      })
      .column("tags", {
        accessor: (row) => row.tags,
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.SchemaBuilder.create<{ notes: string }>()
      .column("notes", {
        accessor: "notes",
        style: {
          font: { size: 14 },
        },
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.ExcelTableSchemaBuilder.create<{ amount: number; id: string }>()
      .column("id", {
        accessor: "id",
      })
      .column("amount", {
        accessor: "amount",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.ExcelTableSchemaBuilder.create<{ amount: number; label: string }>()
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
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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

  it("writes worksheet data validations in streamed workbooks", async () => {
    type ValidationRow = {
      amount: number;
      score: number;
      status: "draft" | "active" | "archived";
    };

    const schema = Internal.SchemaBuilder.create<ValidationRow>()
      .column("status", {
        accessor: "status",
        validation: (v) =>
          v
            .list(["draft", "active", "archived"])
            .prompt({
              title: () => "Allowed values",
              message: () => "Choose a known status",
            })
            .error({
              title: () => "Invalid status",
              message: () => "Only draft, active, or archived are allowed",
            }),
      })
      .column("amount", {
        accessor: "amount",
        validation: (v) => v.integer().between(1, 10).allowBlank(),
      })
      .column("score", {
        accessor: "score",
        validation: (v) => v.custom(({ refs }) => refs.column("score").gte(refs.column("amount"))),
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Validation").table("validation", {
      schema,
    });

    await table.commit({
      rows: [{ amount: 3, score: 5, status: "draft" } satisfies ValidationRow],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain('<dataValidations count="3">');
    expect(content).toContain('sqref="A2:A2"');
    expect(content).toContain('type="list"');
    expect(content).toContain("<formula1>&quot;draft,active,archived&quot;</formula1>");
    expect(content).toContain('sqref="B2:B2"');
    expect(content).toContain('type="whole"');
    expect(content).toContain("<formula1>1</formula1>");
    expect(content).toContain("<formula2>10</formula2>");
    expect(content).toContain('sqref="C2:C2"');
    expect(content).toContain('type="custom"');
    expect(content).toContain("<formula1>($C2&gt;=B2)</formula1>");
  });

  it("writes differential styles for streamed conditional formatting", async () => {
    const schema = Internal.SchemaBuilder.create<{ backlog: number }>()
      .column("backlog", {
        accessor: "backlog",
        conditionalStyle: (conditional) =>
          conditional.when(({ refs }) => refs.column("backlog").gte(25), {
            fill: { color: { rgb: "FEF3C7" } },
            font: { color: { rgb: "92400E" }, bold: true },
          }),
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Conditional").table("rows", {
      schema,
    });

    await table.commit({ rows: [{ backlog: 29 }] });
    await workbook.finish();

    const entries = unzipWorkbookEntries(Buffer.from(sink.toUint8Array()));
    const stylesXml = entries.get("xl/styles.xml");
    const worksheetXml = entries.get("xl/worksheets/sheet1.xml");

    expect(stylesXml).toContain('<dxfs count="1"');
    expect(stylesXml).toContain("FFFEF3C7");
    expect(stylesXml).toContain("FF92400E");
    expect(worksheetXml).toContain("<conditionalFormatting");
    expect(worksheetXml).toContain('dxfId="0"');
  });

  it("serializes excel-table formula columns with structured references in streamed worksheets", async () => {
    const schema = Internal.ExcelTableSchemaBuilder.create<{ qty: number; unitPrice: number }>()
      .column("qty", {
        accessor: "qty",
      })
      .column("unitPrice", {
        accessor: "unitPrice",
      })
      .column("lineTotal", {
        formula: ({ refs }) => refs.column("qty").mul(refs.column("unitPrice")),
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Orders").table("orders", {
      schema,
    });

    await table.commit({ rows: [{ qty: 3, unitPrice: 7 }] });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>([@[Qty]]*[@[Unit price]])</f>");
  });

  it("uses workbook-global native Excel table numbering across streamed sheets", async () => {
    const schema = Internal.ExcelTableSchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.SchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.SchemaBuilder.create<{ name: string; tags: string[] }>()
      .column("name", {
        accessor: "name",
      })
      .column("tags", {
        accessor: (row) => row.tags,
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    expect(content).toContain("FFDBEAFE");
    expect(content).toContain("FF1E3A8A");
  });

  it("applies table defaults to streamed protected cell states", async () => {
    const schema = Internal.SchemaBuilder.create<{
      input: number;
      formulaValue: number;
      status: string;
    }>()
      .column("input", {
        accessor: "input",
        style: { protection: { locked: false } },
      })
      .column("formulaValue", {
        formula: ({ refs }) => refs.column("input").mul(2),
        style: { protection: { hidden: true } },
      })
      .column("status", {
        accessor: "status",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Styled Defaults").table("rows", {
      schema,
      defaults: {
        cells: {
          unlocked: { preset: "cell.input" },
          locked: { preset: "cell.locked" },
          hidden: { preset: "cell.hidden" },
        },
      },
    });

    await table.commit({ rows: [{ input: 5, formulaValue: 10, status: "Open" }] });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("FFFEF3C7");
    expect(content).toContain("FFF8FAFC");
    expect(content).toContain("FFF1F5F9");
  });

  it("supports stream sheet view options and inline string mode", async () => {
    const schema = Internal.SchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({
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
    const schema = Internal.SchemaBuilder.create<{
      createdAt: Date;
      amount: number;
      name: string;
    }>()
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
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.SchemaBuilder.create<{ amount: number; label: string }>()
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
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.SchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.SchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const sink = new Internal.WorkbookByteStream();
    const workbook = Internal.StreamWorkbookBuilder.create({
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
    const schema = Internal.SchemaBuilder.create<{ amount: number }>()
      .column("amount", {
        accessor: "amount",
      })
      .build();

    const columns = Internal.resolveColumns(schema);
    const xml = appendExpandedRowXml({
      columns,
      expandedRow: {
        row: { amount: 2 },
        sourceRowIndex: 0,
        valuesByColumn: [[{ kind: "formula", formula: "A2*2", value: 4 }]],
        hyperlinksByColumn: [[undefined]],
        height: 1,
        physicalRowHeights: [Internal.getDefaultRowHeight()],
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
    const schema = Internal.SchemaBuilder.create<{ amount: number; name: string }>()
      .column("name", {
        accessor: "name",
      })
      .column("amount", {
        accessor: "amount",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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

  it("renders report title and grouped headers in streamed worksheets", async () => {
    const schema = Internal.SchemaBuilder.create<{ account: string; arr: number; nrr: number }>()
      .column("account", { accessor: "account" })
      .group("financials", { header: "Financials" }, (group) => {
        group.column("arr", { accessor: "arr" });
        group.column("nrr", { accessor: "nrr" });
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Board").table("portfolio", {
      title: "Portfolio Snapshot",
      schema,
      defaults: {
        title: { preset: "header.inverse" },
        groupHeader: { preset: "header.accent" },
      },
    });

    await table.commit({ rows: [{ account: "Acme", arr: 100, nrr: 1.1 }] });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("Portfolio Snapshot");
    expect(content).toContain("Financials");
    expect(content).toContain('<mergeCell ref="A1:C1"/>');
    expect(content).toContain('<mergeCell ref="B2:C2"/>');
    expect(content).toContain('r="A3"');
    expect(content).toContain('r="A4"');
  });

  it("anchors streamed autoFilter to the leaf header row when grouped headers are rendered", async () => {
    const schema = Internal.SchemaBuilder.create<{ account: string; arr: number; nrr: number }>()
      .column("account", { accessor: "account" })
      .group("financials", { header: "Financials" }, (group) => {
        group.column("arr", { accessor: "arr" });
        group.column("nrr", { accessor: "nrr" });
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Board").table("portfolio", {
      title: "Portfolio Snapshot",
      autoFilter: true,
      schema,
    });

    await table.commit({ rows: [{ account: "Acme", arr: 100, nrr: 1.1 }] });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain('<autoFilter ref="A3:C4"/>');
  });

  it("renders styled placeholder cells for ungrouped columns above mixed streamed report headers", async () => {
    const schema = Internal.SchemaBuilder.create<{ account: string; arr: number; nrr: number }>()
      .column("account", { accessor: "account" })
      .group("financials", { header: "Financials" }, (group) => {
        group.column("arr", { accessor: "arr" });
        group.column("nrr", { accessor: "nrr" });
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Board").table("portfolio", {
      title: "Portfolio Snapshot",
      schema,
      defaults: {
        groupHeader: { preset: "header.accent" },
      },
    });

    await table.commit({ rows: [{ account: "Acme", arr: 100, nrr: 1.1 }] });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain('r="A2"');
    expect(content).toContain('<mergeCell ref="B2:C2"/>');
    expect(content).toContain('r="A3"');
    expect(content).not.toContain('<mergeCell ref="A2:A3"/>');
  });

  it("anchors streamed formula cells to physical sub-rows when rows expand", async () => {
    const schema = Internal.SchemaBuilder.create<{ items: number[]; qtys: number[] }>()
      .column("items", {
        accessor: (row) => row.items,
      })
      .column("qtys", {
        accessor: (row) => row.qtys,
      })
      .column("lineTotal", {
        formula: ({ refs }) => refs.column("items").mul(refs.column("qtys")),
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Orders").table("orders", {
      schema,
    });

    await table.commit({
      rows: [{ items: [2, 3], qtys: [4, 5] }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>(A2*B2)</f>");
    expect(content).toContain("<f>(A3*B3)</f>");
  });

  it("broadcasts scalar refs in streamed nested formulas", async () => {
    const schema = Internal.SchemaBuilder.create<{
      discountRate: number;
      qtys: number[];
      prices: number[];
    }>()
      .column("discountRate", {
        accessor: "discountRate",
      })
      .column("qtys", {
        accessor: (row) => row.qtys,
      })
      .column("prices", {
        accessor: (row) => row.prices,
      })
      .column("netRevenue", {
        formula: ({ refs, fx }) =>
          refs
            .column("qtys")
            .mul(refs.column("prices"))
            .mul(fx.literal(1).sub(refs.column("discountRate"))),
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Orders").table("orders", {
      schema,
    });

    await table.commit({
      rows: [{ discountRate: 0.1, qtys: [2, 3], prices: [10, 20] }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>((B2*C2)*(1-A2))</f>");
    expect(content).toContain("<f>((B3*C3)*(1-A2))</f>");
  });

  it("serializes row-aware summary formulas in streamed workbooks", async () => {
    const schema = Internal.SchemaBuilder.create<{ amounts: number[] }>()
      .column("amount", {
        accessor: (row) => row.amounts,
        summary: (summary) => [
          summary.formula(({ column }) => column.rows().sum((row) => row.cells().average())),
        ],
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Summary").table("summary", {
      schema,
    });

    await table.commit({
      rows: [{ amounts: [10, 20, 30] }, { amounts: [100, 200] }],
    });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>SUM(AVERAGE(A2:A4),AVERAGE(A5:A6))</f>");
  });

  it("keeps streamed row-level aggregate formulas scalar when configured", async () => {
    const schema = Internal.SchemaBuilder.create<{ amounts: number[] }>()
      .column("amount", {
        accessor: (row) => row.amounts,
      })
      .column("rowAverage", {
        formula: ({ row }) => row.series("amount").average(),
        expansion: "single",
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Summary").table("summary", { schema });

    await table.commit({ rows: [{ amounts: [10, 20, 30] }] });
    await workbook.finish();

    const content = Buffer.from(sink.toUint8Array()).toString("latin1");
    expect(content).toContain("<f>AVERAGE(A2:A4)</f>");
  });

  it("writes formula-based summary cells in streamed worksheets", async () => {
    const schema = Internal.SchemaBuilder.create<{ amount: number; label: string }>()
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
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.SchemaBuilder.create<{ amount: number; label: string }>()
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
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.SchemaBuilder.create<{ amount: number; label: string }>()
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
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.SchemaBuilder.create<{ qty: number; unitPrice: number }>()
      .column("qty", {
        accessor: "qty",
      })
      .column("unitPrice", {
        accessor: "unitPrice",
      })
      .column("lineTotal", {
        formula: ({ refs }) => refs.column("qty").mul(refs.column("unitPrice")),
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.SchemaBuilder.create<{ qty: number; unitPrice: number }>()
      .column("qty", {
        accessor: "qty",
      })
      .column("unitPrice", {
        accessor: "unitPrice",
      })
      .column("roundedTotal", {
        formula: ({ refs, fx }) => fx.round(refs.column("qty").mul(refs.column("unitPrice")), 2),
      })
      .column("status", {
        formula: ({ refs, fx }) => fx.if(refs.column("qty").gt(10), "HIGH", "NORMAL"),
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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
    const schema = Internal.SchemaBuilder.create<{ id: string; tags: string[] }>()
      .column("id", {
        accessor: "id",
      })
      .column("tags", {
        accessor: (row) => row.tags,
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = Internal.StreamWorkbookBuilder.create({ sink, spoolFactory });
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

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as VNext from "../../src/vnext";
import { MemorySpoolFactory, MemoryWorkbookSink } from "./helpers";

describe("vnext stream builder", () => {
  it("commits batches, updates summaries, and writes a final manifest report to the sink", async () => {
    const schema = VNext.SchemaBuilder.create<{ amount: number; name: string }>()
      .column("name", {
        accessor: "name",
      })
      .column("amount", {
        accessor: "amount",
        summary: {
          init: () => 0,
          step: (acc: number, row) => acc + row.amount,
          finalize: (acc: number) => acc,
        },
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });

    const sheet = workbook.sheet("Orders");
    const table = await sheet.table({
      id: "orders",
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
    const table = await workbook.sheet("Logs").table({
      id: "logs",
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
    const table = await workbook.sheet("Merged").table({
      id: "rows",
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
    const table = await workbook.sheet("Heights").table({
      id: "rows",
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
    const table = await workbook.sheet("Styled").table({
      id: "rows",
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
      .table({
        id: "rows",
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
        summary: {
          init: () => 0,
          step: (acc: number, row) => acc + row.amount,
          finalize: (acc: number) => acc,
        },
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
    const table = await workbook.sheet("Summary").table({
      id: "rows",
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
        summary: [
          {
            init: () => 0,
            step: (acc: number) => acc,
            finalize: () => "TOTAL BEFORE VAT",
          },
          {
            init: () => 0,
            step: (acc: number) => acc,
            finalize: () => "TOTAL",
          },
        ],
      })
      .column("amount", {
        accessor: "amount",
        summary: [
          {
            init: () => 0,
            step: (acc: number, row) => acc + row.amount,
            finalize: (acc: number) => acc,
          },
          {
            init: () => 0,
            step: (acc: number, row) => acc + row.amount,
            finalize: (acc: number) => acc * 1.2,
          },
        ],
      })
      .build();

    const sink = new MemoryWorkbookSink();
    const spoolFactory = new MemorySpoolFactory();
    const workbook = VNext.StreamWorkbookBuilder.create({ sink, spoolFactory });
    const table = await workbook.sheet("Summary").table({
      id: "rows",
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
    const table = await workbook.sheet("Financial Report | Full").table({
      id: "financial-report",
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
    const table = await workbook.sheet("Pipeable").table({
      id: "rows",
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
});

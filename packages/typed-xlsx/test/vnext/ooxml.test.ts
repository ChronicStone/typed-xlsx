import { afterEach, describe, expect, it, vi } from "vitest";
import * as VNext from "../../src/vnext";
import { serializeCell } from "../../src/vnext/ooxml/cells";
import { createSharedStringsCollector } from "../../src/vnext/ooxml/shared-strings";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("vnext ooxml", () => {
  it("serializes a buffered workbook plan into workbook and worksheet xml parts", () => {
    const schema = VNext.SchemaBuilder.create<{ name: string; amount: number }>()
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

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Orders").table("orders", {
      title: "Orders",
      schema,
      rows: [
        { name: "A", amount: 3 },
        { name: "B", amount: 7 },
      ],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const workbookPart = xml.parts.find((part) => part.path === "xl/workbook.xml");
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");
    const sharedStringsPart = xml.parts.find((part) => part.path === "xl/sharedStrings.xml");

    expect(workbookPart?.xml).toContain("<sheet");
    expect(worksheetPart?.xml).toContain("<sheetData>");
    expect(worksheetPart?.xml).toContain("<v>3</v>");
    expect(worksheetPart?.xml).toContain("<v>7</v>");
    expect(worksheetPart?.xml).toContain("<v>10</v>");
    expect(sharedStringsPart?.xml).toContain("<t>Name</t>");
    expect(sharedStringsPart?.xml).toContain("<t>Amount</t>");
  });

  it("builds a minimal xlsx zip artifact from the buffered workbook", () => {
    const schema = VNext.SchemaBuilder.create<{ name: string }>()
      .column("name", {
        accessor: "name",
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Sheet").table("sheet", {
      schema,
      rows: [{ name: "A" }],
    });

    const bytes = workbook.buildXlsx();

    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
    expect(bytes.byteLength).toBeGreaterThan(100);
  });

  it("writes sheet view settings like RTL and freeze panes into worksheet xml", () => {
    const schema = VNext.SchemaBuilder.create<{ name: string }>()
      .column("name", {
        accessor: "name",
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook
      .sheet("Sheet")
      .options({
        rightToLeft: true,
        freezePane: { rows: 1, columns: 1 },
      })
      .table("sheet", {
        schema,
        rows: [{ name: "A" }],
      });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");

    expect(worksheetPart?.xml).toContain('rightToLeft="1"');
    expect(worksheetPart?.xml).toContain('state="frozen"');
    expect(worksheetPart?.xml).toContain('xSplit="1"');
    expect(worksheetPart?.xml).toContain('ySplit="1"');
  });

  it("lays out multiple tables on the same worksheet when tablesPerRow is set", () => {
    const schema = VNext.SchemaBuilder.create<{ name: string }>()
      .column("name", {
        accessor: "name",
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook
      .sheet("Grid")
      .options({
        tablesPerRow: 2,
      })
      .table("left", {
        schema,
        rows: [{ name: "A" }],
      })
      .table("right", {
        schema,
        rows: [{ name: "B" }],
      });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");

    expect(xml.parts.filter((part) => part.path.startsWith("xl/worksheets/"))).toHaveLength(1);
    expect(worksheetPart?.xml).toContain('r="A1"');
    expect(worksheetPart?.xml).toContain('r="C1"');
  });

  it("writes column widths, merge cells, and style references into worksheet artifacts", () => {
    const schema = VNext.SchemaBuilder.create<{ name: string; tags: string[] }>()
      .column("name", {
        accessor: "name",
        headerStyle: {
          font: {
            bold: true,
          },
        },
        style: {
          alignment: {
            horizontal: "left",
          },
        },
      })
      .column("tags", {
        accessor: (row) => row.tags,
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Merged").table("merged", {
      schema,
      rows: [{ name: "Alpha", tags: ["x", "yy"] }],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");
    const stylesPart = xml.parts.find((part) => part.path === "xl/styles.xml");

    expect(worksheetPart?.xml).toContain("<cols>");
    expect(worksheetPart?.xml).toContain('customWidth="1"');
    expect(worksheetPart?.xml).toContain("<mergeCells");
    expect(worksheetPart?.xml).toContain('ref="A2:A3"');
    expect(worksheetPart?.xml).toContain(' s="1"');
    expect(stylesPart?.xml).toContain("<fonts");
    expect(stylesPart?.xml).toContain('applyFont="1"');
  });

  it("writes worksheet autoFilter metadata for buffered report tables", () => {
    const schema = VNext.SchemaBuilder.create<{ amount: number; name: string }>()
      .column("name", {
        accessor: "name",
      })
      .column("amount", {
        accessor: "amount",
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Orders").table("orders", {
      autoFilter: true,
      schema,
      rows: [
        { name: "A", amount: 3 },
        { name: "B", amount: 7 },
      ],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");

    expect(worksheetPart?.xml).toContain('<autoFilter ref="A1:B3"/>');
    expect(worksheetPart?.xml.indexOf("<sheetData>")).toBeLessThan(
      worksheetPart?.xml.indexOf('<autoFilter ref="A1:B3"/>') ?? -1,
    );
  });

  it("writes native Excel table parts, relationships, and content types for buffered worksheets", () => {
    const schema = VNext.ExcelTableSchemaBuilder.create<{ amount: number; name: string }>()
      .column("name", {
        accessor: "name",
      })
      .column("amount", {
        accessor: "amount",
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Orders").table("orders", {
      autoFilter: false,
      name: "OrdersTable",
      schema,
      rows: [
        { name: "A", amount: 3 },
        { name: "B", amount: 7 },
      ],
      style: "TableStyleDark2",
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");
    const worksheetRelsPart = xml.parts.find(
      (part) => part.path === "xl/worksheets/_rels/sheet1.xml.rels",
    );
    const tablePart = xml.parts.find((part) => part.path === "xl/tables/table1.xml");
    const workbookBytes = workbook.buildXlsx();
    const workbookContent = Buffer.from(workbookBytes).toString("latin1");

    expect(worksheetPart?.xml).toContain('<tableParts count="1">');
    expect(worksheetPart?.xml).toContain('<tablePart r:id="rIdTable1"/>');
    expect(worksheetPart?.xml).not.toContain("<autoFilter");

    expect(worksheetRelsPart?.xml).toContain('Id="rIdTable1"');
    expect(worksheetRelsPart?.xml).toContain('Target="../tables/table1.xml"');

    expect(tablePart?.xml).toContain('name="OrdersTable"');
    expect(tablePart?.xml).toContain('displayName="OrdersTable"');
    expect(tablePart?.xml).toContain('ref="A1:B3"');
    expect(tablePart?.xml).not.toContain("<autoFilter");
    expect(tablePart?.xml).toContain('tableStyleInfo name="TableStyleDark2"');

    expect(workbookContent).toContain("/xl/tables/table1.xml");
  });

  it("writes native Excel table totals-row metadata for buffered worksheets", () => {
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

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Orders").table("orders", {
      rows: [
        { amount: 3, label: "A" },
        { amount: 7, label: "B" },
      ],
      schema,
      totalsRow: true,
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const tablePart = xml.parts.find((part) => part.path === "xl/tables/table1.xml");
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");
    const sharedStringsPart = xml.parts.find((part) => part.path === "xl/sharedStrings.xml");

    expect(tablePart?.xml).toContain('ref="A1:B4"');
    expect(tablePart?.xml).toContain('totalsRowCount="1"');
    expect(tablePart?.xml).not.toContain('totalsRowShown="1"');
    expect(tablePart?.xml).toContain('totalsRowLabel="TOTAL"');
    expect(tablePart?.xml).toContain('totalsRowFunction="sum"');
    expect(worksheetPart?.xml).toContain('r="A4"');
    expect(sharedStringsPart?.xml).toContain("TOTAL");
    expect(worksheetPart?.xml).toContain("SUBTOTAL(109,[Amount])");
  });

  it("serializes excel-table formula columns with structured references in buffered worksheets", () => {
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

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Orders").table("orders", {
      rows: [{ qty: 3, unitPrice: 7 }],
      schema,
    });

    const worksheetPart = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan()).parts.find(
      (part) => part.path === "xl/worksheets/sheet1.xml",
    );

    expect(worksheetPart?.xml).toContain("<f>([@Qty]*[@Unit price])</f>");
  });

  it("uses workbook-global table numbering across buffered sheets", () => {
    const schema = VNext.ExcelTableSchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Left").table("left", {
      rows: [{ value: "A" }],
      schema,
    });
    workbook.sheet("Right").table("right", {
      rows: [{ value: "B" }],
      schema,
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const sheet1Rels = xml.parts.find(
      (part) => part.path === "xl/worksheets/_rels/sheet1.xml.rels",
    );
    const sheet2Rels = xml.parts.find(
      (part) => part.path === "xl/worksheets/_rels/sheet2.xml.rels",
    );
    const table1 = xml.parts.find((part) => part.path === "xl/tables/table1.xml");
    const table2 = xml.parts.find((part) => part.path === "xl/tables/table2.xml");

    expect(sheet1Rels?.xml).toContain('Target="../tables/table1.xml"');
    expect(sheet2Rels?.xml).toContain('Target="../tables/table2.xml"');
    expect(table1?.xml).toContain('ref="A1:A2"');
    expect(table2?.xml).toContain('ref="A1:A2"');
  });

  it("rejects buffered native Excel tables for merged physical rows", () => {
    const schema = {
      kind: "excel-table",
      columns: [
        { accessor: "id", id: "id" },
        {
          accessor: (row: { id: string; tags: string[] }) => row.tags.join(", "),
          id: "tagList",
          transform: (_value: string, row: { id: string; tags: string[] }) => row.tags,
        },
      ],
    } as unknown as import("../../src/vnext").ExcelTableSchemaDefinition<
      { id: string; tags: string[] },
      "id" | "tagList"
    >;

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Orders").table("orders", {
      rows: [{ id: "1", tags: ["a", "b"] }],
      schema,
    });

    expect(() => VNext.serializeBufferedWorkbookPlan(workbook.buildPlan())).toThrow(
      "Native Excel tables require flat physical rows. Remove array-expanded columns and merged body cells, or use the default report table mode.",
    );
  });

  it("writes formula-based summary cells for buffered worksheets", () => {
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

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Orders").table("orders", {
      schema,
      rows: [
        { label: "A", amount: 3 },
        { label: "B", amount: 7 },
      ],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");

    expect(worksheetPart?.xml).toContain("<f>SUM(B2:B3)</f>");
  });

  it("writes richer summary formula callbacks for buffered worksheets", () => {
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

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Orders").table("orders", {
      schema,
      rows: [
        { label: "A", amount: 3.125 },
        { label: "B", amount: 7.333 },
      ],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");

    expect(worksheetPart?.xml).toContain("<f>ROUND(SUM(B2:B3),2)</f>");
  });

  it("renders summary spacer cells without default summary styling", () => {
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

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Orders").table("orders", {
      schema,
      rows: [
        { label: "A", amount: 3 },
        { label: "B", amount: 7 },
      ],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");

    expect(worksheetPart?.xml).toContain('<c r="A5"/>');
  });

  it("writes formula-based derived columns for buffered worksheets", () => {
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

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Orders").table("orders", {
      schema,
      rows: [{ qty: 3, unitPrice: 7 }],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");

    expect(worksheetPart?.xml).toContain("<f>(A2*B2)</f>");
  });

  it("writes richer formula functions for buffered worksheets", () => {
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
        formula: ({ row, fx }) =>
          fx.if(row.ref("qty").gt(10).or(row.ref("unitPrice").gt(100)), "HIGH", "NORMAL"),
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Orders").table("orders", {
      schema,
      rows: [{ qty: 3, unitPrice: 7 }],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");

    expect(worksheetPart?.xml).toContain("<f>ROUND((A2*B2),2)</f>");
    expect(worksheetPart?.xml).toContain(
      "IF(OR((A2&gt;10),(B2&gt;100)),&quot;HIGH&quot;,&quot;NORMAL&quot;)",
    );
  });

  it("inherits static column formatting for formula summary cells", () => {
    const schema = VNext.SchemaBuilder.create<{ createdAt: Date; label: string }>()
      .column("label", {
        accessor: "label",
        summary: (summary) => [summary.label("LATEST")],
      })
      .column("createdAt", {
        accessor: "createdAt",
        style: {
          numFmt: "yyyy-mm-dd hh:mm",
        },
        summary: (summary) => [summary.formula("max")],
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Orders").table("orders", {
      schema,
      rows: [
        { label: "A", createdAt: new Date(Date.UTC(2025, 2, 3, 9, 30, 0)) },
        { label: "B", createdAt: new Date(Date.UTC(2025, 2, 7, 9, 30, 0)) },
      ],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");
    const stylesPart = xml.parts.find((part) => part.path === "xl/styles.xml");

    expect(worksheetPart?.xml).toContain("<f>MAX(B2:B3)</f>");
    expect(stylesPart?.xml).toContain("yyyy-mm-dd hh:mm");
  });

  it("rejects multiple buffered tables with autoFilter on the same worksheet", () => {
    const schema = VNext.SchemaBuilder.create<{ value: string }>()
      .column("value", {
        accessor: "value",
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook
      .sheet("Orders")
      .options({ tablesPerRow: 2 })
      .table("left", { autoFilter: true, schema, rows: [{ value: "A" }] })
      .table("right", { autoFilter: true, schema, rows: [{ value: "B" }] });

    expect(() => VNext.serializeBufferedWorkbookPlan(workbook.buildPlan())).toThrow(
      "Buffered worksheets can only apply autoFilter to one report table per sheet. Worksheet-level autoFilter supports a single contiguous range; if you need multiple filtered tables on the same sheet, use native Excel tables instead.",
    );
  });

  it("disables worksheet autoFilter for buffered tables with merged body rows", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const schema = VNext.SchemaBuilder.create<{ id: string; tags: string[] }>()
      .column("id", {
        accessor: "id",
      })
      .column("tags", {
        accessor: (row) => row.tags,
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Orders").table("orders", {
      autoFilter: true,
      schema,
      rows: [{ id: "1", tags: ["a", "b"] }],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");

    expect(worksheetPart?.xml).not.toContain("<autoFilter");
    expect(warn).toHaveBeenCalledWith(
      "[typed-xlsx] Disabled autoFilter for buffered table 'orders' because the rendered report contains vertically merged body cells from sub-row expansion. Worksheet auto-filters operate on flat physical rows; use a flat report table or native Excel tables for filtered views.",
    );
  });

  it("writes custom row heights when planned rows need more vertical space", () => {
    const schema = VNext.SchemaBuilder.create<{ notes: string }>()
      .column("notes", {
        accessor: "notes",
        style: {
          font: { size: 14 },
        },
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Heights").table("heights", {
      schema,
      rows: [{ notes: "line 1\nline 2" }],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");

    expect(worksheetPart?.xml).toContain('ht="');
    expect(worksheetPart?.xml).toContain('customHeight="1"');
  });

  it("writes sparse summary rows and serializes dates as numeric excel values", () => {
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

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Summary").table("summary", {
      schema,
      rows: [{ name: "A", amount: 5, createdAt: new Date(Date.UTC(2025, 2, 3, 0, 0, 0)) }],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");
    const stylesPart = xml.parts.find((part) => part.path === "xl/styles.xml");

    expect(worksheetPart?.xml).toContain('<row r="3" ht="30" customHeight="1">');
    expect(worksheetPart?.xml).toContain('r="B3"');
    expect(worksheetPart?.xml).not.toContain('r="A3"');
    expect(worksheetPart?.xml).not.toContain('r="C3"');
    expect(worksheetPart?.xml).toContain('<c r="C2" s="');
    expect(worksheetPart?.xml).not.toContain("2025-03-03T00:00:00.000Z");
    expect(stylesPart?.xml).toContain("<numFmts");
    expect(stylesPart?.xml).toContain('formatCode="yyyy-mm-dd"');
  });

  it("writes custom number format definitions for currency and percent-point styles", () => {
    const schema = VNext.SchemaBuilder.create<{ amount: number; margin: number }>()
      .column("amount", {
        accessor: "amount",
        style: {
          numFmt: "$#,##0.00",
        },
      })
      .column("margin", {
        accessor: "margin",
        style: {
          numFmt: '0.00"%"',
        },
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Formats").table("formats", {
      schema,
      rows: [{ amount: 1234.5, margin: 15.92 }],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const stylesPart = xml.parts.find((part) => part.path === "xl/styles.xml");

    expect(stylesPart?.xml).toContain("<numFmts");
    expect(stylesPart?.xml).toContain('formatCode="$#,##0.00"');
    expect(stylesPart?.xml).toContain('formatCode="0.00&quot;%&quot;"');
  });

  it("writes multiple summary rows when a column defines multiple summaries", () => {
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

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Summary").table("summary", {
      schema,
      rows: [{ label: "A", amount: 5 }],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const worksheetPart = xml.parts.find((part) => part.path === "xl/worksheets/sheet1.xml");
    const sharedStringsPart = xml.parts.find((part) => part.path === "xl/sharedStrings.xml");

    expect(worksheetPart?.xml).toContain('<row r="3" ht="30" customHeight="1">');
    expect(worksheetPart?.xml).toContain('<row r="4" ht="30" customHeight="1">');
    expect(worksheetPart?.xml).toContain('r="A3"');
    expect(worksheetPart?.xml).toContain('r="A4"');
    expect(worksheetPart?.xml).toContain('r="B3"');
    expect(worksheetPart?.xml).toContain('r="B4"');
    expect(sharedStringsPart?.xml).toContain("<t>TOTAL BEFORE VAT</t>");
    expect(sharedStringsPart?.xml).toContain("<t>TOTAL</t>");
    expect(worksheetPart?.xml).toContain("<v>5</v>");
    expect(worksheetPart?.xml).toContain("<v>6</v>");
  });

  it("sanitizes worksheet names for excel compatibility", () => {
    const schema = VNext.SchemaBuilder.create<{ name: string }>()
      .column("name", {
        accessor: "name",
      })
      .build();

    const workbook = VNext.BufferedWorkbookBuilder.create();
    workbook.sheet("Financial Report | Full").table("sheet", {
      schema,
      rows: [{ name: "A" }],
    });

    const xml = VNext.serializeBufferedWorkbookPlan(workbook.buildPlan());
    const workbookPart = xml.parts.find((part) => part.path === "xl/workbook.xml");

    expect(workbookPart?.xml).toContain('name="Financial Report Full"');
    expect(workbookPart?.xml).not.toContain("|");
  });

  it("serializes formula cells with cached values", () => {
    const sharedStrings = createSharedStringsCollector();

    const xml = serializeCell(
      1,
      1,
      {
        kind: "formula",
        formula: "SUM(B2:B3)",
        value: 10,
      },
      sharedStrings,
    );

    expect(xml).toContain('r="B2"');
    expect(xml).toContain("<f>SUM(B2:B3)</f>");
    expect(xml).toContain("<v>10</v>");
  });

  it("xml-escapes advanced formula operators in formula cells", () => {
    const sharedStrings = createSharedStringsCollector();

    const xml = serializeCell(
      1,
      1,
      {
        kind: "formula",
        formula: 'IF(OR((I2="WATCH"),(H2<0.5)),"REVIEW","OK")',
      },
      sharedStrings,
    );

    expect(xml).toContain("H2&lt;0.5");
    expect(xml).not.toContain("H2<0.5");
  });
});

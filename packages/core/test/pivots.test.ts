import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createExcelSchema, createWorkbook, createWorkbookStream } from "../src";
import {
  layoutPivot,
  PivotAccumulator,
  UNKNOWN_PIVOT_VALUE,
  type PivotDefinition,
} from "../src/pivot/engine";

type Sale = {
  region: string;
  product: string;
  month: string;
  channel: string;
  revenue: number;
  orders: number;
};

const salesSchema = createExcelSchema<Sale>()
  .column("region", { header: "Region", accessor: "region" })
  .column("product", { header: "Product", accessor: "product" })
  .column("month", { header: "Month", accessor: "month" })
  .column("channel", { header: "Channel", accessor: "channel" })
  .column("revenue", { header: "Revenue", accessor: "revenue", style: { numFmt: "#,##0" } })
  .column("orders", { header: "Orders", accessor: "orders" })
  .build();

const rows: Sale[] = [
  { region: "Nord", product: "Chairs", month: "Jan", channel: "Web", revenue: 10, orders: 1 },
  { region: "Sud", product: "Tables", month: "Jan", channel: "Store", revenue: 20, orders: 2 },
  { region: "nord", product: "Tables", month: "Feb", channel: "Web", revenue: 30, orders: 3 },
  { region: "Est", product: "Chairs", month: "Feb", channel: "Store", revenue: 40, orders: 4 },
  { region: "Sud", product: "Chairs", month: "Feb", channel: "Web", revenue: 50, orders: 5 },
];

function definition(overrides: Partial<PivotDefinition> = {}): PivotDefinition {
  return {
    id: "p",
    sourceHeaders: ["Region", "Product", "Month", "Revenue"],
    rows: [{ index: 0, header: "Region" }],
    filters: [],
    values: [{ index: 3, header: "Revenue", aggregate: "sum", name: "Sum of Revenue" }],
    sort: "ascending",
    rowTotals: true,
    columnTotals: true,
    grandTotalLabel: "Grand Total",
    style: "PivotStyleLight16",
    ...overrides,
  };
}

function tally(def: PivotDefinition, data: unknown[][]) {
  const accumulator = new PivotAccumulator(def);
  for (const row of data) accumulator.add((index) => row[index] as never);
  return accumulator;
}

function grid(layout: ReturnType<typeof layoutPivot>) {
  const height = layout.height;
  const lines: string[] = [];
  for (let row = 0; row < height; row += 1) {
    const cells = layout.cells.filter((cell) => cell.row === row).sort((a, b) => a.col - b.col);
    const line: string[] = Array.from({ length: layout.width }, () => "");
    for (const cell of cells) line[cell.col] = cell.value === null ? "" : String(cell.value);
    lines.push(line.join("|"));
  }
  return lines;
}

function readParts(bytes: Uint8Array) {
  const archive = unzipSync(bytes);
  const text = (path: string) => {
    const entry = archive[path];
    if (!entry) throw new Error(`missing part ${path}`);
    return new TextDecoder().decode(entry);
  };
  return { paths: Object.keys(archive).sort(), text };
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

describe("pivot engine", () => {
  const data = rows.map((row) => [row.region, row.product, row.month, row.revenue]);

  it("lays out rows and a column field like Excel's compact form", () => {
    const layout = layoutPivot(tally(definition({ column: { index: 2, header: "Month" } }), data));
    expect(grid(layout)).toEqual([
      "Sum of Revenue|Month||",
      "Region|Feb|Jan|Grand Total",
      "Est|40||40",
      "Nord|30|10|40",
      "Sud|50|20|70",
      "Grand Total|120|30|150",
    ]);
    expect(layout.firstDataRow).toBe(2);
    expect(layout.dataColumns.filter((column) => !column.total)).toHaveLength(2);
  });

  it("groups text case-insensitively, keeping the first spelling", () => {
    const accumulator = tally(definition(), data);
    expect(accumulator.items.get(0)!.values).toEqual(["Nord", "Sud", "Est"]);
  });

  it("nests rows with subtotals and indents inner items", () => {
    const layout = layoutPivot(
      tally(
        definition({
          rows: [
            { index: 0, header: "Region" },
            { index: 1, header: "Product" },
          ],
        }),
        data,
      ),
    );
    expect(grid(layout)).toEqual([
      "Region / Product|Sum of Revenue",
      "Est|40",
      "Chairs|40",
      "Nord|40",
      "Chairs|10",
      "Tables|30",
      "Sud|70",
      "Chairs|50",
      "Tables|20",
      "Grand Total|150",
    ]);
    expect(layout.cells.find((cell) => cell.value === "Tables")?.depth).toBe(1);
  });

  it("adds Excel's Values row for several values and a filter area above", () => {
    const layout = layoutPivot(
      tally(
        definition({
          filters: [{ index: 2, header: "Month" }],
          values: [
            { index: 3, header: "Revenue", aggregate: "sum", name: "Sum of Revenue" },
            { index: 3, header: "Revenue", aggregate: "average", name: "Average of Revenue" },
            { index: 1, header: "Product", aggregate: "count", name: "Count of Product" },
          ],
        }),
        data,
      ),
    );
    expect(grid(layout).slice(0, 5)).toEqual([
      "Month|(All)||",
      "|||",
      "|Values||",
      "Region|Sum of Revenue|Average of Revenue|Count of Product",
      "Est|40|40|1",
    ]);
    expect(layout.pageRows).toBe(2);
  });

  it("sorts descending or keeps the source order, blanks last", () => {
    const withBlank = [...data, [null, "Lamps", "Mar", 5]];
    const descending = layoutPivot(tally(definition({ sort: "descending" }), withBlank));
    expect(
      descending.cells.filter((cell) => cell.role === "label").map((cell) => cell.value),
    ).toEqual(["Sud", "Nord", "Est", "(blank)"]);
    const source = layoutPivot(tally(definition({ sort: "source" }), withBlank));
    expect(source.cells.filter((cell) => cell.role === "label").map((cell) => cell.value)).toEqual([
      "Nord",
      "Sud",
      "Est",
      "(blank)",
    ]);
  });

  it("leaves values Excel must compute empty, and refuses them as fields", () => {
    const layout = layoutPivot(
      tally(definition(), [["Nord", "Chairs", "Jan", UNKNOWN_PIVOT_VALUE]]),
    );
    expect(layout.cells.find((cell) => cell.role === "value")?.value).toBeNull();
    expect(() => tally(definition(), [[UNKNOWN_PIVOT_VALUE, "Chairs", "Jan", 1]])).toThrow(
      'Pivot "p": "Region" is computed by Excel, so it cannot be a row, column or filter.',
    );
  });
});

describe("workbook pivots", () => {
  it("writes the pivot cache, table, relationships and pre-filled cells", () => {
    const { paths, text } = readParts(
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: salesSchema, rows, title: "Sales" })
        .sheet("Analysis")
        .pivot("byRegion", ({ refs }) =>
          refs
            .sheet("Sales")
            .table("sales")
            .pivot({
              rows: ["region"],
              columns: ["month"],
              values: { revenue: "sum", orders: { aggregate: "count", name: "Orders" } },
              filters: ["channel"],
            }),
        )
        .toUint8Array(),
    );

    expect(paths).toEqual(
      expect.arrayContaining([
        "xl/pivotCache/pivotCacheDefinition1.xml",
        "xl/pivotTables/pivotTable1.xml",
        "xl/pivotTables/_rels/pivotTable1.xml.rels",
      ]),
    );
    expect(text("[Content_Types].xml")).toContain(
      'PartName="/xl/pivotTables/pivotTable1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.pivotTable+xml"',
    );
    expect(text("xl/workbook.xml")).toContain(
      '<pivotCaches><pivotCache cacheId="1" r:id="rIdPivotCache1"/></pivotCaches>',
    );
    expect(text("xl/_rels/workbook.xml.rels")).toContain(
      'Target="pivotCache/pivotCacheDefinition1.xml"',
    );
    expect(text("xl/worksheets/_rels/sheet2.xml.rels")).toContain(
      'Target="../pivotTables/pivotTable1.xml"',
    );

    // The cache reads the header row under the title, through the last body row.
    const cache = text("xl/pivotCache/pivotCacheDefinition1.xml");
    expect(cache).toContain('<worksheetSource ref="A2:F7" sheet="Sales"/>');
    expect(cache).toContain('refreshOnLoad="1" saveData="0"');
    expect(cache).toContain(
      '<cacheField name="Region" numFmtId="0"><sharedItems count="3"><s v="Nord"/><s v="Sud"/><s v="Est"/></sharedItems></cacheField>',
    );
    expect(cache).toContain('<cacheField name="Revenue" numFmtId="0"><sharedItems/></cacheField>');

    const table = text("xl/pivotTables/pivotTable1.xml");
    expect(table).toContain('rowHeaderCaption="Region" colHeaderCaption="Month"');
    expect(table).toContain('<pageFields count="1"><pageField fld="3" hier="-1"/></pageFields>');
    expect(table).toContain('<colFields count="2"><field x="2"/><field x="-2"/></colFields>');
    expect(table).toMatch(
      /<dataField name="Sum of Revenue" fld="4" baseField="0" baseItem="0" numFmtId="\d+"\/>/,
    );
    // "Orders" is also a source field name, so Excel's own workaround applies: a trailing space.
    expect(table).toContain('<dataField name="Orders " fld="5" subtotal="count"');
    expect(table).not.toContain("sortType");

    const sheet = text("xl/worksheets/sheet2.xml");
    expect(sheet).toMatch(/<c r="A1" t="inlineStr" s="\d+"><is><t>Channel<\/t>/);
    expect(sheet).toContain("<t>Channel</t>");
    expect(sheet).toContain("<t>(All)</t>");
  });

  it("points at native Excel tables by name", () => {
    const native = createExcelSchema<Sale>({ mode: "excel-table" })
      .column("region", { header: "Region", accessor: "region" })
      .column("revenue", { header: "Revenue", accessor: "revenue" })
      .build();
    const { text } = readParts(
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: native, rows, name: "SalesTable" })
        .pivot("byRegion", ({ refs }) =>
          refs.table("sales").pivot({ rows: ["region"], values: { revenue: "sum" } }),
        )
        .toUint8Array(),
    );
    expect(text("xl/pivotCache/pivotCacheDefinition1.xml")).toContain(
      '<worksheetSource name="SalesTable"/>',
    );
    // Below the table: header + 5 rows end on row 6, one blank row, two rows kept free, then the pivot.
    expect(text("xl/pivotTables/pivotTable1.xml")).toContain('<location ref="A10:B14"');
  });

  it("writes pivot charts linked to their pivot", () => {
    const { text } = readParts(
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: salesSchema, rows })
        .sheet("Analysis")
        .pivot("byRegion", ({ refs }) =>
          refs
            .sheet("Sales")
            .table("sales")
            .pivot({ rows: ["region"], columns: ["month"], values: { revenue: "sum" } }),
        )
        .chart("chart", ({ refs }) => ({ marks: [refs.pivot("byRegion").bar({ stack: true })] }))
        .toUint8Array(),
    );
    const chart = text("xl/charts/chart1.xml");
    expect(chart).toContain(
      '<c:pivotSource><c:name>[]Analysis!byRegion</c:name><c:fmtId val="0"/></c:pivotSource>',
    );
    expect(chart).toContain('<c:pivotFmts><c:pivotFmt><c:idx val="0"/></c:pivotFmt></c:pivotFmts>');
    expect(chart).toContain('<c:grouping val="stacked"/>');
    // Pivot at A3: headers on rows 3-4, items on rows 5-7, months in B and C.
    expect(chart).toContain("<c:f>&apos;Analysis&apos;!$A$5:$A$7</c:f>");
    expect(chart).toContain("<c:f>&apos;Analysis&apos;!$B$4</c:f>");
    expect(chart).toContain("<c:f>&apos;Analysis&apos;!$C$5:$C$7</c:f>");
  });

  it("explains what it cannot pivot", () => {
    const bad = (pivot: (sales: any) => any) =>
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: salesSchema, rows })
        .pivot("bad", ({ refs }) => pivot(refs.table("sales")));

    expect(() =>
      bad((sales) => sales.pivot({ rows: ["nope"], values: { revenue: "sum" } })).toUint8Array(),
    ).toThrow('Pivot "bad": row "nope" is not rendered in table "Sales/sales".');
    expect(() =>
      bad((sales) =>
        sales.pivot({ rows: ["region"], filters: ["region"], values: { revenue: "sum" } }),
      ).toUint8Array(),
    ).toThrow(
      'Pivot "bad": field "region" is used twice: a field is a row, a column or a filter, once.',
    );
    expect(() =>
      bad((sales) => sales.pivot({ rows: ["region"], values: {} })).toUint8Array(),
    ).toThrow('Pivot "bad": needs at least one value.');
  });
});

describe("streamed pivots", () => {
  it("tallies rows as batches are committed", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const sales = await workbook.sheet("Sales").table("sales", { schema: salesSchema });
    const analysis = workbook.sheet("Analysis");
    const byRegion = analysis.pivot(
      "byRegion",
      sales.pivot({ rows: ["region"], values: { revenue: "sum" }, sort: "source" }),
    );
    analysis.chart("chart", { marks: [byRegion.pie()] });
    await sales.commit({ rows: rows.slice(0, 2) });
    await sales.commit({ rows: rows.slice(2) });

    const { text } = readParts(await streamBytes(workbook));
    expect(text("xl/pivotCache/pivotCacheDefinition1.xml")).toContain('recordCount="5"');
    expect(text("xl/pivotCache/pivotCacheDefinition1.xml")).toContain(
      '<worksheetSource ref="A1:F6" sheet="Sales"/>',
    );
    const sheet = text("xl/worksheets/sheet2.xml");
    expect(sheet).toContain("<t>Nord</t>");
    expect(sheet).toMatch(/<c r="B4"[^>]*><v>40<\/v><\/c>/);
    expect(text("xl/charts/chart1.xml")).toContain("<c:pivotSource>");
    expect(text("xl/workbook.xml")).toContain("<pivotCaches>");
  });

  it("asks for pivots before rows are committed", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const sales = await workbook.sheet("Sales").table("sales", { schema: salesSchema });
    await sales.commit({ rows });
    expect(() =>
      workbook
        .sheet("Analysis")
        .pivot("late", sales.pivot({ rows: ["region"], values: { revenue: "sum" } })),
    ).toThrow(
      'Pivot "late": declare it before committing rows to "sales", since streamed rows are not kept.',
    );
    await workbook.dispose();
  });
});

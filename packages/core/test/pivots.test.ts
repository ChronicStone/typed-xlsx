import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  createExcelSchema,
  createWorkbook,
  createWorkbookStream,
  defineSpreadsheetTheme,
  spreadsheetThemes,
} from "../src";
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

type DatedSale = Sale & { orderedAt: Date };

const datedRows: DatedSale[] = rows.map((row, index) => ({
  ...row,
  orderedAt: new Date(Date.UTC(2024 + (index % 2), index * 2, 10 + index, 9)),
}));

const datedSchema = createExcelSchema<DatedSale>()
  .column("orderedAt", { header: "Ordered", accessor: "orderedAt" })
  .column("region", { header: "Region", accessor: "region" })
  .column("revenue", { header: "Revenue", accessor: "revenue", style: { numFmt: "#,##0" } })
  .build();

const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day));

/** Values of the data columns on the row labelled `label`, rounded for comparison. */
function rowValues(layout: ReturnType<typeof layoutPivot>, label: string) {
  const row = layout.cells.find((cell) => cell.col === 0 && cell.value === label)!.row;
  return layout.cells
    .filter((cell) => cell.row === row && cell.col > 0)
    .sort((left, right) => left.col - right.col)
    .map((cell) =>
      typeof cell.value === "number" ? Math.round(cell.value * 1e4) / 1e4 : cell.value,
    );
}

function definition(overrides: Partial<PivotDefinition> = {}): PivotDefinition {
  return {
    id: "p",
    sourceHeaders: ["Region", "Product", "Month", "Revenue"],
    rows: [{ index: 0, header: "Region" }],
    filters: [],
    values: [{ index: 3, header: "Revenue", aggregate: "sum", name: "Sum of Revenue" }],
    dateGroups: [],
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

  it("shows values as a share of the grand, row or column total, 0% where nothing meets", () => {
    const shown = (show: "percentOfTotal" | "percentOfRow" | "percentOfColumn") =>
      layoutPivot(
        tally(
          definition({
            column: { index: 2, header: "Month" },
            values: [{ index: 3, header: "Revenue", aggregate: "sum", name: "Share", show }],
          }),
          data,
        ),
      );
    // Columns: Feb, Jan, Grand Total. Feb totals 120, Jan 30, the whole pivot 150.
    const ofTotal = shown("percentOfTotal");
    expect(rowValues(ofTotal, "Est")).toEqual([0.2667, 0, 0.2667]);
    expect(rowValues(ofTotal, "Grand Total")).toEqual([0.8, 0.2, 1]);
    const ofRow = shown("percentOfRow");
    expect(rowValues(ofRow, "Nord")).toEqual([0.75, 0.25, 1]);
    expect(rowValues(ofRow, "Grand Total")).toEqual([0.8, 0.2, 1]);
    const ofColumn = shown("percentOfColumn");
    expect(rowValues(ofColumn, "Sud")).toEqual([0.4167, 0.6667, 0.4667]);
    expect(rowValues(ofColumn, "Grand Total")).toEqual([1, 1, 1]);
  });

  it("groups dates by year and month, in calendar order", () => {
    const grouped = definition({
      sourceHeaders: ["Ordered", "Revenue"],
      rows: [
        { index: 2, header: "Years", source: 0, group: "year" },
        { index: 0, header: "Ordered", source: 0, group: "month" },
      ],
      values: [{ index: 1, header: "Revenue", aggregate: "sum", name: "Sum of Revenue" }],
      dateGroups: [
        {
          source: 0,
          levels: [
            { index: 2, unit: "year", name: "Years" },
            { index: 0, unit: "month", name: "Ordered" },
          ],
        },
      ],
      sort: "source",
    });
    const accumulator = tally(grouped, [
      [utc(2025, 2, 3), 5],
      [utc(2024, 10, 1), 1],
      [utc(2025, 0, 9), 2],
      [utc(2025, 2, 30), 4],
    ]);
    expect(grid(layoutPivot(accumulator))).toEqual([
      "Years / Ordered|Sum of Revenue",
      "2024|1",
      "Nov|1",
      "2025|11",
      "Jan|2",
      "Mar|9",
      "Grand Total|12",
    ]);
    expect(accumulator.dateRanges.get(0)).toEqual({
      min: utc(2024, 10, 1).getTime(),
      max: utc(2025, 2, 30).getTime(),
    });
    expect(() => tally(grouped, [[null, 1]])).toThrow(
      'Pivot "p": "Ordered" is grouped by year, so every row needs a date, got a blank cell.',
    );
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
    // Excel keeps the written column widths instead of narrowing them to the values.
    expect(table).toContain('useAutoFormatting="0"');

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

  it("caches only innermost items in charts of pivots with nested rows", () => {
    const { text } = readParts(
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: datedSchema, rows: datedRows })
        .sheet("Analysis")
        .pivot("byQuarter", ({ refs }) =>
          refs
            .sheet("Sales")
            .table("sales")
            .pivot({
              rows: [{ field: "orderedAt", by: ["year", "quarter"] }],
              values: { revenue: "sum" },
            }),
        )
        .chart("chart", ({ refs }) => ({ marks: [refs.pivot("byQuarter").bar()] }))
        .toUint8Array(),
    );
    const chart = text("xl/charts/chart1.xml");
    // Years are subtotal rows in the pivot: they label groups of quarters instead of being bars.
    const cache = chart.match(/<c:multiLvlStrCache>(.*?)<\/c:multiLvlStrCache>/)?.[1] ?? "";
    const [quarters, years] = [...cache.matchAll(/<c:lvl>(.*?)<\/c:lvl>/g)].map((m) =>
      [...m[1]!.matchAll(/<c:v>(.*?)<\/c:v>/g)].map((v) => v[1]),
    );
    const count = Number(cache.match(/<c:ptCount val="(\d+)"\/>/)?.[1]);
    expect(years).toEqual(["2024", "2025"]);
    expect(quarters).toHaveLength(count);
    expect(quarters!.every((label) => /^Qtr[1-4]$/.test(label!))).toBe(true);
    const values = chart.match(/<c:numCache>.*?<\/c:numCache>/)?.[0] ?? "";
    expect(values).toContain(`<c:ptCount val="${count}"/>`);
    // The bars add up to the grand total, so no subtotal is counted twice.
    const sum = [...values.matchAll(/<c:v>([\d.]+)<\/c:v>/g)].reduce((t, m) => t + Number(m[1]), 0);
    expect(sum).toBe(datedRows.reduce((t, row) => t + row.revenue, 0));
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

describe("grouped dates and percentages", () => {
  it("writes date groups as Excel does: the finest on the column, larger levels as added fields", () => {
    const { text } = readParts(
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: datedSchema, rows: datedRows })
        .pivot("byMonth", ({ refs }) =>
          refs.table("sales").pivot({
            rows: [{ field: "orderedAt", by: ["year", "quarter", "month"] }],
            columns: ["region"],
            values: { revenue: ["sum", { aggregate: "sum", show: "percentOfColumn" }] },
          }),
        )
        .toUint8Array(),
    );

    // Orders run from 10 Jan 2024 to 13 Jul 2025.
    const cache = text("xl/pivotCache/pivotCacheDefinition1.xml");
    expect(cache).toContain('<cacheFields count="5">');
    expect(cache).toContain(
      '<cacheField name="Ordered" numFmtId="0"><sharedItems containsSemiMixedTypes="0" containsNonDate="0" containsDate="1" containsString="0" minDate="2024-01-10T09:00:00" maxDate="2025-07-13T09:00:00"/><fieldGroup par="4" base="0"><rangePr groupBy="months" startDate="2024-01-10T00:00:00" endDate="2025-07-14T00:00:00"/><groupItems count="14"><s v="&lt;1/10/2024"/><s v="Jan"/>',
    );
    expect(cache).toContain(
      '<cacheField name="Years" numFmtId="0" databaseField="0"><fieldGroup base="0"><rangePr groupBy="years" startDate="2024-01-10T00:00:00" endDate="2025-07-14T00:00:00"/><groupItems count="4"><s v="&lt;1/10/2024"/><s v="2024"/><s v="2025"/><s v="&gt;7/14/2025"/></groupItems></fieldGroup></cacheField>',
    );
    expect(cache).toContain(
      '<cacheField name="Quarters" numFmtId="0" databaseField="0"><fieldGroup par="3" base="0"><rangePr groupBy="quarters"',
    );

    const table = text("xl/pivotTables/pivotTable1.xml");
    expect(table).toContain('rowHeaderCaption="Years / Quarters / Ordered"');
    expect(table).toContain('<pivotFields count="5">');
    expect(table).toContain(
      '<rowFields count="3"><field x="3"/><field x="4"/><field x="0"/></rowFields>',
    );
    expect(table).toMatch(
      /<dataField name="Sum of Revenue \(% of column\)" fld="2" showDataAs="percentOfCol" baseField="0" baseItem="0" numFmtId="\d+"\/>/,
    );
    expect(text("xl/styles.xml")).toContain('formatCode="0.0%"');

    const sheet = text("xl/worksheets/sheet1.xml");
    for (const label of ["2024", "Qtr1", "Jan", "Sum of Revenue (% of column)"]) {
      expect(sheet).toContain(`<t>${label}</t>`);
    }
    // The pivot sits below the table. Column C holds both the table's Revenue and the pivot's
    // "Sum of Revenue (% of column)" header: it widens to fit the header.
    const columnC = /<col min="3" max="3"[^>]*width="([\d.]+)"/.exec(sheet);
    expect(Number(columnC?.[1])).toBeGreaterThanOrEqual("Sum of Revenue (% of column)".length);
  });

  it("explains what it cannot group or show", () => {
    const bad = (options: any, data: DatedSale[] = datedRows) =>
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: datedSchema, rows: data })
        .pivot("bad", ({ refs }) => refs.table("sales").pivot(options))
        .toUint8Array();

    expect(() =>
      bad({ rows: [{ field: "orderedAt", by: "year" }], values: { revenue: "sum" } }, [
        { ...datedRows[0]!, orderedAt: null as never },
      ]),
    ).toThrow(
      'Pivot "bad": "Ordered" is grouped by year, so every row needs a date, got a blank cell.',
    );
    expect(() =>
      bad({ rows: [{ field: "orderedAt", by: ["month", "year"] }], values: { revenue: "sum" } }),
    ).toThrow(
      'Pivot "bad": "orderedAt" must be grouped by "year", "quarter" or "month", or several of them from the largest, got ["month","year"].',
    );
    expect(() =>
      bad({
        rows: ["region"],
        columns: [{ field: "orderedAt", by: ["year", "month"] }],
        values: { revenue: "sum" },
      }),
    ).toThrow('Pivot "bad": a column groups "orderedAt" by one unit; only rows take several.');
    expect(() =>
      bad({ rows: ["region"], values: { revenue: { aggregate: "sum", show: "percentOfRow" } } }),
    ).toThrow('Pivot "bad": "percentOfRow" needs a column field: without one, every row is 100%.');
  });
});

const thin = (rgb: string) => ({ style: "thin" as const, color: { rgb } });
const medium = (rgb: string) => ({ style: "medium" as const, color: { rgb } });
const allSides = <T>(side: T) => ({ top: side, right: side, bottom: side, left: side });

/** The dxf of each element of a custom pivot style, by element type. */
function pivotStyleDxfs(stylesXml: string, styleName: string) {
  const dxfs = [
    .../<dxfs count="\d+">(.*?)<\/dxfs>/.exec(stylesXml)![1]!.matchAll(/<dxf>.*?<\/dxf>/g),
  ].map((match) => match[0]);
  const body = new RegExp(`<tableStyle name="${styleName}"[^>]*>(.*?)</tableStyle>`).exec(
    stylesXml,
  )![1]!;
  return Object.fromEntries(
    [...body.matchAll(/type="(\w+)" dxfId="(\d+)"/g)].map((match) => [
      match[1]!,
      dxfs[Number(match[2])]!,
    ]),
  );
}

describe("pivot themes", () => {
  it("binds pivot slots to table slots, and keeps following them when a theme is extended", () => {
    const theme = defineSpreadsheetTheme();
    expect(theme.slots.pivotHeader).toEqual({
      font: { bold: true, color: { rgb: "1E3A8A" } },
      fill: { color: { rgb: "DBEAFE" } },
    });
    expect(theme.slots.pivotBody).toEqual({ border: theme.slots.cellBase.border });
    expect(theme.slots.pivotTotal).toEqual({
      font: theme.slots.summary.font,
      fill: theme.slots.summary.fill,
      border: theme.slots.summary.border,
    });
    expect(theme.slots.pivotStripe).toEqual({ fill: { color: { rgb: "F1F5F9" } } });

    // An override sits on top of the binding, which still follows the table slot.
    const branded = theme
      .extend({ slots: { pivotHeader: { font: { italic: true } } } })
      .extend({ slots: { header: { fill: { color: { rgb: "0B1220" } } } } });
    expect(branded.slots.pivotHeader).toEqual({
      font: { bold: true, italic: true, color: { rgb: "1E3A8A" } },
      fill: { color: { rgb: "0B1220" } },
    });

    // What a pivot style cannot use is dropped, also from untyped input.
    const loose = theme.extend({
      slots: {
        pivotHeader: { border: allSides(thin("000000")) } as never,
        pivotTotal: { numFmt: "0.0", alignment: { horizontal: "left" } } as never,
      },
    });
    expect(loose.slots.pivotHeader).toEqual(theme.slots.pivotHeader);
    expect(loose.slots.pivotTotal).toEqual(theme.slots.pivotTotal);
  });

  it("follows the source table's theme, and fills the whole pivot before Excel refreshes it", () => {
    const themed = createExcelSchema<Sale>()
      .theme(spreadsheetThemes.slate)
      .column("region", { header: "Region", accessor: "region" })
      .column("month", { header: "Month", accessor: "month" })
      .column("revenue", { header: "Revenue", accessor: "revenue" })
      .build();
    const { text } = readParts(
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: themed, rows })
        .pivot("byRegion", ({ refs }) =>
          refs.table("sales").pivot({
            rows: ["region"],
            columns: ["month"],
            values: { revenue: "sum" },
            at: "A10",
          }),
        )
        .toUint8Array(),
    );

    const styles = text("xl/styles.xml");
    const table = text("xl/pivotTables/pivotTable1.xml");
    expect(table).toContain(
      '<pivotTableStyleInfo name="typed-xlsx Pivot 1" showRowHeaders="1" showColHeaders="1" showRowStripes="0" showColStripes="0" showLastColumn="1"/>',
    );
    const elements = pivotStyleDxfs(styles, "typed-xlsx Pivot 1");
    expect(elements.headerRow).toContain('<fgColor rgb="FF0B1220"/><bgColor rgb="FF0B1220"/>');
    expect(elements.headerRow).not.toContain("<border>");
    expect(elements.wholeTable).toContain(
      '<vertical style="thin"><color rgb="FF000000"/></vertical>',
    );
    expect(elements.totalRow).toContain('<fgColor rgb="FFE0E7FF"/>');

    // Header rows A10:D11, three regions, the grand total: every cell of A10:D15 is written.
    const sheet = text("xl/worksheets/sheet1.xml");
    for (const column of ["A", "B", "C", "D"]) {
      for (let row = 10; row <= 15; row += 1) expect(sheet).toContain(`<c r="${column}${row}"`);
    }
  });

  it("lets a built-in style or another theme replace the table's, and bands rows", () => {
    const pivotStyle = (options: Record<string, unknown>, schema = salesSchema) => {
      const { text } = readParts(
        createWorkbook()
          .sheet("Sales")
          .table("sales", { schema, rows, theme: spreadsheetThemes.slate })
          .pivot("p", ({ refs }) =>
            refs
              .table("sales")
              .pivot({ rows: ["region"], values: { revenue: "sum" }, ...options } as never),
          )
          .toUint8Array(),
      );
      return {
        info: /<pivotTableStyleInfo[^>]*>/.exec(text("xl/pivotTables/pivotTable1.xml"))![0],
        styles: text("xl/styles.xml"),
      };
    };

    const builtIn = pivotStyle({ style: "PivotStyleMedium9", banded: true });
    expect(builtIn.info).toContain('name="PivotStyleMedium9"');
    expect(builtIn.info).toContain('showRowStripes="1"');
    expect(builtIn.styles).not.toContain("<tableStyles");

    const forest = pivotStyle({ theme: spreadsheetThemes.forest, banded: { columns: true } });
    expect(forest.info).toContain('name="typed-xlsx Pivot 1"');
    expect(forest.info).toContain('showRowStripes="0" showColStripes="1"');
    // Without a column field the last column holds values, so it is not styled as a total.
    expect(forest.info).toContain('showLastColumn="0"');
    expect(pivotStyleDxfs(forest.styles, "typed-xlsx Pivot 1").headerRow).toContain("FFDCFCE7");

    expect(() =>
      pivotStyle({ style: "PivotStyleMedium9", theme: spreadsheetThemes.forest }),
    ).toThrow('Pivot "p": takes a built-in style or a theme, not both.');
  });

  it("keeps Excel's default style for tables without a theme", () => {
    const { text } = readParts(
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: salesSchema, rows })
        .pivot("p", ({ refs }) =>
          refs.table("sales").pivot({ rows: ["region"], values: { revenue: "sum" } }),
        )
        .toUint8Array(),
    );
    expect(text("xl/pivotTables/pivotTable1.xml")).toContain('name="PivotStyleLight16"');
    expect(text("xl/styles.xml")).not.toContain("<tableStyles");
  });

  it("draws the frame along every edge, totals included", () => {
    const framed = spreadsheetThemes.slate.extend({
      slots: {
        pivotFrame: { border: allSides(medium("0B1220")) },
        pivotBody: { border: allSides(thin("CBD5E1")) },
      },
    });
    const { text } = readParts(
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: salesSchema, rows })
        .pivot("p", ({ refs }) =>
          refs.table("sales").pivot({
            rows: ["region"],
            columns: ["month"],
            values: { revenue: "sum" },
            theme: framed,
          }),
        )
        .toUint8Array(),
    );
    const elements = pivotStyleDxfs(text("xl/styles.xml"), "typed-xlsx Pivot 1");
    expect(elements.wholeTable).toBe(
      '<dxf><border><left style="medium"><color rgb="FF0B1220"/></left><right style="medium"><color rgb="FF0B1220"/></right><top style="medium"><color rgb="FF0B1220"/></top><bottom style="medium"><color rgb="FF0B1220"/></bottom><diagonal/><vertical style="thin"><color rgb="FFCBD5E1"/></vertical><horizontal style="thin"><color rgb="FFCBD5E1"/></horizontal></border></dxf>',
    );
    // The totals keep their own lines inside, and the frame along the pivot's edges.
    expect(elements.totalRow).toContain('<bottom style="medium"><color rgb="FF0B1220"/></bottom>');
    expect(elements.totalRow).toContain('<top style="thin"><color rgb="FF000000"/></top>');
    expect(elements.lastColumn).toContain('<right style="medium"><color rgb="FF0B1220"/></right>');
  });

  it("styles pivots of streamed tables with their theme", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const sales = await workbook
      .sheet("Sales")
      .table("sales", { schema: salesSchema, theme: spreadsheetThemes.rose });
    workbook
      .sheet("Analysis")
      .pivot(
        "byRegion",
        sales.pivot({ rows: ["region"], values: { revenue: "sum" }, banded: true }),
      );
    await sales.commit({ rows });

    const { text } = readParts(await streamBytes(workbook));
    expect(text("xl/pivotTables/pivotTable1.xml")).toContain(
      'name="typed-xlsx Pivot 1" showRowHeaders="1" showColHeaders="1" showRowStripes="1"',
    );
    expect(pivotStyleDxfs(text("xl/styles.xml"), "typed-xlsx Pivot 1").headerRow).toContain(
      "FF7F1D1D",
    );
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

  it("groups streamed dates over the range of every committed batch", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const sales = await workbook.sheet("Sales").table("sales", { schema: datedSchema });
    workbook.sheet("Analysis").pivot(
      "byYear",
      sales.pivot({
        rows: [{ field: "orderedAt", by: ["year", "month"] }],
        values: { revenue: { aggregate: "sum", show: "percentOfTotal" } },
      }),
    );
    await sales.commit({ rows: datedRows.slice(0, 2) });
    await sales.commit({ rows: datedRows.slice(2) });

    const { text } = readParts(await streamBytes(workbook));
    const cache = text("xl/pivotCache/pivotCacheDefinition1.xml");
    expect(cache).toContain('minDate="2024-01-10T09:00:00" maxDate="2025-07-13T09:00:00"');
    expect(cache).toContain('<s v="2024"/><s v="2025"/>');
    const sheet = text("xl/worksheets/sheet2.xml");
    // 2024 holds Nord 10 + Nord 30 + Sud 50 of 150.
    expect(sheet).toMatch(/<t>2024<\/t><\/is><\/c><c r="B\d+"[^>]*><v>0\.6<\/v>/);
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

describe("pivots that Excel would repair", () => {
  const place = (build: (book: any) => any) =>
    readParts(
      build(
        createWorkbook().sheet("Sales").table("sales", { schema: salesSchema, rows }),
      ).toUint8Array(),
    );

  it("places an automatic pivot below one placed with at", () => {
    const { text } = place((book) =>
      book
        .sheet("Analysis")
        .pivot("first", ({ refs }: any) =>
          refs
            .sheet("Sales")
            .table("sales")
            .pivot({ rows: ["region"], values: { revenue: "sum" }, at: "A3" }),
        )
        .pivot("second", ({ refs }: any) =>
          refs.sheet("Sales").table("sales").pivot({ rows: ["product"], values: { orders: "sum" } }),
        ),
    );
    const top = (xml: string) => Number(/<location ref="[A-Z]+(\d+):/.exec(xml)![1]);
    const bottom = (xml: string) => Number(/<location ref="[A-Z]+\d+:[A-Z]+(\d+)"/.exec(xml)![1]);
    expect(top(text("xl/pivotTables/pivotTable2.xml"))).toBeGreaterThan(
      bottom(text("xl/pivotTables/pivotTable1.xml")),
    );
  });

  it("rejects a pivot placed over a table or another pivot", () => {
    expect(() =>
      place((book) =>
        book.pivot("onTop", ({ refs }: any) =>
          refs.table("sales").pivot({ rows: ["region"], values: { revenue: "sum" }, at: "A1" }),
        ),
      ),
    ).toThrow('Pivot "onTop": at "A1" overlaps a table.');
    expect(() =>
      place((book) =>
        book
          .sheet("Analysis")
          .pivot("a", ({ refs }: any) =>
            refs
              .sheet("Sales")
              .table("sales")
              .pivot({ rows: ["region"], values: { revenue: "sum" }, at: "B2" }),
          )
          .pivot("b", ({ refs }: any) =>
            refs
              .sheet("Sales")
              .table("sales")
              .pivot({ rows: ["region"], values: { revenue: "sum" }, at: "C3" }),
          ),
      ),
    ).toThrow('overlaps pivot "a"');
  });

  it("rejects cells outside the sheet", () => {
    expect(() =>
      place((book) =>
        book.sheet("Analysis").pivot("p", ({ refs }: any) =>
          refs
            .sheet("Sales")
            .table("sales")
            .pivot({ rows: ["region"], values: { revenue: "sum" }, at: "A0" }),
        ),
      ),
    ).toThrow('"at" must be a cell inside the sheet');
    expect(() =>
      place((book) =>
        book.sheet("Analysis").pivot("p", ({ refs }: any) =>
          refs
            .sheet("Sales")
            .table("sales")
            .pivot({ rows: ["region"], values: { revenue: "sum" }, at: "A1048576" }),
        ),
      ),
    ).toThrow("runs past the end of the sheet");
    expect(() =>
      place((book) =>
        book.chart("c", ({ refs }: any) => ({
          at: "A0",
          marks: [refs.table("sales").bar({ x: "region", y: "revenue" })],
        })),
      ),
    ).toThrow('"at" must be a cell inside the sheet');
  });

  it("names cache fields uniquely when headers repeat", () => {
    type Row = { a: string; b: string; c: string; n: number };
    const schema = createExcelSchema<Row>()
      .column("a", { header: "Foo", accessor: "a" })
      .column("b", { header: "Foo", accessor: "b" })
      .column("c", { header: "Foo2", accessor: "c" })
      .column("n", { header: "N", accessor: "n" })
      .build();
    const { text } = readParts(
      createWorkbook()
        .sheet("Data")
        .table("t", { schema, rows: [{ a: "x", b: "y", c: "z", n: 1 }] })
        .pivot("p", ({ refs }) => refs.table("t").pivot({ rows: ["a"], values: { n: "sum" } }))
        .toUint8Array(),
    );
    const names = [
      ...text("xl/pivotCache/pivotCacheDefinition1.xml").matchAll(/<cacheField name="([^"]*)"/g),
    ].map((m) => m[1]);
    expect(new Set(names.map((name) => name!.toLowerCase())).size).toBe(names.length);
  });

  it("counts dates a millisecond apart as one item, as the cache writes whole seconds", () => {
    type Row = { at: Date; n: number };
    const schema = createExcelSchema<Row>()
      .column("at", { header: "At", accessor: "at" })
      .column("n", { header: "N", accessor: "n" })
      .build();
    const { text } = readParts(
      createWorkbook()
        .sheet("Data")
        .table("t", {
          schema,
          rows: [
            { at: new Date(Date.UTC(2026, 0, 1, 9, 0, 0, 1)), n: 1 },
            { at: new Date(Date.UTC(2026, 0, 1, 9, 0, 0, 2)), n: 2 },
          ],
        })
        .pivot("p", ({ refs }) => refs.table("t").pivot({ rows: ["at"], values: { n: "sum" } }))
        .toUint8Array(),
    );
    const cache = text("xl/pivotCache/pivotCacheDefinition1.xml");
    expect(cache.match(/<d v="2026-01-01T09:00:00"\/>/g)).toHaveLength(1);
  });

  it("caps pivot charts at Excel's 255 series", () => {
    type Row = { region: string; code: string; n: number };
    const schema = createExcelSchema<Row>()
      .column("region", { header: "Region", accessor: "region" })
      .column("code", { header: "Code", accessor: "code" })
      .column("n", { header: "N", accessor: "n" })
      .build();
    const data = Array.from({ length: 256 }, (_, i) => ({ region: "A", code: `c${i}`, n: i }));
    expect(() =>
      createWorkbook()
        .sheet("Data")
        .table("t", { schema, rows: data })
        .pivot("p", ({ refs }) =>
          refs.table("t").pivot({ rows: ["region"], columns: ["code"], values: { n: "sum" } }),
        )
        .chart("c", ({ refs }) => ({ marks: [refs.pivot("p").bar()] }))
        .toUint8Array(),
    ).toThrow("a chart holds at most 255 series");
  });

  it("writes the range of many distinct numbers without overflowing the stack", () => {
    type Row = { region: string; id: number; n: number };
    const schema = createExcelSchema<Row>()
      .column("region", { header: "Region", accessor: "region" })
      .column("id", { header: "Id", accessor: "id" })
      .column("n", { header: "N", accessor: "n" })
      .build();
    const data = Array.from({ length: 150_000 }, (_, i) => ({ region: "A", id: i, n: 1 }));
    const { text } = readParts(
      createWorkbook()
        .sheet("Data")
        .table("t", { schema, rows: data })
        .pivot("p", ({ refs }) =>
          refs.table("t").pivot({ rows: ["region"], filters: ["id"], values: { n: "sum" } }),
        )
        .toUint8Array(),
    );
    expect(text("xl/pivotCache/pivotCacheDefinition1.xml")).toContain('maxValue="149999"');
  });
});

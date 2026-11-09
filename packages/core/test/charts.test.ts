import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createExcelSchema, createWorkbook, createWorkbookStream } from "../src";

type MonthRow = { month: string; revenue: number; cost: number };
type TargetRow = { month: string; target: number };
type TerritoryRow = { territory: string; byMonth: Record<string, number> };
type DealRow = { discount: number; winRate: number };

const monthlySchema = createExcelSchema<MonthRow>()
  .column("month", { header: "Month", accessor: "month", summary: (s) => [s.label("Total")] })
  .column("revenue", { header: "Revenue", accessor: "revenue", summary: (s) => [s.formula("sum")] })
  .column("cost", { header: "Cost", accessor: "cost" })
  .column("margin", {
    header: "Margin",
    formula: ({ refs }) => refs.column("revenue").sub(refs.column("cost")),
  })
  .build();

const targetSchema = createExcelSchema<TargetRow>()
  .column("month", { header: "Month", accessor: "month" })
  .column("target", { header: "Target", accessor: "target" })
  .build();

const territorySchema = createExcelSchema<TerritoryRow, { months: string[] }>()
  .column("territory", { header: "Territory", accessor: "territory" })
  .dynamic("months", (builder, { ctx }) => {
    for (const month of ctx.months) {
      builder.column(month, { header: month, accessor: (row) => row.byMonth[month] ?? 0 });
    }
  })
  .build();

const dealSchema = createExcelSchema<DealRow>()
  .column("discount", { header: "Discount", accessor: "discount" })
  .column("winRate", { header: "Win rate", accessor: "winRate" })
  .build();

const months = ["Jan", "Feb", "Mar"];
const rows = months.map((month, i) => ({ month, revenue: 100 + i, cost: 50 + i }));
const lastYear = months.map((month, i) => ({ month, revenue: 90 + i, cost: 45 + i }));
const targets = months.map((month, i) => ({ month, target: 110 + i }));
const territories = [
  { territory: "Nord", byMonth: { Jan: 1, Feb: 2, Mar: 3 } },
  { territory: "Sud", byMonth: { Jan: 4, Feb: 5, Mar: 6 } },
];

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

function formulas(xml: string) {
  return [...xml.matchAll(/<c:f>([^<]*)<\/c:f>/g)].map((match) =>
    match[1]!.replaceAll("&apos;", "'"),
  );
}

describe("workbook charts", () => {
  it("plots marks of several tables and sheets over the right ranges", () => {
    const bytes = createWorkbook()
      .sheet("2026")
      .table("sales", { schema: monthlySchema, rows, title: "Sales 2026" })
      .table("targets", { schema: targetSchema, rows: targets })
      .chart("performance", ({ refs }) => ({
        title: "Revenue vs target",
        marks: [
          refs.table("sales").bar({ x: "month", y: "revenue" }),
          refs.table("targets").line({ x: "month", y: "target", name: "Goal" }),
        ],
      }))
      .sheet("2025")
      .table("sales", { schema: monthlySchema, rows: lastYear })
      .sheet("Dashboard")
      .chart("yearOverYear", ({ refs }) => ({
        at: "B2",
        marks: [
          refs.sheet("2026").table("sales").bar({ x: "month", y: "revenue", name: "2026" }),
          refs.sheet("2025").table("sales").bar({ x: "month", y: "revenue", name: "2025" }),
        ],
      }))
      .toUint8Array();

    const { paths, text } = readParts(bytes);
    expect(paths).toEqual(expect.arrayContaining(["xl/charts/chart1.xml", "xl/charts/chart2.xml"]));
    expect(text("[Content_Types].xml")).toContain(
      'PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"',
    );

    // Title row 1, header row 2, body rows 3-5; the Total row 6 is left out.
    // The revenue series is named by its header cell; the target series by the given name.
    const performance = text("xl/charts/chart1.xml");
    expect(formulas(performance)).toEqual([
      "'2026'!$B$2",
      "'2026'!$A$3:$A$5",
      "'2026'!$B$3:$B$5",
      "'2026'!$A$9:$A$11",
      "'2026'!$B$9:$B$11",
    ]);
    expect(performance).toContain("<c:barChart>");
    expect(performance).toContain("<c:lineChart>");
    expect(performance).toContain("<c:v>Goal</c:v>");
    expect(performance).toContain("<a:t>Revenue vs target</a:t>");
    expect(performance).toContain('<c:legendPos val="b"/>');

    expect(formulas(text("xl/charts/chart2.xml"))).toEqual([
      "'2026'!$A$3:$A$5",
      "'2026'!$B$3:$B$5",
      "'2025'!$A$2:$A$4",
      "'2025'!$B$2:$B$4",
    ]);
    expect(text("xl/drawings/_rels/drawing2.xml.rels")).toContain('Target="../charts/chart2.xml"');
    expect(text("xl/worksheets/_rels/sheet3.xml.rels")).toContain("../drawings/drawing2.xml");
  });

  it("caches values and leaves formula cells for Excel to compute", () => {
    const xml = readParts(
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: monthlySchema, rows })
        .chart("margin", ({ refs }) => ({
          marks: [refs.table("sales").line({ x: "month", y: ["revenue", "margin"] })],
        }))
        .toUint8Array(),
    ).text("xl/charts/chart1.xml");

    expect(xml).toContain('<c:pt idx="0"><c:v>Jan</c:v></c:pt>');
    expect(xml).toContain('<c:pt idx="2"><c:v>102</c:v></c:pt>');
    // The margin column holds formulas, so its cache keeps the count but no points.
    expect(xml).toMatch(
      /\$D\$2:\$D\$4<\/c:f><c:numCache><c:formatCode>General<\/c:formatCode><c:ptCount val="3"\/><\/c:numCache>/,
    );
  });

  it("puts marks on a secondary axis", () => {
    const xml = readParts(
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: monthlySchema, rows })
        .chart("combo", ({ refs }) => ({
          marks: [
            refs.table("sales").bar({ x: "month", y: "revenue" }),
            refs.table("sales").line({ x: "month", y: "cost", axis: "y2" }),
          ],
          axes: { y: { title: "EUR", min: 0 }, y2: { format: "0%" } },
        }))
        .toUint8Array(),
    ).text("xl/charts/chart1.xml");

    expect(xml.match(/<c:valAx>/g)).toHaveLength(2);
    expect(xml).toContain('<c:axPos val="r"/>');
    expect(xml).toContain('<c:crosses val="max"/>');
    expect(xml).toContain('<c:min val="0"/>');
    expect(xml).toContain('<c:numFmt formatCode="0%" sourceLinked="0"/>');
    expect(xml).toMatch(
      /<c:lineChart>.*<c:axId val="500000003"\/><c:axId val="500000004"\/><\/c:lineChart>/,
    );
  });

  it("writes pies, stacks, horizontal bars and scatter plots", () => {
    const { text } = readParts(
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: monthlySchema, rows })
        .table("deals", { schema: dealSchema, rows: [{ discount: 0.1, winRate: 0.4 }] })
        .chart("pie", ({ refs }) => ({
          marks: [
            refs
              .table("sales")
              .pie({ label: "month", value: "revenue", labels: { percent: true } }),
          ],
          colors: ["#2563EB", "10B981", "#f59e0b"],
        }))
        .chart("stack", ({ refs }) => ({
          marks: [
            refs.table("sales").bar({ x: "month", y: ["revenue", "cost"], stack: "percent" }),
          ],
        }))
        .chart("ranked", ({ refs }) => ({
          marks: [refs.table("sales").bar({ x: "month", y: "revenue", horizontal: true })],
        }))
        .chart("scatter", ({ refs }) => ({
          marks: [refs.table("deals").scatter({ x: "discount", y: "winRate" })],
        }))
        .toUint8Array(),
    );

    const pie = text("xl/charts/chart1.xml");
    expect(pie).toContain("<c:pieChart>");
    expect(pie.match(/<c:dPt>/g)).toHaveLength(3);
    expect(pie).toContain('<a:srgbClr val="F59E0B"/>');
    expect(pie).toContain('<c:showPercent val="1"/>');
    expect(pie).not.toContain("<c:valAx>");

    const stack = text("xl/charts/chart2.xml");
    expect(stack).toContain('<c:grouping val="percentStacked"/>');
    expect(stack).toContain('<c:overlap val="100"/>');

    const ranked = text("xl/charts/chart3.xml");
    expect(ranked).toContain('<c:barDir val="bar"/>');
    expect(ranked).toContain('<c:orientation val="maxMin"/>');
    expect(ranked).toContain('<c:crosses val="max"/>');
    expect(ranked).not.toContain("<c:legend>");

    const scatter = text("xl/charts/chart4.xml");
    expect(scatter).toContain("<c:scatterChart>");
    expect(scatter).toContain("<c:xVal>");
    expect(scatter.match(/<c:valAx>/g)).toHaveLength(2);
  });

  it("plots dynamic columns as series or rows as series", () => {
    const { text } = readParts(
      createWorkbook()
        .sheet("Territories")
        .table("territories", { schema: territorySchema, rows: territories, context: { months } })
        .chart("rows", ({ refs }) => ({
          marks: [
            refs.table("territories").line({ x: { dynamic: "months" }, series: "territory" }),
          ],
        }))
        .chart("columns", ({ refs }) => ({
          marks: [refs.table("territories").bar({ x: "territory", y: { dynamic: "months" } })],
        }))
        .toUint8Array(),
    );

    // One series per row, named by its territory cell, over the month headers.
    expect(formulas(text("xl/charts/chart1.xml"))).toEqual([
      "'Territories'!$A$2",
      "'Territories'!$B$1:$D$1",
      "'Territories'!$B$2:$D$2",
      "'Territories'!$A$3",
      "'Territories'!$B$1:$D$1",
      "'Territories'!$B$3:$D$3",
    ]);
    // One series per generated column.
    expect(formulas(text("xl/charts/chart2.xml"))).toHaveLength(9);
    expect(formulas(text("xl/charts/chart2.xml"))[0]).toBe("'Territories'!$B$1");
  });

  it("anchors charts beside the tables, sized in pixels", () => {
    const { text } = readParts(
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: monthlySchema, rows })
        .chart("first", ({ refs }) => ({
          marks: [refs.table("sales").line({ x: "month", y: "revenue" })],
        }))
        .chart("second", ({ refs }) => ({
          size: { width: 400, height: 200 },
          marks: [refs.table("sales").line({ x: "month", y: "cost" })],
        }))
        .toUint8Array(),
    );

    const drawing = text("xl/drawings/drawing1.xml");
    // Four columns (A-D), one blank column, first chart from F2; the second stacks below it.
    expect(drawing).toContain(
      "<xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row>",
    );
    expect(drawing).toContain(`<xdr:ext cx="${600 * 9525}" cy="${320 * 9525}"/>`);
    expect(drawing).toContain("<xdr:row>18</xdr:row>");
    expect(drawing).toContain(`<xdr:ext cx="${400 * 9525}" cy="${200 * 9525}"/>`);
  });

  it("writes an empty chart for a table without rows", () => {
    const xml = readParts(
      createWorkbook()
        .sheet("Sales")
        .table("sales", { schema: monthlySchema, rows: [] })
        .chart("empty", ({ refs }) => ({
          marks: [refs.table("sales").bar({ x: "month", y: "revenue" })],
        }))
        .toUint8Array(),
    ).text("xl/charts/chart1.xml");

    expect(xml).toContain('<c:strLit><c:ptCount val="0"/></c:strLit>');
    expect(xml).toContain("<c:numLit>");
  });

  it("refuses marks whose rows do not line up", () => {
    const workbook = createWorkbook()
      .sheet("2026")
      .table("sales", { schema: monthlySchema, rows })
      .table("targets", { schema: targetSchema, rows: [targets[0]!, targets[2]!, targets[1]!] })
      .chart("performance", ({ refs }) => ({
        marks: [
          refs.table("sales").bar({ x: "month", y: "revenue" }),
          refs.table("targets").line({ x: "month", y: "target" }),
        ],
      }));

    expect(() => workbook.toUint8Array()).toThrow(
      'Chart "performance": "2026/targets" row 2 is "Mar" but "2026/sales" row 2 is "Feb". Marks line up row by row on their x column.',
    );
  });

  it("checks what the types cannot see", () => {
    const groupedSchema = createExcelSchema<MonthRow>()
      .column("month", { accessor: "month" })
      .group("money", (group) =>
        group.column("revenue", { accessor: "revenue" }).column("cost", { accessor: "cost" }),
      )
      .build();
    const excludedByGroup = createWorkbook()
      .sheet("Sales")
      .table("sales", { schema: groupedSchema, rows, select: { exclude: ["money"] } })
      .chart("trend", ({ refs }) => ({
        marks: [refs.table("sales").line({ x: "month", y: "revenue" })],
      }));
    expect(() => excludedByGroup.toUint8Array()).toThrow(
      'Chart "trend": column "revenue" is not rendered in table "Sales/sales".',
    );

    const badColor = createWorkbook()
      .sheet("Sales")
      .table("sales", { schema: monthlySchema, rows })
      .chart("trend", ({ refs }) => ({
        marks: [refs.table("sales").line({ x: "month", y: "revenue", color: "red" })],
      }));
    expect(() => badColor.toUint8Array()).toThrow(
      'Chart "trend": color "red" must be a hex color such as "#2563EB".',
    );

    const untyped = createWorkbook()
      .sheet("Sales")
      .table("sales", { schema: monthlySchema, rows })
      .chart("mixed", ({ refs }) => ({
        marks: [
          refs.table("sales").pie({ label: "month", value: "revenue" }),
          refs.table("sales").bar({ x: "month", y: "revenue" }),
        ] as never,
      }));
    expect(() => untyped.toUint8Array()).toThrow(
      'Chart "mixed": a pie or doughnut chart takes a single mark.',
    );
  });
});

describe("streamed workbook charts", () => {
  it("plots marks of streamed tables across sheets", async () => {
    const workbook = createWorkbookStream({ tempStorage: "memory" });
    const sales = await workbook
      .sheet("Sales")
      .table("sales", { schema: monthlySchema, title: "Sales" });
    const goals = await workbook.sheet("Goals").table("targets", { schema: targetSchema });
    await sales.commit({ rows });
    await goals.commit({ rows: targets });

    workbook.sheet("Dashboard").chart("performance", {
      title: "Revenue vs target",
      marks: [sales.bar({ x: "month", y: "revenue" }), goals.line({ x: "month", y: "target" })],
    });

    const { paths, text } = readParts(await streamBytes(workbook));

    expect(paths).toEqual(
      expect.arrayContaining(["xl/charts/chart1.xml", "xl/drawings/drawing1.xml"]),
    );
    expect(text("[Content_Types].xml")).toContain('PartName="/xl/charts/chart1.xml"');
    expect(formulas(text("xl/charts/chart1.xml"))).toEqual([
      "'Sales'!$B$2",
      "'Sales'!$A$3:$A$5",
      "'Sales'!$B$3:$B$5",
      "'Goals'!$B$1",
      "'Goals'!$A$2:$A$4",
      "'Goals'!$B$2:$B$4",
    ]);
    expect(text("xl/worksheets/sheet3.xml")).toContain('<drawing r:id="rIdDrawing1"/>');
  });
});

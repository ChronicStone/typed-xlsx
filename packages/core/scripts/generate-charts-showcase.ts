import { createExcelSchema, createWorkbook } from "../src";

type MonthRow = { month: string; revenue: number; cost: number; orders: number };
type TargetRow = { month: string; target: number };
type RegionRow = { region: string; revenue: number };
type TerritoryRow = { territory: string; revenueByMonth: Record<string, number> };
type DealRow = { deal: string; discount: number; winRate: number };
type ReportCtx = { months: string[] };

const money = { numFmt: "#,##0" };
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

const monthlySchema = createExcelSchema<MonthRow>()
  .column("month", { header: "Month", accessor: "month", summary: (s) => [s.label("Total")] })
  .column("revenue", {
    header: "Revenue",
    accessor: "revenue",
    style: money,
    summary: (s) => [s.formula("sum")],
  })
  .column("cost", { header: "Cost", accessor: "cost", style: money })
  .column("margin", {
    header: "Margin",
    formula: ({ refs }) => refs.column("revenue").sub(refs.column("cost")),
    style: money,
  })
  .column("marginRate", {
    header: "Margin %",
    formula: ({ refs, fx }) => fx.safeDiv(refs.column("margin"), refs.column("revenue"), 0),
    style: { numFmt: "0.0%" },
  })
  .build();

const targetSchema = createExcelSchema<TargetRow>()
  .column("month", { header: "Month", accessor: "month" })
  .column("target", { header: "Target", accessor: "target", style: money })
  .build();

const regionSchema = createExcelSchema<RegionRow>()
  .column("region", { header: "Region", accessor: "region" })
  .column("revenue", { header: "Revenue", accessor: "revenue", style: money })
  .build();

const territorySchema = createExcelSchema<TerritoryRow, ReportCtx>()
  .column("territory", { header: "Territory", accessor: "territory" })
  .dynamic("months", (builder, { ctx }) => {
    for (const month of ctx.months) {
      builder.column(month, {
        header: month,
        accessor: (row) => row.revenueByMonth[month] ?? 0,
        style: money,
      });
    }
  })
  .build();

const dealSchema = createExcelSchema<DealRow>()
  .column("deal", { header: "Deal", accessor: "deal" })
  .column("discount", { header: "Discount", accessor: "discount", style: { numFmt: "0%" } })
  .column("winRate", { header: "Win rate", accessor: "winRate", style: { numFmt: "0%" } })
  .build();

const pick = (values: number[]) => (index: number) => values[index]!;
const revenue = pick([182000, 195000, 210000, 204000, 231000, 248000]);
const cost = pick([121000, 128000, 133000, 131000, 142000, 150000]);
const lastRevenue = pick([161000, 170000, 176000, 181000, 190000, 204000]);
const lastCost = pick([112000, 118000, 120000, 123000, 128000, 135000]);
const targetOf = pick([180000, 190000, 200000, 215000, 225000, 240000]);

const rows = months.map((month, i) => ({
  month,
  revenue: revenue(i),
  cost: cost(i),
  orders: 1200 + i * 70,
}));
const lastYearRows = months.map((month, i) => ({
  month,
  revenue: lastRevenue(i),
  cost: lastCost(i),
  orders: 1100 + i * 50,
}));
const targetRows = months.map((month, i) => ({ month, target: targetOf(i) }));
const regionRows: RegionRow[] = [
  { region: "Île-de-France", revenue: 412000 },
  { region: "Auvergne-Rhône-Alpes", revenue: 298000 },
  { region: "Occitanie", revenue: 201000 },
  { region: "Hauts-de-France", revenue: 187000 },
  { region: "Other", revenue: 172000 },
];
const territoryRows: TerritoryRow[] = [
  ["Paris Nord", [38, 41, 44, 43, 49, 52]],
  ["Paris Sud", [31, 33, 35, 34, 38, 41]],
  ["Lyon", [27, 29, 33, 31, 36, 39]],
  ["Toulouse", [18, 19, 22, 24, 27, 30]],
].map(([territory, values]) => ({
  territory: territory as string,
  revenueByMonth: Object.fromEntries(months.map((m, i) => [m, (values as number[])[i]! * 1000])),
}));
const dealRows: DealRow[] = Array.from({ length: 24 }, (_, i) => {
  const discount = 0.02 + (i % 12) * 0.02;
  return {
    deal: `D-${100 + i}`,
    discount,
    winRate: Math.min(0.92, 0.25 + discount * 2.1 + ((i * 7) % 5) / 40),
  };
});

const output = process.argv[2] ?? "./charts.xlsx";

await createWorkbook()
  .sheet("2026")
  .table("sales", { schema: monthlySchema, rows, title: "Sales 2026" })
  .table("targets", { schema: targetSchema, rows: targetRows })
  .chart("performance", ({ refs }) => ({
    title: "Revenue, target and margin",
    marks: [
      refs.table("sales").bar({ x: "month", y: "revenue", name: "Revenue", color: "#2563EB" }),
      refs.table("targets").line({
        x: "month",
        y: "target",
        name: "Target",
        color: "#94A3B8",
        dashed: true,
        markers: false,
      }),
      refs
        .table("sales")
        .line({ x: "month", y: "marginRate", name: "Margin %", color: "#F59E0B", axis: "y2" }),
    ],
    axes: { y: { title: "EUR", min: 0 }, y2: { title: "Margin", format: "0%" } },
  }))
  .sheet("2025")
  .table("sales", { schema: monthlySchema, rows: lastYearRows })
  .sheet("Regions")
  .table("regions", { schema: regionSchema, rows: regionRows })
  .chart("share", ({ refs }) => ({
    title: "Revenue by region",
    marks: [
      refs.table("regions").pie({ label: "region", value: "revenue", labels: { percent: true } }),
    ],
    colors: ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#94A3B8"],
  }))
  .chart("shareDoughnut", ({ refs }) => ({
    title: "Revenue by region (doughnut)",
    marks: [refs.table("regions").doughnut({ label: "region", value: "revenue", hole: 60 })],
  }))
  .sheet("Territories")
  .table("territories", { schema: territorySchema, rows: territoryRows, context: { months } })
  .chart("trend", ({ refs }) => ({
    title: "Revenue per territory",
    marks: [
      refs
        .table("territories")
        .line({ x: { dynamic: "months" }, series: "territory", smooth: true }),
    ],
  }))
  .chart("mix", ({ refs }) => ({
    title: "Monthly mix per territory",
    marks: [
      refs.table("territories").bar({ x: "territory", y: { dynamic: "months" }, stack: true }),
    ],
  }))
  .sheet("Deals")
  .table("deals", { schema: dealSchema, rows: dealRows })
  .chart("discounts", ({ refs }) => ({
    title: "Discount vs win rate",
    marks: [refs.table("deals").scatter({ x: "discount", y: "winRate", name: "Deals" })],
    axes: { x: { title: "Discount", format: "0%" }, y: { title: "Win rate", format: "0%" } },
  }))
  .sheet("Dashboard")
  .chart("yearOverYear", ({ refs }) => ({
    title: "Revenue 2026 vs 2025",
    at: "B2",
    marks: [
      refs.sheet("2026").table("sales").bar({ x: "month", y: "revenue", name: "2026" }),
      refs.sheet("2025").table("sales").bar({ x: "month", y: "revenue", name: "2025" }),
    ],
  }))
  .chart("costMargin", ({ refs }) => ({
    title: "Cost and margin (stacked)",
    at: "L2",
    marks: [
      refs
        .sheet("2026")
        .table("sales")
        .area({ x: "month", y: ["cost", "margin"], stack: true }),
    ],
    colors: ["#94A3B8", "#10B981"],
  }))
  .chart("regionsRanked", ({ refs }) => ({
    title: "Regions",
    at: "B20",
    marks: [
      refs
        .sheet("Regions")
        .table("regions")
        .bar({ x: "region", y: "revenue", horizontal: true, labels: { format: "#,##0" } }),
    ],
  }))
  .writeToFile(output);

console.log(`wrote ${output}`);

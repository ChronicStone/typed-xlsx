# Recipes

Complete reports to adapt. Each one compiles as written.

## Contents

- [Orders with line items](#orders-with-line-items)
- [Sales dashboard: data, KPIs, chart, pivot](#sales-dashboard-data-kpis-chart-pivot)
- [Editable planning sheet](#editable-planning-sheet)
- [Monthly matrix with totals and trends](#monthly-matrix-with-totals-and-trends)
- [Translated, role-based, streamed export](#translated-role-based-streamed-export)

## Orders with line items

One block per order, its lines under it, a line total per line, an order total once per order, grand totals at the bottom.

```ts
import { createExcelSchema, createWorkbook, spreadsheetThemes } from "typed-xlsx";

type Order = {
  number: string;
  customer: { name: string };
  placedAt: Date;
  lines: Array<{ sku: string; description: string; qty: number; unitPrice: number }>;
};

const money = '"$"#,##0.00';

const orders = createExcelSchema<Order>()
  .theme(spreadsheetThemes.slate)
  .column("number", { header: "Order", accessor: "number", summary: (s) => [s.label("Total")] })
  .column("customer", { header: "Customer", accessor: "customer.name", minWidth: 18 })
  .column("placedAt", { header: "Placed", accessor: "placedAt", format: "yyyy-mm-dd" })
  .column("sku", { header: "SKU", accessor: (row) => row.lines.map((line) => line.sku) })
  .column("description", {
    header: "Item",
    accessor: (row) => row.lines.map((line) => line.description),
    maxWidth: 40,
  })
  .column("qty", {
    header: "Qty",
    accessor: (row) => row.lines.map((line) => line.qty),
    summary: (s) => [s.formula("sum")],
  })
  .column("unitPrice", {
    header: "Unit price",
    accessor: (row) => row.lines.map((line) => line.unitPrice),
    format: money,
  })
  .column("lineTotal", {
    header: "Line total",
    formula: ({ refs }) => refs.column("qty").mul(refs.column("unitPrice")),
    expansion: "expand",
    format: money,
    summary: (s) => [s.formula("sum")],
  })
  .column("orderTotal", {
    header: "Order total",
    formula: ({ row }) => row.series("lineTotal").sum(),
    expansion: "single",
    format: money,
    style: { font: { bold: true } },
  })
  .build();

export function ordersWorkbook(rows: Order[]) {
  const workbook = createWorkbook();
  workbook
    .sheet("Orders", { freezePane: { rows: 2 } })
    .table("orders", { title: "Orders, March 2026", schema: orders, rows });
  return workbook.toUint8Array();
}
```

## Sales dashboard: data, KPIs, chart, pivot

A data sheet readers can filter (excel-table), and a dashboard sheet with KPI blocks side by side, a chart and a pivot. Everything in one chain so the chart and pivot can reach the data.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Sale = {
  orderedAt: Date;
  month: string;
  region: string;
  channel: string;
  revenue: number;
  cost: number;
};
type Kpi = { label: string; value: number; format: string };
type MonthTotal = { month: string; revenue: number; cost: number };

const sales = createExcelSchema<Sale>({ mode: "excel-table" })
  .column("orderedAt", { header: "Ordered", accessor: "orderedAt", format: "yyyy-mm-dd" })
  .column("month", { header: "Month", accessor: "month" })
  .column("region", { header: "Region", accessor: "region" })
  .column("channel", { header: "Channel", accessor: "channel" })
  .column("revenue", {
    header: "Revenue",
    accessor: "revenue",
    format: "#,##0",
    totalsRow: { function: "sum" },
  })
  .column("cost", {
    header: "Cost",
    accessor: "cost",
    format: "#,##0",
    totalsRow: { function: "sum" },
  })
  .column("margin", {
    header: "Margin",
    formula: ({ refs, fx }) =>
      fx.safeDiv(refs.column("revenue").sub(refs.column("cost")), refs.column("revenue")),
    format: "0.0%",
  })
  .build();

const kpis = createExcelSchema<Kpi>()
  .column("label", { header: "Metric", accessor: "label", minWidth: 16 })
  .column("value", {
    header: "Value",
    accessor: "value",
    format: ({ row }) => row.format,
    style: { font: { bold: true } },
  })
  .build();

const monthTotals = createExcelSchema<MonthTotal>()
  .column("month", { header: "Month", accessor: "month" })
  .column("revenue", { header: "Revenue", accessor: "revenue", format: "#,##0" })
  .column("cost", { header: "Cost", accessor: "cost", format: "#,##0" })
  .build();

export function salesDashboard(rows: Sale[]) {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const cost = rows.reduce((sum, row) => sum + row.cost, 0);
  const byMonth = new Map<string, MonthTotal>();
  for (const row of rows) {
    const total = byMonth.get(row.month) ?? { month: row.month, revenue: 0, cost: 0 };
    total.revenue += row.revenue;
    total.cost += row.cost;
    byMonth.set(row.month, total);
  }

  return createWorkbook()
    .sheet("Sales", { freezePane: { rows: 1 } })
    .table("sales", { schema: sales, rows, name: "Sales", totalsRow: true })
    .sheet("Dashboard", { tablesPerRow: 2, tableColumnGap: 2 })
    .table("headline", {
      title: "Headline",
      schema: kpis,
      rows: [
        { label: "Revenue", value: revenue, format: '"$"#,##0' },
        { label: "Margin", value: revenue ? (revenue - cost) / revenue : 0, format: "0.0%" },
        { label: "Orders", value: rows.length, format: "#,##0" },
      ],
    })
    .table("months", { title: "By month", schema: monthTotals, rows: [...byMonth.values()] })
    .chart("trend", ({ refs }) => ({
      title: "Revenue and cost by month",
      marks: [refs.table("months").bar({ x: "month", y: ["revenue", "cost"] })],
      legend: "top",
    }))
    .pivot("byRegion", ({ refs }) =>
      refs
        .sheet("Sales")
        .table("sales")
        .pivot({
          rows: ["region"],
          columns: ["channel"],
          values: { revenue: "sum" },
          sort: "descending",
        }),
    )
    .toUint8Array();
}
```

Monthly totals are computed in TypeScript into a small table so the chart has one row per month. A chart over the raw sales table would plot one point per sale.

## Editable planning sheet

Readers fill in targets; formulas and colors react as they type. Inputs are unlocked and styled, everything else is locked.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Plan = {
  account: string;
  owner: string;
  currentArr: number;
  targetArr: number;
  status: "draft" | "committed";
};

const plan = createExcelSchema<Plan>()
  .column("account", { header: "Account", accessor: "account", minWidth: 20 })
  .column("owner", { header: "Owner", accessor: "owner" })
  .column("currentArr", { header: "Current ARR", accessor: "currentArr", format: '"$"#,##0' })
  .column("targetArr", {
    header: "Target ARR",
    accessor: "targetArr",
    format: '"$"#,##0',
    style: { protection: { locked: false } },
    validation: (v) =>
      v.decimal().gte(0).error({ title: "Target ARR", message: "Enter a positive amount" }),
  })
  .column("status", {
    header: "Status",
    accessor: "status",
    style: { protection: { locked: false } },
    validation: (v) => v.list(["draft", "committed"]),
  })
  .column("uplift", {
    header: "Uplift",
    formula: ({ refs, fx }) =>
      fx.safeDiv(refs.column("targetArr"), refs.column("currentArr")).sub(1),
    format: "0.0%",
    conditionalStyle: (c) =>
      c
        .when(({ refs }) => refs.column("uplift").lt(0), {
          font: { color: { rgb: "B42318" }, bold: true },
        })
        .when(({ refs }) => refs.column("uplift").gte(0.2), { fill: { color: { rgb: "DCFCE7" } } }),
    summary: (s) => [s.formula("average")],
  })
  .build();

export function planningWorkbook(rows: Plan[]) {
  const workbook = createWorkbook();
  workbook
    .sheet("Plan 2027", {
      freezePane: { rows: 2, columns: 1 },
      protection: { selectLockedCells: true, sort: true },
    })
    .table("plan", {
      title: "Renewal targets: edit the green cells",
      schema: plan,
      rows,
      defaults: { cells: { unlocked: { preset: "cell.input" } } },
    });
  return workbook.toUint8Array();
}
```

## Monthly matrix with totals and trends

Rows are accounts, columns are the months of the requested period, with a total, a monthly average, a sparkline, and a column per month total at the bottom.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type AccountUsage = { account: string; usage: Map<string, number> };
type Context = { months: Array<{ key: string; label: string }> };

const usage = createExcelSchema<AccountUsage, Context>()
  .column("account", { header: "Account", accessor: "account", summary: (s) => [s.label("Total")] })
  .dynamic("months", (builder, { ctx }) => {
    for (const month of ctx.months) {
      builder.column(`m-${month.key}`, {
        header: month.label,
        accessor: (row) => row.usage.get(month.key) ?? 0,
        format: "#,##0",
        width: 9,
        summary: (s) => [s.formula("sum")],
      });
    }
  })
  .column("total", {
    header: "Total",
    formula: ({ refs, fx }) => fx.sum(refs.dynamic("months")),
    format: "#,##0",
    style: { font: { bold: true } },
    summary: (s) => [s.formula("sum")],
  })
  .column("average", {
    header: "Avg / month",
    formula: ({ refs, fx }) => fx.round(fx.average(refs.dynamic("months")), 0),
    format: "#,##0",
  })
  .column("trend", { header: "Trend", type: "sparkline", source: { dynamic: "months" }, width: 16 })
  .build();

export function usageMatrix(rows: AccountUsage[], months: Context["months"]) {
  const workbook = createWorkbook();
  workbook
    .sheet("Usage", { freezePane: { rows: 1, columns: 1 } })
    .table("usage", { schema: usage, rows, context: { months }, defaults: { rowHeight: 24 } });
  return workbook.toUint8Array();
}
```

## Translated, role-based, streamed export

The shape of a production export job: a shared context with a translator and the user's role, columns hidden by role, one column per currency, rows streamed from the database, and a new sheet every 500,000 rows.

```ts
import { createExcelSchema, createWorkbookStream } from "typed-xlsx";

type Currency = "EUR" | "USD";
type Context = {
  t: (key: string) => string;
  role: "admin" | "member";
  currencies: Currency[];
};
type ContractRow = {
  id: string;
  account: { name: string };
  signedAt: Date | null;
  active: boolean;
  totals: Record<Currency, string>; // decimals as strings
  margin: string | null;
};

const currencyFormat: Record<Currency, string> = { EUR: '#,##0.00 "€"', USD: '"$"#,##0.00' };

const contracts = createExcelSchema<ContractRow, Context>()
  .column("account", {
    header: ({ ctx }) => ctx.t("contracts.account"),
    accessor: "account.name",
    minWidth: 24,
    summary: (s) => [s.label(({ ctx }) => ctx.t("common.total"))],
  })
  .column("signedAt", {
    header: ({ ctx }) => ctx.t("contracts.signedAt"),
    accessor: "signedAt",
    format: "yyyy-mm-dd",
  })
  .column("active", {
    header: ({ ctx }) => ctx.t("contracts.active"),
    accessor: "active",
    transform: ({ value, ctx }) => ctx.t(value ? "common.yes" : "common.no"),
  })
  .dynamic("totals", (builder, { ctx }) => {
    for (const currency of ctx.currencies) {
      builder.column(`total-${currency}`, {
        header: ({ ctx: c }) => `${c.t("contracts.total")} ${currency}`,
        accessor: (row) => Number(row.totals[currency]),
        format: currencyFormat[currency],
        summary: (s) => [s.formula("sum")],
      });
    }
  })
  .column("margin", {
    header: ({ ctx }) => ctx.t("contracts.margin"),
    accessor: (row) => (row.margin === null ? null : Number(row.margin)),
    format: "0.0%",
    condition: ({ ctx }) => ctx.role === "admin",
  })
  .build();

const MAX_ROWS_PER_SHEET = 500_000;

export async function exportContracts(options: {
  pages: AsyncIterable<ContractRow[]>;
  context: Context;
  path: string;
}) {
  const workbook = createWorkbookStream({ memoryProfile: "low-memory" });
  const sheetName = options.context.t("contracts.sheetName");
  const openPart = (part: number) =>
    workbook
      .sheet(part === 1 ? sheetName : `${sheetName} ${part}`, { freezePane: { rows: 1 } })
      .table(`contracts-${part}`, { schema: contracts, context: options.context });
  try {
    let table: Awaited<ReturnType<typeof openPart>> | undefined;
    let part = 0;
    let rowsInSheet = 0;
    for await (const page of options.pages) {
      let offset = 0;
      while (offset < page.length) {
        if (!table || rowsInSheet === MAX_ROWS_PER_SHEET) {
          part += 1;
          table = await openPart(part);
          rowsInSheet = 0;
        }
        const rows = page.slice(offset, offset + MAX_ROWS_PER_SHEET - rowsInSheet);
        await table.commit({ rows });
        offset += rows.length;
        rowsInSheet += rows.length;
      }
    }
    if (!table) await openPart(1);
    await workbook.writeToFile(options.path);
  } catch (error) {
    await workbook.dispose();
    throw error;
  }
}
```

An export with no rows still gets a sheet with headers, so the file never opens empty.

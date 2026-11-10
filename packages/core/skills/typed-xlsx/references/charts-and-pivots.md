# Charts and pivot tables

Both are native Excel objects that read tables already in the workbook. They follow the data: edit a cell and the chart updates; refresh the pivot and it recounts.

## Contents

- [Charts](#charts)
- [Marks](#marks)
- [Chart options](#chart-options)
- [Pivot tables](#pivot-tables)
- [Pivot charts](#pivot-charts)
- [Streaming](#streaming)
- [Limits](#limits)

## Charts

`.chart(id, ({ refs }) => spec)` sits in the same chain as `.sheet()` and `.table()`. `refs.table(id)` reads a table declared earlier on the current sheet; `refs.sheet(name).table(id)` reads one on another sheet. Keep the whole workbook in one chain when charts combine tables.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Month = { month: string; revenue: number; cost: number; marginRate: number };

const monthly = createExcelSchema<Month>()
  .column("month", { header: "Month", accessor: "month" })
  .column("revenue", { header: "Revenue", accessor: "revenue", format: "#,##0" })
  .column("cost", { header: "Cost", accessor: "cost", format: "#,##0" })
  .column("marginRate", { header: "Margin", accessor: "marginRate", format: "0%" })
  .build();

export function buildDashboard(rows: Month[]) {
  return createWorkbook()
    .sheet("Data")
    .table("monthly", { schema: monthly, rows })
    .sheet("Dashboard")
    .chart("revenue", ({ refs }) => ({
      title: "Revenue and margin",
      marks: [
        refs
          .sheet("Data")
          .table("monthly")
          .bar({ x: "month", y: ["revenue", "cost"] }),
        refs.sheet("Data").table("monthly").line({ x: "month", y: "marginRate", axis: "y2" }),
      ],
      axes: { y: { format: "#,##0", min: 0 }, y2: { format: "0%" } },
      legend: "top",
      at: "B2",
      size: { width: 720, height: 360 },
    }));
}
```

Without `at`, a chart goes to the right of the sheet's tables, further charts stack below.

## Marks

| Mark              | Keys             | Options                                         |
| ----------------- | ---------------- | ----------------------------------------------- |
| `bar`             | `x`, `y`         | `stack: true \| "percent"`, `horizontal`, `gap` |
| `line`            | `x`, `y`         | `smooth`, `markers`, `dashed`, `width`, `stack` |
| `area`            | `x`, `y`         | `stack`                                         |
| `scatter`         | numeric `x`, `y` | `lines`                                         |
| `pie`, `doughnut` | `label`, `value` | `hole` (doughnut), `labels: { percent: true }`  |

- `y` takes one column or a list; a list item can be `{ column, name, color }`.
- `y` must be numeric (after `transform`). `x` can be text, numbers or dates; marks combined in one chart need the same kind of `x`.
- `name`, `color` (`"#2563EB"`), `axis: "y2"`, `labels` go on a mark.
- Dynamic columns: `y: { dynamic: "months" }` gives one series per generated column; `x: { dynamic: "months" }, series: "territory"` gives one series per row (max 255 rows).
- Pies, doughnuts, scatter and horizontal bars are the only mark of their chart.
- Marks from different tables line up row by row on their x column. If the x values differ, writing throws.

## Chart options

`title`, `marks`, `axes: { x, y, y2 }` (each with `title`, `min`, `max`, `step`, `format`, `logBase`, `gridlines`, `hidden`, `reverse`), `legend` (`"top" | "bottom" | "left" | "right" | false`), `colors` (series or slice colors in order), `at`, `size`. Data labels on a mark: `labels: true` or `{ value, category, series, percent, format }`.

## Pivot tables

`.pivot(id, ({ refs }) => refs.table(id).pivot(options))` places a pivot over an earlier table. Readers can rearrange, filter and refresh it in Excel.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Sale = { orderedAt: Date; region: string; channel: string; product: string; revenue: number };

const sales = createExcelSchema<Sale>()
  .column("orderedAt", { header: "Ordered", accessor: "orderedAt", format: "yyyy-mm-dd" })
  .column("region", { header: "Region", accessor: "region" })
  .column("channel", { header: "Channel", accessor: "channel" })
  .column("product", { header: "Product", accessor: "product" })
  .column("revenue", { header: "Revenue", accessor: "revenue", format: "#,##0" })
  .build();

export function salesAnalysis(rows: Sale[]) {
  return createWorkbook()
    .sheet("Sales")
    .table("sales", { schema: sales, rows })
    .sheet("Analysis")
    .pivot("byRegion", ({ refs }) =>
      refs
        .sheet("Sales")
        .table("sales")
        .pivot({
          rows: ["region", "product"],
          columns: ["channel"],
          values: { revenue: ["sum", { aggregate: "sum", show: "percentOfRow", name: "Share" }] },
          sort: "descending",
        }),
    )
    .pivot("byMonth", ({ refs }) =>
      refs
        .sheet("Sales")
        .table("sales")
        .pivot({
          rows: [{ field: "orderedAt", by: ["year", "month"] }],
          values: { revenue: "sum", product: "count" },
        }),
    );
}
```

| Option                                              | Effect                                                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rows`                                              | fields down the left, outermost first; a date can be `{ field, by: "year" \| "quarter" \| "month" \| [...] }`                                                   |
| `columns`                                           | one field across the top                                                                                                                                        |
| `values`                                            | `{ column: aggregate }`; `sum`, `average`, `min`, `max` need numbers, `count` works on anything. Use a list for several, an object for `name`, `format`, `show` |
| `show`                                              | `"percentOfTotal" \| "percentOfRow" \| "percentOfColumn"` (row/column need a column field)                                                                      |
| `filters`                                           | fields shown above the pivot                                                                                                                                    |
| `sort`                                              | `"ascending"` (default), `"descending"`, `"source"`                                                                                                             |
| `totals`                                            | `false`, `{ row: false }`, `{ column: false }`                                                                                                                  |
| `style`, `theme`, `banded`, `grandTotalLabel`, `at` | look and placement; by default the pivot follows its source table's theme                                                                                       |

Date grouping needs a column that can never be blank (non-nullable, or with a `defaultValue`). Each field can be used once across rows, columns and filters.

## Pivot charts

`refs.pivot(id)` gives marks over a pivot declared earlier (`bar`, `line`, `area`, `pie`, `doughnut`). Excel keeps the chart in sync with the pivot's filters.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Sale = { region: string; month: string; revenue: number };

const sales = createExcelSchema<Sale>()
  .column("region", { header: "Region", accessor: "region" })
  .column("month", { header: "Month", accessor: "month" })
  .column("revenue", { header: "Revenue", accessor: "revenue" })
  .build();

createWorkbook()
  .sheet("Sales")
  .table("sales", { schema: sales, rows: [] })
  .pivot("byRegion", ({ refs }) =>
    refs
      .table("sales")
      .pivot({ rows: ["region"], columns: ["month"], values: { revenue: "sum" }, sort: "source" }),
  )
  .chart("byRegionChart", ({ refs }) => ({ marks: [refs.pivot("byRegion").bar({ stack: true })] }));
```

## Streaming

A streamed table handle creates marks and pivots directly; `sheet.chart(id, spec)` takes the spec as an object, `sheet.pivot(id, spec)` returns pivot marks. Declare pivots **before the first commit**: rows are tallied as they pass.

```ts
import { createExcelSchema, createWorkbookStream } from "typed-xlsx";

type Sale = { region: string; month: string; revenue: number };

const schema = createExcelSchema<Sale>()
  .column("region", { header: "Region", accessor: "region" })
  .column("month", { header: "Month", accessor: "month" })
  .column("revenue", { header: "Revenue", accessor: "revenue" })
  .build();

export async function streamSales(pages: AsyncIterable<Sale[]>) {
  const workbook = createWorkbookStream();
  const sales = await workbook.sheet("Sales").table("sales", { schema });
  const analysis = workbook.sheet("Analysis");
  const byRegion = analysis.pivot(
    "byRegion",
    sales.pivot({ rows: ["region"], columns: ["month"], values: { revenue: "sum" } }),
  );
  analysis.chart("trend", { marks: [byRegion.bar({ stack: true })] });

  for await (const rows of pages) await sales.commit({ rows });
  await workbook.writeToFile("./sales.xlsx");
}
```

## Limits

- Tables with sub-rows (array accessors) can't be charted or pivoted. Flatten them first.
- Charts plot body rows only: no title, header, summary or totals rows.
- A chart reads its table after `select`: excluded columns aren't offered.
- In report mode, formula columns can be pivot values (Excel computes them on refresh) but not rows, columns or filters.

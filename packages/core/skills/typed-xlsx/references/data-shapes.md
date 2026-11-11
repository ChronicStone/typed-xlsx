# Data shapes

How to turn each common shape of data into a sheet. The rule behind all of them: a schema row is one thing the reader thinks of as a line. Prepare data into that shape before the schema when it is far from it, and let the schema handle the last step (paths, labels, formats).

## Contents

- [Flat records](#flat-records)
- [Nested objects and optional relations](#nested-objects-and-optional-relations)
- [Values that need a label: enums, booleans, localized text](#values-that-need-a-label)
- [Numbers, money, percentages, dates](#numbers-money-percentages-dates)
- [Row numbers](#row-numbers)
- [One-to-many: a list per row](#one-to-many-a-list-per-row)
- [Lists of primitives](#lists-of-primitives)
- [Wide data: columns known at export time](#wide-data-columns-known-at-export-time)
- [Long data that readers want as a matrix](#long-data-that-readers-want-as-a-matrix)
- [Data that is not on the row: lookups](#data-that-is-not-on-the-row-lookups)
- [Mixed row types](#mixed-row-types)
- [Hierarchies and sections](#hierarchies-and-sections)

## Flat records

One field, one column. String accessors are paths, checked against the row type.

```ts
import { createExcelSchema } from "typed-xlsx";

type User = { name: string; email: string; createdAt: Date; active: boolean };

export const users = createExcelSchema<User>()
  .column("name", { header: "Name", accessor: "name" })
  .column("email", { header: "Email", accessor: "email" })
  .column("createdAt", { header: "Created", accessor: "createdAt", format: "yyyy-mm-dd" })
  .column("active", { header: "Active", type: "checkbox", accessor: "active" })
  .build();
```

## Nested objects and optional relations

Use a dotted path for a nested field. When a relation can be missing, use an accessor function with optional chaining, and `defaultValue` for what the cell shows instead.

```ts
import { createExcelSchema } from "typed-xlsx";

type Account = {
  name: string;
  owner: { name: string; email: string };
  group: { name: string } | null;
};

export const accounts = createExcelSchema<Account>()
  .column("name", { header: "Account", accessor: "name" })
  .column("owner", { header: "Owner", accessor: "owner.name" })
  .column("ownerEmail", { header: "Owner email", accessor: "owner.email" })
  .column("group", {
    header: "Group",
    accessor: (row) => row.group?.name ?? null,
    defaultValue: "No group",
  })
  .build();
```

An object is not a cell value. `accessor: "owner"` is a type error; point at a field inside it.

## Values that need a label

Enums and literal unions: map the value to a label in `transform`. Use a badge when color carries meaning.

```ts
import { createExcelSchema } from "typed-xlsx";

type Ticket = { status: "open" | "blocked" | "done"; priority: "low" | "high" };

const priorityLabels = { low: "Low", high: "High" } as const;

export const tickets = createExcelSchema<Ticket>()
  .column("priority", {
    header: "Priority",
    accessor: "priority",
    transform: ({ value }) => priorityLabels[value],
  })
  .column("status", {
    header: "Status",
    type: "badge",
    accessor: "status",
    variants: {
      open: { label: "Open", style: { fill: { color: { rgb: "DBEAFE" } } } },
      blocked: { label: "Blocked", style: { fill: { color: { rgb: "FEE2E2" } } } },
      done: { label: "Done", style: { fill: { color: { rgb: "DCFCE7" } } } },
    },
  })
  .build();
```

Booleans: `type: "checkbox"` writes a native checkbox (`TRUE`/`FALSE`) that formulas can read. When readers expect words, transform to text.

Translated labels and localized fields: put the translator and locale in the context and use them in `header`, `transform` and summary labels. One schema then serves every language.

```ts
import { createExcelSchema } from "typed-xlsx";

type Locale = "en" | "fr";
type Context = { locale: Locale; t: (key: string) => string };
type Product = { name: Record<Locale, string>; archived: boolean };

export const products = createExcelSchema<Product, Context>()
  .column("name", {
    header: ({ ctx }) => ctx.t("product.name"),
    accessor: (row) => row.name,
    transform: ({ value, ctx }) => value[ctx.locale],
  })
  .column("archived", {
    header: ({ ctx }) => ctx.t("product.archived"),
    accessor: "archived",
    transform: ({ value, ctx }) => ctx.t(value ? "common.yes" : "common.no"),
  })
  .build();
```

## Numbers, money, percentages, dates

Write numbers and dates as values and let the format display them. Text that looks like a number can't be summed or charted.

```ts
import { createExcelSchema } from "typed-xlsx";

type Line = {
  amount: string; // a decimal from the database
  currency: "EUR" | "USD";
  marginRate: number; // 0.25 means 25%
  dueOn: string; // ISO date
};

const currencyFormats = { EUR: '#,##0.00 "€"', USD: '"$"#,##0.00' } as const;

export const lines = createExcelSchema<Line>()
  .column("amount", {
    header: "Amount",
    accessor: (row) => Number(row.amount),
    format: ({ row }) => currencyFormats[row.currency],
  })
  .column("currency", { header: "Currency", accessor: "currency" })
  .column("marginRate", { header: "Margin", accessor: "marginRate", format: "0.0%" })
  .column("dueOn", { header: "Due", accessor: (row) => new Date(row.dueOn), format: "yyyy-mm-dd" })
  .build();
```

- `format` takes a number format, or a function of `{ row, ctx }` when it varies per row (the currency above).
- Several currencies in one column can't be summed meaningfully. Either one column per currency (see [wide data](#wide-data-columns-known-at-export-time)), or convert to one reporting currency.
- Dates: a `Date` with a date format. Dates are written as UTC.
- A cell takes a string, number, boolean, `Date` or `null`. A `bigint` is written as a number when it is a safe integer, as text otherwise. A Decimal or any other object throws when writing: call `.toNumber()` or `.toString()` in the accessor.
- `NaN`, `Infinity`, an invalid `Date` and a date outside 1900-01-01 to 9999-12-31 throw when writing, with the cell address in the message. Map them to `null` in the accessor.
- Control characters that XML forbids (such as `\u0000`) are removed from text, and leading or trailing spaces are kept.

## Row numbers

`transform` receives the row index, starting at 0.

```ts
import { createExcelSchema } from "typed-xlsx";

export const ranked = createExcelSchema<{ id: string; name: string }>()
  .column("rank", { header: "#", accessor: "id", transform: ({ rowIndex }) => rowIndex + 1 })
  .column("name", { header: "Name", accessor: "name" })
  .build();
```

## One-to-many: a list per row

An order with lines, an account with contacts. Three ways, by what the reader needs:

| Reader needs                                   | Shape                                            | Works with       |
| ---------------------------------------------- | ------------------------------------------------ | ---------------- |
| Each parent once, its children listed under it | sub-rows: array accessors                        | report mode only |
| To filter, sort, chart or pivot the children   | one row per child, parent fields repeated        | everything       |
| Parents and children separately                | two tables or two sheets, joined by an id column | everything       |

**Sub-rows.** When accessors return arrays, a row expands into one worksheet row per item, and single-value columns are merged across them. Arrays from the same parent line up by index.

```ts
import { createExcelSchema } from "typed-xlsx";

type Order = {
  id: string;
  customer: string;
  lines: Array<{ sku: string; qty: number; unitPrice: number }>;
};

export const orders = createExcelSchema<Order>()
  .column("id", { header: "Order", accessor: "id" })
  .column("customer", { header: "Customer", accessor: "customer" })
  .column("sku", { header: "SKU", accessor: (row) => row.lines.map((line) => line.sku) })
  .column("qty", { header: "Qty", accessor: (row) => row.lines.map((line) => line.qty) })
  .column("unitPrice", {
    header: "Unit price",
    accessor: (row) => row.lines.map((line) => line.unitPrice),
    format: '"$"#,##0.00',
  })
  .column("lineTotal", {
    header: "Line total",
    formula: ({ refs }) => refs.column("qty").mul(refs.column("unitPrice")),
    expansion: "expand", // one formula per line
    format: '"$"#,##0.00',
  })
  .column("orderTotal", {
    header: "Order total",
    formula: ({ row }) => row.series("lineTotal").sum(),
    expansion: "single", // once per order, merged
    format: '"$"#,##0.00',
  })
  .build();
```

Sub-row tables can't be excel-tables, and can't feed charts or pivots. An empty array gives the parent a single row with empty cells.

**One row per child.** Flatten in TypeScript, then the schema is flat:

```ts
import { createExcelSchema } from "typed-xlsx";

type Order = { id: string; customer: string; lines: Array<{ sku: string; qty: number }> };
type OrderLine = { orderId: string; customer: string; sku: string; qty: number };

const toLines = (orders: Order[]): OrderLine[] =>
  orders.flatMap((order) =>
    order.lines.map((line) => ({ orderId: order.id, customer: order.customer, ...line })),
  );

export const orderLines = createExcelSchema<OrderLine>({ mode: "excel-table" })
  .column("orderId", { header: "Order", accessor: "orderId" })
  .column("customer", { header: "Customer", accessor: "customer" })
  .column("sku", { header: "SKU", accessor: "sku" })
  .column("qty", { header: "Qty", accessor: "qty", totalsRow: { function: "sum" } })
  .build();

export { toLines };
```

## Lists of primitives

Tags, roles, emails. Join them into one cell when readers just need to see them; expand into sub-rows only when each item needs its own cell.

```ts
import { createExcelSchema } from "typed-xlsx";

export const members = createExcelSchema<{ name: string; roles: string[] }>()
  .column("name", { header: "Name", accessor: "name" })
  .column("roles", { header: "Roles", accessor: (row) => row.roles.join(", ") })
  .build();
```

## Wide data: columns known at export time

Months of a period, currencies, regions, survey questions, the organizations a user belongs to: the set of columns depends on the export. Pass the set in the context and generate the columns with `.dynamic()`.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Territory = { name: string; revenueByMonth: Record<string, number> };
type Context = { months: Array<{ key: string; label: string }> };

const territories = createExcelSchema<Territory, Context>()
  .column("name", { header: "Territory", accessor: "name" })
  .dynamic("months", (builder, { ctx }) => {
    for (const month of ctx.months) {
      builder.column(`month-${month.key}`, {
        header: month.label,
        accessor: (row) => row.revenueByMonth[month.key] ?? 0,
        format: "#,##0",
        summary: (s) => [s.formula("sum")],
      });
    }
  })
  .column("total", {
    header: "Total",
    formula: ({ refs, fx }) => fx.sum(refs.dynamic("months")),
    format: "#,##0",
    summary: (s) => [s.formula("sum")],
  })
  .column("trend", { header: "Trend", type: "sparkline", source: { dynamic: "months" } })
  .build();

createWorkbook()
  .sheet("Territories")
  .table("territories", {
    schema: territories,
    rows: [],
    context: {
      months: [
        { key: "2026-01", label: "Jan" },
        { key: "2026-02", label: "Feb" },
      ],
    },
  });
```

- Generated ids must be unique and stable: build them from keys, not labels.
- `select` and formulas refer to the dynamic block by its id (`"months"`), not to generated ids.
- `.dynamic(id, { condition }, build)` drops the whole block for some contexts.
- Fixed sets known when writing the code (Q1 to Q4) are a `.group()` instead.

## Long data that readers want as a matrix

Rows like `{ region, month, revenue }`, one per pair. Two options:

- **Pivot in TypeScript** into one row per region with a `Record<month, number>`, then use dynamic columns as above. Best when the matrix is the report.
- **Keep the long rows and add a native pivot table** (`.pivot()`), which readers can rearrange in Excel. See [charts and pivots](charts-and-pivots.md).

```ts
type Sale = { region: string; month: string; revenue: number };
type RegionRow = { region: string; revenueByMonth: Record<string, number> };

export function toMatrix(sales: Sale[]): RegionRow[] {
  const byRegion = new Map<string, RegionRow>();
  for (const sale of sales) {
    const row = byRegion.get(sale.region) ?? { region: sale.region, revenueByMonth: {} };
    row.revenueByMonth[sale.month] = (row.revenueByMonth[sale.month] ?? 0) + sale.revenue;
    byRegion.set(sale.region, row);
  }
  return [...byRegion.values()];
}
```

## Data that is not on the row: lookups

Metrics computed by a separate query, exchange rates, labels from another table. Put them in the context, keyed by id, and read them in an accessor or `transform`. The rows stay as your data layer returns them.

```ts
import { createExcelSchema } from "typed-xlsx";

type Account = { id: string; name: string };
type Metrics = { delivered: number; passed: number };
type Context = { metrics: Map<string, Metrics> };

export const accountMetrics = createExcelSchema<Account, Context>()
  .column("name", { header: "Account", accessor: "name" })
  .column("delivered", {
    header: "Delivered",
    accessor: "id",
    transform: ({ value, ctx }) => ctx.metrics.get(value)?.delivered ?? 0,
  })
  .column("passRate", {
    header: "Pass rate",
    accessor: "id",
    transform: ({ value, ctx }) => {
      const metrics = ctx.metrics.get(value);
      return metrics && metrics.delivered ? metrics.passed / metrics.delivered : 0;
    },
    format: "0.0%",
  })
  .build();
```

When streaming, the context is fixed when the table is created. For lookups that depend on each page, enrich the rows before `commit()` instead.

## Mixed row types

A discriminated union works as the row type. Use accessor functions that switch on the tag.

```ts
import { createExcelSchema } from "typed-xlsx";

type Movement =
  | { kind: "payment"; at: Date; amount: number; method: string }
  | { kind: "refund"; at: Date; amount: number; reason: string };

export const movements = createExcelSchema<Movement>()
  .column("at", { header: "Date", accessor: (row) => row.at, format: "yyyy-mm-dd" })
  .column("kind", { header: "Type", accessor: (row) => row.kind })
  .column("amount", {
    header: "Amount",
    accessor: (row) => (row.kind === "refund" ? -row.amount : row.amount),
    format: '"$"#,##0.00;[Red]-"$"#,##0.00',
  })
  .column("detail", {
    header: "Detail",
    accessor: (row) => (row.kind === "payment" ? row.method : row.reason),
  })
  .build();
```

## Hierarchies and sections

- **A tree** (categories, an org chart): flatten it depth-first with a `depth` field, and indent the label with `style: ({ row }) => ({ alignment: { indent: row.depth } })`. Bold the parents the same way.
- **Sections with their own totals** (one block per region): one table per section on the same sheet, each with a `title` and summary rows. Tables stack top to bottom.
- **One sheet per entity** (one tab per customer or preset): loop over the entities and call `.sheet(name).table(...)` for each. Excel limits sheet names to 31 characters: longer names are cut, and a repeated name gets a ` (2)` suffix. Build short unique names yourself so charts, pivots and `#'Sheet'!A1` links can find them.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Line = { region: string; product: string; revenue: number };

const lines = createExcelSchema<Line>()
  .column("product", { header: "Product", accessor: "product", summary: (s) => [s.label("Total")] })
  .column("revenue", {
    header: "Revenue",
    accessor: "revenue",
    format: "#,##0",
    summary: (s) => [s.formula("sum")],
  })
  .build();

export function sectionsByRegion(rows: Line[]) {
  const workbook = createWorkbook();
  const sheet = workbook.sheet("By region");
  const regions = [...new Set(rows.map((row) => row.region))];
  for (const region of regions) {
    sheet.table(`region-${regions.indexOf(region)}`, {
      title: region,
      schema: lines,
      rows: rows.filter((row) => row.region === region),
    });
  }
  return workbook;
}
```

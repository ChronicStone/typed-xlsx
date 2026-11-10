# Formulas, summaries and totals

## Contents

- [Formula columns](#formula-columns)
- [The DSL](#the-dsl)
- [Scope: what a formula can reference](#scope-what-a-formula-can-reference)
- [Sub-rows: refs.column vs row.series](#sub-rows-refscolumn-vs-rowseries)
- [Summary rows (report mode)](#summary-rows-report-mode)
- [Totals row (excel-table mode)](#totals-row-excel-table-mode)
- [Formulas that read the context](#formulas-that-read-the-context)

## Formula columns

A formula column writes an Excel formula into each row. Excel computes it when the file opens and whenever an input changes. The same code writes A1 references in report mode (`=B2*C2`) and structured references in excel-table mode (`=[@Qty]*[@Price]`).

```ts
import { createExcelSchema } from "typed-xlsx";

type Deal = { name: string; contract: number; discount: number; quota: number };

export const deals = createExcelSchema<Deal>()
  .column("name", { header: "Deal", accessor: "name" })
  .column("contract", { header: "Contract", accessor: "contract", format: "#,##0" })
  .column("discount", { header: "Discount", accessor: "discount", format: "0%" })
  .column("quota", { header: "Quota", accessor: "quota", format: "#,##0" })
  .column("net", {
    header: "Net",
    formula: ({ refs, fx }) =>
      fx.round(refs.column("contract").mul(fx.literal(1).sub(refs.column("discount"))), 2),
    format: "#,##0.00",
  })
  .column("attainment", {
    header: "Attainment",
    formula: ({ refs, fx }) => fx.safeDiv(refs.column("net"), refs.column("quota")),
    format: "0.0%",
  })
  .column("tier", {
    header: "Tier",
    formula: ({ refs, fx }) =>
      fx.if(
        refs.column("net").gte(50000),
        "Strategic",
        fx.if(refs.column("net").gte(10000), "Core", "Small"),
      ),
  })
  .build();
```

A formula column has no accessor. Its value type (number, text, boolean) is inferred from the formula, so charts can plot numeric formulas.

## The DSL

| Write                                                                               | Gets                                                               |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `refs.column("a").add(b)`, `.sub`, `.mul`, `.div`                                   | `a+b`, … ; `b` can be a number, string, boolean or another operand |
| `fx.literal(1).sub(refs.column("d"))`                                               | a constant as the left operand                                     |
| `.eq`, `.neq`, `.gt`, `.gte`, `.lt`, `.lte`                                         | a condition                                                        |
| `cond.and(other)`, `.or(other)`, `.not()`; `fx.and(...)`, `fx.or(...)`, `fx.not(c)` | `AND`, `OR`, `NOT`                                                 |
| `fx.if(cond, whenTrue, whenFalse)`                                                  | `IF(…)`, nest for chains                                           |
| `fx.round(x, 2)`, `x.round(2)`, `fx.abs(x)`, `x.abs()`                              | `ROUND`, `ABS`                                                     |
| `fx.min(a, b, …)`, `fx.max(a, b, …)`                                                | `MIN`, `MAX`                                                       |
| `fx.safeDiv(a, b)`, `fx.safeDiv(a, b, { fallback, when })`                          | `IF(b<>0,a/b,0)`, no `#DIV/0!`                                     |
| `fx.sum(refs.group("g"))`, `fx.average`, `fx.count`, `fx.min`, `fx.max`             | the function over every column of a group or dynamic block         |
| `row.series("col").sum()`, `.average()`, `.min()`, `.max()`, `.count()`             | the function over the current row's sub-rows                       |

Only these functions exist. For anything else (lookups, dates, text functions), compute the value in TypeScript with an accessor.

## Scope: what a formula can reference

- Columns declared **before** it in the chain, including other formula columns.
- Inside a group or dynamic block: columns before the block, and columns before it inside the block.
- Groups and dynamic blocks as a whole, once declared, through `refs.group(id)` and `refs.dynamic(id)`.

So declare inputs first, then formulas. A reference to a later or unknown column is a type error. A reference to a column that `select` excluded throws when the file is written; exclude the formula too, or don't exclude its inputs.

## Sub-rows: refs.column vs row.series

When array accessors expand a row into several worksheet rows:

| You want                                    | Use                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| a value per worksheet row (line total)      | `refs.column(id)` with `expansion: "expand"`                                         |
| one value per source row (order total)      | `row.series(id).sum()` with `expansion: "single"` (merged)                           |
| a summary over every worksheet cell         | `summary.formula(({ column }) => column.cells().sum())`                              |
| a summary where each source row counts once | `summary.formula(({ column }) => column.rows().average((row) => row.cells().sum()))` |

A single-value column referenced from a sub-row formula points at its first (merged) cell. See [data shapes](data-shapes.md#one-to-many-a-list-per-row) for a full order example.

## Summary rows (report mode)

Each column returns a list; item _n_ goes in summary row _n_. Columns without `summary` leave their cells empty.

```ts
import { createExcelSchema } from "typed-xlsx";

type Sale = { region: string; units: number; revenue: number; cost: number };

export const sales = createExcelSchema<Sale>()
  .column("region", {
    header: "Region",
    accessor: "region",
    summary: (s) => [s.label("Total"), s.label("Average"), s.label("Margin")],
  })
  .column("units", {
    header: "Units",
    accessor: "units",
    summary: (s) => [s.formula("sum"), s.formula("average"), s.empty()],
  })
  .column("revenue", {
    header: "Revenue",
    accessor: "revenue",
    format: '"$"#,##0',
    summary: (s) => [
      s.formula("sum"),
      s.formula(({ column, fx }) => fx.round(column.cells().average(), 0)),
      s.cell({
        init: () => ({ revenue: 0, cost: 0 }),
        step: (acc, row) => ({ revenue: acc.revenue + row.revenue, cost: acc.cost + row.cost }),
        finalize: (acc) => (acc.revenue ? (acc.revenue - acc.cost) / acc.revenue : 0),
        style: { numFmt: "0.0%" },
      }),
    ],
  })
  .build();
```

- `s.formula("sum" | "average" | "count" | "min" | "max")`, or a callback with `{ column, fx }`: a live formula over the data range.
- `s.cell({ init, step, finalize })`: a value computed in TypeScript, across several fields. Works when streaming.
- `s.label(text | ({ ctx }) => text)`, `s.empty()` (styled blank), `s.spacer()` (unstyled gap).
- Each takes `style`, and formula and cell summaries take `conditionalStyle` (condition context `({ cell, fx })`, e.g. `cell.current().lt(0)`).
- A summary keeps the column's number format. Set `style: { numFmt }` on it only to show it differently (a count under a currency column).

`s.cell` can aggregate per group, then pick by context, for example per currency:

```ts
import { createExcelSchema } from "typed-xlsx";

type Fee = { amount: number; currency: "EUR" | "USD" };

export const fees = createExcelSchema<Fee, { currency: "EUR" | "USD" }>()
  .column("amount", {
    accessor: "amount",
    summary: (s) => [
      s.cell<Partial<Record<Fee["currency"], number>>>({
        init: () => ({}),
        step: (totals, row) => ({
          ...totals,
          [row.currency]: (totals[row.currency] ?? 0) + row.amount,
        }),
        finalize: (totals, { ctx }) => totals[ctx.currency] ?? 0,
      }),
    ],
  })
  .build();
```

## Totals row (excel-table mode)

Set `totalsRow: true` on the table, and per column `totalsRow: { function }` or `{ label }`. Functions: `sum`, `average`, `count`, `countNums`, `min`, `max`, `stdDev`, `var`. They use `SUBTOTAL`, so they follow the reader's filters.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Order = { id: string; customer: string; amount: number };

const orders = createExcelSchema<Order>({ mode: "excel-table" })
  .column("id", { header: "Order", accessor: "id", totalsRow: { label: "Total" } })
  .column("customer", {
    header: "Customer",
    accessor: "customer",
    totalsRow: { function: "count" },
  })
  .column("amount", {
    header: "Amount",
    accessor: "amount",
    format: "#,##0.00",
    totalsRow: { function: "sum" },
  })
  .build();

createWorkbook().sheet("Orders").table("orders", { schema: orders, rows: [], totalsRow: true });
```

## Formulas that read the context

`ctx` is available in `formula`. Use it to embed an export-time constant, such as a rate:

```ts
import { createExcelSchema } from "typed-xlsx";

export const converted = createExcelSchema<{ amountEur: number }, { usdRate: number }>()
  .column("amountEur", { header: "EUR", accessor: "amountEur" })
  .column("amountUsd", {
    header: "USD",
    formula: ({ refs, ctx }) => refs.column("amountEur").mul(ctx.usdRate),
    format: '"$"#,##0.00',
  })
  .build();
```

The rate is written into every formula. If readers should be able to change it, make it a column (`accessor: () => rate`, unlocked) and reference it with `refs.column`. Formulas can't reference cells outside their own table.

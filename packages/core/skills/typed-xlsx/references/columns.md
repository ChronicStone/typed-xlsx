# Columns

## Contents

- [Column options](#column-options)
- [From row to cell](#from-row-to-cell)
- [Widths](#widths)
- [Conditional columns](#conditional-columns)
- [Groups](#groups)
- [Dynamic columns](#dynamic-columns)
- [Badges](#badges)
- [Checkboxes](#checkboxes)
- [Hyperlinks](#hyperlinks)
- [Data validation](#data-validation)
- [Sparklines](#sparklines)
- [Images](#images)

## Column options

`.column(id, options)`. The id must be unique in the schema; it is how formulas, `select`, charts and pivots refer to the column. The header defaults to the id.

| Option                                       | Type                                                              | Purpose                                                             |
| -------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `header`                                     | `string \| ({ ctx }) => string`                                   | header text                                                         |
| `accessor`                                   | path or `(row) => value`                                          | where the value comes from                                          |
| `transform`                                  | `({ value, row, rowIndex, ctx }) => value`                        | reshape the value                                                   |
| `defaultValue`                               | cell value                                                        | used when the value is `null` or `undefined`                        |
| `formula`                                    | `({ refs, fx, row, ctx }) => …`                                   | write an Excel formula instead of a value ([formulas](formulas.md)) |
| `format`                                     | number format, or `({ row, ctx }) => string`                      | shorthand for `style.numFmt`                                        |
| `style`                                      | `CellStyle \| ({ row, rowIndex, subRowIndex, ctx }) => CellStyle` | body cell style ([styling](styling.md))                             |
| `headerStyle`                                | `CellStyle`                                                       | header cell style                                                   |
| `conditionalStyle`                           | builder                                                           | native conditional formats                                          |
| `summary`                                    | `(s) => [...]`                                                    | summary rows, report mode                                           |
| `totalsRow`                                  | `{ function } \| { label }`                                       | totals row, excel-table mode                                        |
| `validation`                                 | builder                                                           | native data validation                                              |
| `hyperlink`                                  | string, object or function                                        | link on the cell                                                    |
| `expansion`                                  | `"auto" \| "single" \| "expand"`                                  | where a formula goes on sub-rows                                    |
| `width`, `minWidth`, `maxWidth`, `autoWidth` | numbers, boolean                                                  | column width in characters                                          |
| `condition`                                  | `({ ctx }) => boolean`                                            | include the column for this export                                  |
| `type`                                       | `"badge" \| "checkbox" \| "sparkline" \| "image"`                 | a cell type, with its own options                                   |

A column has an `accessor` or a `formula`, not both. Options that don't fit the column kind are type errors.

## From row to cell

`accessor` → `transform` → `defaultValue` → `format` and `style`.

```ts
import { createExcelSchema } from "typed-xlsx";

type Employee = {
  firstName: string;
  lastName: string;
  plan: "starter" | "pro";
  department: string | null;
  salary: number;
};

const planLabels = { starter: "Starter", pro: "Pro" } as const;

export const employees = createExcelSchema<Employee>()
  .column("name", { header: "Employee", accessor: (row) => `${row.firstName} ${row.lastName}` })
  .column("plan", { accessor: "plan", transform: ({ value }) => planLabels[value] })
  .column("department", { accessor: "department", defaultValue: "Unassigned" })
  .column("salary", { accessor: "salary", format: '"$"#,##0' })
  .build();
```

`transform` receives the accessor's value with its type, so a typo on `value.` is caught. Its return type becomes the column's value type, which charts and pivots check (a transform that returns text makes the column non-numeric).

## Widths

Columns size to their longest value. `width` fixes it; `minWidth` and `maxWidth` bound the measured width. Measuring ignores wrapping, so wrapped text needs a `maxWidth`.

```ts
import { createExcelSchema } from "typed-xlsx";

export const notes = createExcelSchema<{ title: string; body: string }>()
  .column("title", { accessor: "title", minWidth: 20 })
  .column("body", {
    accessor: "body",
    maxWidth: 60,
    style: { alignment: { wrapText: true, vertical: "top" } },
  })
  .build();
```

## Conditional columns

`condition` decides from the context whether the column exists in this export. It runs once per table. Use it for permissions and feature flags. Groups and dynamic blocks take `condition` in their options object.

```ts
import { createExcelSchema } from "typed-xlsx";

type Deal = { owner: string; amount: number; cost: number };
type Context = { role: "admin" | "sales" };

export const deals = createExcelSchema<Deal, Context>()
  .column("owner", { accessor: "owner" })
  .column("amount", { accessor: "amount" })
  .column("cost", { accessor: "cost", condition: ({ ctx }) => ctx.role === "admin" })
  .build();
```

## Groups

`.group(id, options?, build)` puts columns under a shared header row (report mode; excel-tables keep one flat header row). Formulas can aggregate a group with `fx.sum(refs.group(id))`, `select` can include or exclude it by id.

```ts
import { createExcelSchema } from "typed-xlsx";

type Row = { name: string; q1: number; q2: number; q3: number; q4: number };

export const quarters = createExcelSchema<Row>()
  .column("name", { header: "Account", accessor: "name" })
  .group("quarters", { header: "Revenue" }, (group) => {
    group.column("q1", { header: "Q1", accessor: "q1" });
    group.column("q2", { header: "Q2", accessor: "q2" });
    group.column("q3", { header: "Q3", accessor: "q3" });
    group.column("q4", { header: "Q4", accessor: "q4" });
  })
  .column("year", { header: "Year", formula: ({ refs, fx }) => fx.sum(refs.group("quarters")) })
  .build();
```

## Dynamic columns

`.dynamic(id, options?, (builder, { ctx }) => …)` generates columns from the context at export time. See [data shapes](data-shapes.md#wide-data-columns-known-at-export-time) for a full example with totals and a sparkline.

When the generated columns' callbacks need the context, use the callback's own `ctx` rather than the outer one: `header: ({ ctx }) => ctx.t("total")`.

## Badges

A styled value per state. Variant keys are matched against `String(value)`; with a literal union, every member needs a variant unless `defaultVariant` is set. A variant is a `CellStyle`, or `{ label, style }` to display different text. `label` can be a function of `{ row, value, ctx }`.

```ts
import { createExcelSchema } from "typed-xlsx";

type Ticket = { id: string; status: string };

export const tickets = createExcelSchema<Ticket>()
  .column("id", { accessor: "id" })
  .column("status", {
    type: "badge",
    accessor: "status",
    variants: {
      blocked: {
        label: "Blocked",
        style: {
          fill: { color: { rgb: "FEE2E2" } },
          font: { color: { rgb: "991B1B" }, bold: true },
        },
      },
      done: {
        label: "Done",
        style: {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        },
      },
    },
    defaultVariant: {
      style: { fill: { color: { rgb: "F1F5F9" } }, font: { color: { rgb: "475569" } } },
    },
  })
  .build();
```

## Checkboxes

`type: "checkbox"` needs a boolean accessor and writes a native checkbox cell (`TRUE`/`FALSE`, empty for null). Later formulas can read it: `fx.if(refs.column("done").eq(true), "Done", "Open")`. To let readers toggle some checkboxes and not others, set `style: { protection: { locked: false } }` on the editable ones and protect the sheet.

## Hyperlinks

The cell keeps its value; `hyperlink` adds the link. Return `null` for rows without one. Internal links use `#'Sheet name'!A1`.

```ts
import { createExcelSchema } from "typed-xlsx";

type Customer = { id: string; name: string; email: string | null };
type Context = { appUrl: string };

export const customers = createExcelSchema<Customer, Context>()
  .column("name", {
    accessor: "name",
    hyperlink: ({ row, ctx }) => ({ target: `${ctx.appUrl}/customers/${row.id}`, tooltip: "Open" }),
  })
  .column("email", {
    accessor: "email",
    hyperlink: ({ row }) => (row.email ? `mailto:${row.email}` : null),
  })
  .build();
```

## Data validation

Native Excel rules that stay active in the file: dropdowns, number and date ranges, custom formulas. Kinds: `list([...])`, `integer()`, `decimal()`, `date()`, `textLength()`, `custom(({ refs, fx }) => condition)`. Comparisons: `between`, `notBetween`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`. Then `.allowBlank()`, `.prompt({ title, message })`, `.error({ title, message })`.

```ts
import { createExcelSchema } from "typed-xlsx";

type Plan = { account: string; status: "draft" | "active"; seats: number; target: number };

export const plans = createExcelSchema<Plan>()
  .column("account", { accessor: "account" })
  .column("status", {
    accessor: "status",
    validation: (v) =>
      v.list(["draft", "active"]).error({ title: "Status", message: "Pick a status" }),
  })
  .column("seats", { accessor: "seats", validation: (v) => v.integer().between(1, 500) })
  .column("target", {
    accessor: "target",
    validation: (v) => v.custom(({ refs }) => refs.column("target").gte(refs.column("seats"))),
  })
  .build();
```

Custom rules follow the formula rules: they can reference the column itself and earlier columns.

## Sparklines

A small chart in the cell, drawn by Excel from earlier numeric columns of the same row. `source` is a list of ids, a range `{ from, to }`, a `{ group }` or a `{ dynamic }`. `sparklineType`: `"line"` (default), `"column"`, `"winLoss"`. Set the table option `defaults: { rowHeight: 30 }` to give them room.

```ts
import { createExcelSchema } from "typed-xlsx";

type Row = { account: string; jan: number; feb: number; mar: number };

export const trend = createExcelSchema<Row>()
  .column("account", { accessor: "account" })
  .column("jan", { accessor: "jan" })
  .column("feb", { accessor: "feb" })
  .column("mar", { accessor: "mar" })
  .column("trend", {
    type: "sparkline",
    source: { from: "jan", to: "mar" },
    width: 18,
    style: { line: { color: "#2563EB" }, high: { color: "#16A34A" }, low: { color: "#DC2626" } },
  })
  .build();
```

## Images

`type: "image"` embeds PNG or JPEG bytes (`Uint8Array`) from the accessor. `source: "url"` writes Excel's `IMAGE()` formula instead, which needs a public HTTPS URL and a recent Excel. Options: `alt` (text, a row path, or a function), `size: { width, height }` in pixels, `fit`, and for embedded images `padding` and `mediaType`.

```ts
import { createExcelSchema } from "typed-xlsx";

type Product = { name: string; thumbnail?: Uint8Array; photoUrl: string };

export const catalog = createExcelSchema<Product>()
  .column("thumbnail", {
    type: "image",
    accessor: "thumbnail",
    alt: "name",
    size: { width: 48, height: 48 },
  })
  .column("photo", {
    type: "image",
    source: "url",
    accessor: "photoUrl",
    size: { width: 48, height: 48 },
  })
  .column("name", { accessor: "name" })
  .build();
```

typed-xlsx does not fetch or resize images. Fetch and shrink them before building rows; identical bytes are stored once.

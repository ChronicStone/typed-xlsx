---
name: typed-xlsx
description: Build Excel (.xlsx) reports and exports in TypeScript with typed-xlsx. Use when code imports typed-xlsx, or when the task is to export data to Excel, build a spreadsheet report, add columns, totals, formulas, styles, charts or pivot tables to one, or stream a large export. Covers turning any data shape into a sheet, multi-sheet workbooks, dashboards, i18n and role-based exports, and reading typed-xlsx type errors.
---

# typed-xlsx

typed-xlsx writes `.xlsx` files from a typed schema. You describe columns once against a row type, then render that schema into one or more tables on one or more sheets. TypeScript checks every column against the row type: accessor paths, formula references, chart and pivot fields.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Invoice = { id: string; customer: { name: string }; qty: number; unitPrice: number };

const invoices = createExcelSchema<Invoice>()
  .column("id", { header: "Invoice", accessor: "id" })
  .column("customer", { header: "Customer", accessor: "customer.name" })
  .column("qty", { header: "Qty", accessor: "qty" })
  .column("unitPrice", { header: "Unit price", accessor: "unitPrice", format: '"$"#,##0.00' })
  .column("total", {
    header: "Total",
    formula: ({ refs }) => refs.column("qty").mul(refs.column("unitPrice")),
    format: '"$"#,##0.00',
    summary: (s) => [s.formula("sum")],
  })
  .build();

const rows: Invoice[] = [];
const workbook = createWorkbook();
workbook
  .sheet("Invoices", { freezePane: { rows: 1 } })
  .table("invoices", { schema: invoices, rows });
const bytes = workbook.toUint8Array();
```

## How to build a report

1. **Name the row type first.** One row object per entity the reader thinks of as "a line" (an invoice, an account, a month). Shape it in your data layer before the schema; see [data shapes](references/data-shapes.md). Keep numbers as `number` and dates as `Date`, never preformatted strings: formatting is the schema's job.
2. **Pick the schema mode.** `createExcelSchema<Row>()` is a _report_: titles, grouped headers, summary rows, sub-rows for arrays. `createExcelSchema<Row>({ mode: "excel-table" })` is a native Excel table: filters, banding, a totals row, structured references. Pick excel-table when readers will sort, filter or pivot the data themselves; report when they read it.
3. **Pick the builder.** `createWorkbook()` takes all rows at once and is synchronous. `createWorkbookStream()` takes batches with `await table.commit({ rows })` and keeps memory low. Use the stream for database cursors, paginated APIs, or exports too large to hold in memory at once. The schema is the same for both.
4. **Declare export-time inputs as context.** Locale, translator, currency, the user's role, the months to show: `createExcelSchema<Row, Context>()`. Every callback receives `ctx`, and every table built from the schema must pass `context`.
5. **Write the columns**, then compose the workbook: sheets, tables, charts, pivots.
6. **Verify.** Run the type checker, then generate the file once with sample rows and check it opens. Several rules are only checked when the file is written (see [rules](#rules-that-throw-when-writing)).

## Choosing the technique for each column

| The data or the need                                                              | Use                                                                         | Reference                                            |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| A field, or a nested field                                                        | `accessor: "customer.name"`                                                 | [columns](references/columns.md)                     |
| A value derived from several fields                                               | `accessor: (row) => …`                                                      | [columns](references/columns.md)                     |
| Reformat a value (enum label, translation)                                        | `transform: ({ value, ctx }) => …`                                          | [columns](references/columns.md)                     |
| A value that must update when the reader edits the sheet                          | `formula: ({ refs, fx }) => …`                                              | [formulas](references/formulas.md)                   |
| An array per row (order lines, monthly amounts)                                   | accessor returning an array: one worksheet row per item, other cells merged | [data shapes](references/data-shapes.md)             |
| Columns known only at export time (months, regions, currencies, survey questions) | `.dynamic(id, (builder, { ctx }) => …)`                                     | [data shapes](references/data-shapes.md)             |
| Columns under a shared header                                                     | `.group(id, { header }, (g) => …)`                                          | [columns](references/columns.md)                     |
| A column only some users may see                                                  | `condition: ({ ctx }) => …`                                                 | [columns](references/columns.md)                     |
| The same schema, fewer columns per export                                         | `select: { include }` or `{ exclude }` on the table                         | [workbook](references/workbook.md)                   |
| Totals, averages, counts under the data                                           | `summary` (report) or `totalsRow` (excel-table)                             | [formulas](references/formulas.md)                   |
| A status with colors                                                              | `type: "badge"` with `variants`                                             | [columns](references/columns.md)                     |
| A boolean                                                                         | `type: "checkbox"`, or `transform` to Yes/No text                           | [columns](references/columns.md)                     |
| A trend per row                                                                   | `type: "sparkline"` over earlier numeric columns                            | [columns](references/columns.md)                     |
| A link, a dropdown, a picture                                                     | `hyperlink`, `validation`, `type: "image"`                                  | [columns](references/columns.md)                     |
| Highlight decided in TypeScript                                                   | `style: ({ row }) => …`                                                     | [styling](references/styling.md)                     |
| Highlight that follows edits in Excel                                             | `conditionalStyle`                                                          | [styling](references/styling.md)                     |
| A chart or a pivot table                                                          | `.chart()`, `.pivot()` on the workbook chain                                | [charts and pivots](references/charts-and-pivots.md) |
| Several tables on a sheet, dashboards                                             | several `.table()` calls, `tablesPerRow`                                    | [workbook](references/workbook.md)                   |
| Large exports, HTTP responses, S3                                                 | `createWorkbookStream()`                                                    | [streaming](references/streaming.md)                 |
| Organizing many reports in an app                                                 | schema modules, shared context, helpers                                     | [architecture](references/architecture.md)           |

Complete worked reports are in [recipes](references/recipes.md).

## Computed in TypeScript or live in Excel

Each computed value can take either path, column by column:

- **TypeScript, at export time**: accessor functions, `transform`, `style` callbacks, `summary.cell()` reducers. Any JavaScript works (lookups, dates, your helpers). The file holds plain values.
- **Excel, live**: `formula`, `summary.formula()`, `conditionalStyle`, `validation`. The file holds real formulas that recalculate when someone edits a cell.

Use formulas when the sheet is a working document (people change inputs) or when readers expect to see how a number is computed. Use TypeScript for everything else; it is simpler and can use data that is not in the sheet.

## Rules the type checker enforces

- Accessor paths must exist on the row type and hold a cell value (string, number, boolean, `Date`, null, undefined). An object or an array of objects is not a cell.
- `refs.column(id)` only accepts columns declared **earlier** in the chain. Declare inputs first, formulas after.
- Options must fit the column kind: `variants` only on badges, `totalsRow` only on excel-table schemas, `summary` only on reports.
- `select` only accepts declared column, group and dynamic ids.
- A schema with a context type needs `context` on every table, even when `select` drops the columns that use it.
- Chart `y` and pivot sums need numeric columns. Charts and pivots only see tables declared earlier in the same chain.

typed-xlsx reports errors on the key at fault and lists what would fit. Read the message: it names the valid fields, options or columns. See [errors](references/errors.md).

## Rules that throw when writing

- A formula references a column that `select` excluded.
- An excel-table schema has an array accessor (no sub-rows in native tables), or a formula column on sub-rows.
- A chart or pivot reads a table that expands sub-rows.
- A sheet would exceed 1,048,576 rows. Split large exports across sheets ([streaming](references/streaming.md)).
- A sheet would need more than 16,384 columns, a cell holds more than 32,767 characters, or two excel tables share a name (ignoring case) or a header.
- Two columns of one table share an id (for example a dynamic block generates `status` and a static column is already `status`).
- An inline dropdown list is over 255 characters or has an item with a comma, or a validation title (32) or message (255) is too long.
- A cell value is `NaN`, `Infinity`, an invalid or out-of-range `Date`, or an object such as a Decimal.
- A stream workbook gets a second output call (`writeToFile`, `pipeTo`, …). Call exactly one.
- A sparkline source column was excluded by `select`.

## Pitfalls

- **Strings that should be numbers.** Database decimals often arrive as strings (`"12.50"`). Convert them in the accessor (`Number(row.amount)`), or sums and charts see text.
- **Formatting in the accessor.** Returning `"$1,200.00"` or `"2026-01-31"` writes text. Return the number or `Date` and set `format` / `style.numFmt`.
- **Percentages.** Excel's `0%` format multiplies by 100. Store `0.25` for 25%.
- **`condition` vs `select`.** `condition` is decided by context inside the schema (permissions, feature flags). `select` is decided by the caller per table. Both remove the column entirely.
- **Widths.** Columns size to their longest value. Long text needs `maxWidth` plus `style: { alignment: { wrapText: true } }`.
- **Dynamic column ids** must be unique and stable; derive them from data keys (`month-${n}`, `total-${currency}`), not labels.
- **Commit order in streams.** Await each `commit()` before the next on the same table. Declare stream pivots before the first commit.

## Output

| Builder                  | Methods                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `createWorkbook()`       | `toUint8Array()`, `toBuffer()`, `await writeToFile(path)`                                                              |
| `createWorkbookStream()` | `await writeToFile(path)`, `await pipeToNode(res)`, `toNodeReadable()`, `await pipeTo(writable)`, `toReadableStream()` |

HTTP content type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

## References

- [columns.md](references/columns.md): every column option and cell type
- [data-shapes.md](references/data-shapes.md): nested objects, arrays, one-to-many, wide and pivoted data, lookups, unions, money, i18n
- [formulas.md](references/formulas.md): formula DSL, row model, summary rows, totals rows
- [styling.md](references/styling.md): themes, cell styles, number formats, dynamic and conditional styles
- [workbook.md](references/workbook.md): sheets, tables, layout, selection, excel tables, protection
- [charts-and-pivots.md](references/charts-and-pivots.md): native charts and pivot tables
- [streaming.md](references/streaming.md): large exports, sheet splitting, outputs, memory
- [architecture.md](references/architecture.md): structuring reports in an application
- [recipes.md](references/recipes.md): complete reports to adapt
- [errors.md](references/errors.md): reading type errors

Full documentation: https://typed-xlsx.vercel.app/llms-full.txt

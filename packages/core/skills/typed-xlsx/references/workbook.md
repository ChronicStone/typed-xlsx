# Workbooks, sheets and tables

## Contents

- [Structure](#structure)
- [Table options](#table-options)
- [Sheet options](#sheet-options)
- [Several tables on a sheet](#several-tables-on-a-sheet)
- [Column selection](#column-selection)
- [Excel tables](#excel-tables)
- [Protection and editable sheets](#protection-and-editable-sheets)

## Structure

A workbook holds sheets, a sheet holds tables, a table is a schema plus rows. Schemas are plain immutable objects: define them in their own module and reuse them across workbooks.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Order = { id: string; total: number };
type Product = { sku: string; stock: number };

const orders = createExcelSchema<Order>()
  .column("id", { header: "Order", accessor: "id" })
  .column("total", { header: "Total", accessor: "total", format: '"$"#,##0.00' })
  .build();

const products = createExcelSchema<Product>()
  .column("sku", { header: "SKU", accessor: "sku" })
  .column("stock", { header: "In stock", accessor: "stock" })
  .build();

export async function exportAll(orderRows: Order[], productRows: Product[]) {
  const workbook = createWorkbook();
  workbook
    .sheet("Orders", { freezePane: { rows: 1 } })
    .table("orders", { schema: orders, rows: orderRows });
  workbook.sheet("Inventory").table("products", { schema: products, rows: productRows });
  await workbook.writeToFile("./export.xlsx");
}
```

`.sheet()` returns the sheet, and `.table()` on a buffered sheet returns the sheet again, so calls chain. Charts and pivots need one unbroken chain from the tables they read (see [charts and pivots](charts-and-pivots.md)).

## Table options

`.table(id, options)`. Table ids are unique per sheet.

| Option                       | Purpose                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `schema`                     | the schema                                                                            |
| `rows`                       | the rows (buffered builder; streams use `commit`)                                     |
| `context`                    | required when the schema declares a context type                                      |
| `title`                      | a title row above the headers, text or `({ ctx }) => text` (report mode)              |
| `select`                     | `{ include: [...] }` or `{ exclude: [...] }`: column, group or dynamic ids            |
| `theme`                      | overrides the schema's theme for this table                                           |
| `defaults`                   | header, summary and body defaults, `rowHeight` ([styling](styling.md#table-defaults)) |
| `autoFilter`                 | filter buttons (off for reports, on for excel-tables)                                 |
| `name`, `style`, `totalsRow` | excel-table mode only                                                                 |

## Sheet options

| Option                                          | Purpose                                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `freezePane: { rows, columns }`                 | keep the header (and id columns) visible. Counts worksheet rows: with a `title`, the header is row 2 |
| `tablesPerRow`, `tableColumnGap`, `tableRowGap` | layout of several tables                                                                             |
| `rightToLeft`                                   | mirrored sheet for RTL languages                                                                     |
| `protection`                                    | `true` or permissions                                                                                |

`createWorkbook({ protection: { password, structure: true } })` locks the tab structure.

## Several tables on a sheet

Tables stack top to bottom, one empty row apart. With `tablesPerRow`, they fill each row of the layout left to right: KPI blocks, a dashboard of small tables, sections side by side.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Kpi = { metric: string; value: number };

const kpis = createExcelSchema<Kpi>()
  .column("metric", { header: "Metric", accessor: "metric" })
  .column("value", { header: "Value", accessor: "value", format: "#,##0" })
  .build();

createWorkbook()
  .sheet("Dashboard", { tablesPerRow: 3, tableColumnGap: 1, tableRowGap: 2 })
  .table("revenue", { title: "Revenue", schema: kpis, rows: [{ metric: "MRR", value: 48000 }] })
  .table("customers", {
    title: "Customers",
    schema: kpis,
    rows: [{ metric: "Active", value: 312 }],
  })
  .table("support", {
    title: "Support",
    schema: kpis,
    rows: [{ metric: "Open tickets", value: 17 }],
  });
```

Different schemas can share a sheet; each table keeps its own headers and summary rows. Stacked tables share worksheet columns, so give them similar column widths or place them side by side.

## Column selection

One schema, several exports. `select` takes ids declared with `.column()`, `.group()` or `.dynamic()`:

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type User = { name: string; email: string; internalNote: string };

const users = createExcelSchema<User>()
  .column("name", { accessor: "name" })
  .column("email", { accessor: "email" })
  .column("internalNote", { accessor: "internalNote" })
  .build();

const workbook = createWorkbook();
workbook
  .sheet("Public")
  .table("public", { schema: users, rows: [], select: { exclude: ["internalNote"] } });
workbook
  .sheet("Contacts")
  .table("contacts", { schema: users, rows: [], select: { include: ["name", "email"] } });
```

When the caller decides the columns at runtime (a user picks them in your UI), type the list with `SchemaColumnId<typeof schema>` and validate the input against it.

## Excel tables

`createExcelSchema<Row>({ mode: "excel-table" })` writes a native table (Ctrl+T in Excel): filter and sort buttons, banded rows, a totals row, structured references that survive sorting and inserted rows. Power Query and pivots read it by name.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Deal = { id: string; stage: string; amount: number };

const deals = createExcelSchema<Deal>({ mode: "excel-table" })
  .column("id", { header: "Deal", accessor: "id", totalsRow: { label: "Total" } })
  .column("stage", { header: "Stage", accessor: "stage" })
  .column("amount", {
    header: "Amount",
    accessor: "amount",
    format: "#,##0",
    totalsRow: { function: "sum" },
  })
  .build();

createWorkbook().sheet("Pipeline").table("deals", {
  schema: deals,
  rows: [],
  name: "Pipeline",
  style: "TableStyleMedium2",
  totalsRow: true,
});
```

- `style`: `TableStyleLight1`–`21`, `TableStyleMedium1`–`28`, `TableStyleDark1`–`11`. Column styles apply on top.
- No summary rows (use `totalsRow`), no sub-rows (flatten first), one header row (groups stay flat).
- Table `name` must be unique in the workbook; it defaults to the table id.

## Protection and editable sheets

Every cell is locked by default, but locking only applies on a protected sheet. To make an input sheet: unlock the input columns, hide formulas you don't want shown, protect the sheet.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Renewal = { account: string; target: number };

const renewals = createExcelSchema<Renewal>()
  .column("account", { accessor: "account" })
  .column("target", { accessor: "target", style: { protection: { locked: false } } })
  .column("uplift", {
    formula: ({ refs }) => refs.column("target").mul(0.08),
    style: { protection: { hidden: true } },
  })
  .build();

createWorkbook()
  .sheet("Renewals", {
    protection: { password: "ops", selectLockedCells: false, sort: true, autoFilter: true },
  })
  .table("renewals", {
    schema: renewals,
    rows: [],
    defaults: { cells: { unlocked: { preset: "cell.input" } } },
  });
```

Sheet passwords deter accidental edits; they are not encryption.

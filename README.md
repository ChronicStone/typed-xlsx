# xlsmith

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

Type-safe, schema-driven Excel reporting for TypeScript.

Define one schema, then generate polished buffered exports or stream large workbooks with the same API.

If the export definition is wrong, the compiler tells you before the spreadsheet does.

Previously published as `@chronicstone/typed-xlsx`. The package has been renamed to `xlsmith`.

```bash
npm install xlsmith
```

```ts
// before
import { createExcelSchema, createWorkbook } from "@chronicstone/typed-xlsx";

// after
import { createExcelSchema, createWorkbook } from "xlsmith";
```

- One schema API for buffered exports and streaming exports
- Report mode for custom layouts, summaries, and sub-row expansion
- Excel table mode for native tables, totals rows, autoFilter, and structured refs
- Full comparison against SheetJS and ExcelJS: [Why xlsmith?](https://xlsmith.vercel.app/getting-started/comparison)

[![Executive Board Pack](./apps/docs/public/images/marketing/board-overview.png)](https://xlsmith.vercel.app/playground/executive-board-pack)

## Why xlsmith

Most XLSX libraries give you a cell API. `xlsmith` gives you a schema API.

- Define columns against your row type with typed path accessors and callback accessors
- Reference columns by ID in formulas instead of hard-coding fragile cell addresses
- Reuse one schema across buffered exports and streaming exports
- Choose between report mode and native Excel table mode without changing the authoring model
- Generate polished workbooks with summaries, grouped headers, sub-row expansion, validation, and conditional styles

If you are currently evaluating `xlsmith` against lower-level spreadsheet libraries, read the full comparison with SheetJS and ExcelJS:

- [Why xlsmith? Full comparison](https://xlsmith.vercel.app/getting-started/comparison)

## Why not ExcelJS / SheetJS?

Choose `xlsmith` when your main job is generating typed reports from application data, not manually editing spreadsheets cell by cell.

- `xlsmith`: best when you want a schema-first API for report generation, typed formulas, native Excel tables, and streaming with the same authoring model
- `ExcelJS`: best when you need lower-level workbook editing and ad hoc worksheet manipulation
- `SheetJS`: best when you need parsing, format conversion, or broad spreadsheet interoperability

Read the full tradeoffs and feature matrix here:

- [xlsmith vs ExcelJS vs SheetJS](https://xlsmith.vercel.app/getting-started/comparison)

## Use xlsmith when

`xlsmith` is a strong fit when you need to generate Excel files from structured TypeScript data such as:

- financial and operations reports
- SaaS admin exports
- customer success and renewal planning workbooks
- quote review and approval workbooks
- large scheduled exports that need bounded memory usage

## Do not use xlsmith when

Reach for a lower-level spreadsheet library when you need to:

- read or modify existing `.xlsx` files
- embed charts or worksheet images
- support spreadsheet formats beyond `.xlsx`
- do highly manual cell-by-cell spreadsheet editing

## The Core API

Three functions cover the main surface:

- `createExcelSchema()` describes columns, formulas, summaries, styles, groups, and validation
- `createWorkbook()` builds buffered workbooks for small and medium exports
- `createWorkbookStream()` commits row batches for large exports with much flatter memory usage

The same schema works with both builders.

## Quick Example

```ts
import { createExcelSchema, createWorkbook } from "xlsmith";

type Invoice = { id: string; qty: number; unitPrice: number };

const schema = createExcelSchema<Invoice>()
  .column("id", { header: "Invoice #", accessor: "id" })
  .column("qty", { header: "Qty", accessor: "qty" })
  .column("unitPrice", {
    header: "Unit Price",
    accessor: "unitPrice",
    style: { numFmt: "$#,##0.00" },
  })
  .column("total", {
    header: "Total",
    formula: ({ refs, fx }) => fx.round(refs.column("qty").mul(refs.column("unitPrice")), 2),
    style: { numFmt: "$#,##0.00" },
    summary: (s) => [s.formula("sum")],
  })
  .build();

const rows: Invoice[] = [{ id: "INV-001", qty: 3, unitPrice: 49.99 }];

const workbook = createWorkbook();

workbook.sheet("Invoices", { freezePane: { rows: 1 } }).table("invoices", {
  rows,
  schema,
});

await workbook.writeToFile("./invoices.xlsx");
```

## What Makes It Different

### Type-safe schemas

Column accessors are verified against your row type. Dot-path accessors and callback accessors both preserve inference.

### Formula DSL with typed references

`refs.column("subtotal")` is checked at definition time. If a formula references a column that does not exist yet, TypeScript fails before export.

### One schema, two output paths

Use the exact same schema with:

- `createWorkbook()` for buffered composition
- `createWorkbookStream()` for async batch commits

### Two schema modes

- report mode for summary rows, sub-row expansion, grouped headers, and custom report layouts
- excel-table mode for native Excel tables with autoFilter, totals rows, structured references, and table styles

### Zero runtime dependencies

The package ships its own OOXML serializer and ZIP engine. No SheetJS. No ExcelJS.

For the detailed tradeoffs, feature matrix, and cases where the alternatives still win:

- [Compare xlsmith vs SheetJS and ExcelJS](https://xlsmith.vercel.app/getting-started/comparison)

## Real Workbook Outputs

Each screenshot links to the full artifact in the playground.

### Board-ready multi-sheet reporting

Best for stakeholder and executive exports.

[![Executive Board Pack](./apps/docs/public/images/marketing/board-overview.png)](https://xlsmith.vercel.app/playground/executive-board-pack)

### Runtime-driven column matrices

Generate columns from typed runtime context while formulas and totals stay readable.

[![Territory Performance Matrix](./apps/docs/public/images/marketing/dynamic-matrix.png)](https://xlsmith.vercel.app/playground/territory-performance-matrix)

### Streaming exports at production scale

The schema stays the same while the builder switches to batch commits.

[![Streaming Fulfillment Export](./apps/docs/public/images/marketing/streaming-fulfillment.png)](https://xlsmith.vercel.app/playground/streaming-fulfillment-export)

### Editable workflow-safe workbooks

Unlock inputs, validate user edits, and keep logic columns protected.

[![Renewal Ops Workbook](./apps/docs/public/images/marketing/workflow-safe-renewals.png)](https://xlsmith.vercel.app/playground/renewal-ops-workbook)

### Nested records without manual row math

Array-valued accessors expand logical rows into multiple physical rows automatically.

[![Deal Desk Quote Review](./apps/docs/public/images/marketing/subrow-quote-review.png)](https://xlsmith.vercel.app/playground/deal-desk-quote-review)

## Buffered And Streaming

Use buffered mode when the dataset is already in memory and the export size is moderate.

```ts
import { createWorkbook } from "xlsmith";

const workbook = createWorkbook();

workbook.sheet("Orders", { freezePane: { rows: 1 } }).table("orders", {
  rows,
  schema,
});

await workbook.writeToFile("./orders.xlsx");
```

Use streaming mode when rows come from a cursor, paginated API, or a very large dataset.

```ts
import { createWorkbookStream } from "xlsmith";

const workbook = createWorkbookStream();

const table = await workbook.sheet("Orders", { freezePane: { rows: 1 } }).table("orders", {
  schema,
});

for await (const batch of cursor) {
  await table.commit({ rows: batch });
}

await workbook.writeToFile("./orders.xlsx");
```

## Report Mode Vs Excel Table Mode

Use report mode when you need:

- summary rows
- sub-row expansion
- grouped headers
- more custom report layouts

Use excel-table mode when you need:

- native Excel filter and sort dropdowns
- totals rows
- structured references such as `[@Revenue]`
- true Excel table behavior for downstream spreadsheet workflows

```ts
import { createExcelSchema, createWorkbook } from "xlsmith";

const schema = createExcelSchema<{ units: number; revenue: number }>({ mode: "excel-table" })
  .column("units", {
    header: "Units",
    accessor: "units",
    totalsRow: { function: "sum" },
  })
  .column("revenue", {
    header: "Revenue",
    accessor: "revenue",
    totalsRow: { function: "sum" },
    style: { numFmt: '"$"#,##0.00' },
  })
  .column("avgPrice", {
    header: "Avg Price",
    formula: ({ refs, fx }) =>
      fx.round(fx.safeDiv(refs.column("revenue"), refs.column("units")), 2),
    style: { numFmt: '"$"#,##0.00' },
    totalsRow: { label: "-" },
  })
  .build();

createWorkbook()
  .sheet("Forecast")
  .table("forecast", {
    rows: [{ units: 42, revenue: 8400 }],
    schema,
    name: "ForecastTable",
    style: "TableStyleMedium2",
    autoFilter: true,
    totalsRow: true,
  });
```

## Installation

```bash
pnpm add xlsmith
```

```bash
npm install xlsmith
```

```bash
yarn add xlsmith
```

```bash
bun add xlsmith
```

## Start Here

- [Introduction](https://xlsmith.vercel.app/getting-started/introduction)
- [Quick Start](https://xlsmith.vercel.app/getting-started/quick-start)
- [Comparison with SheetJS and ExcelJS](https://xlsmith.vercel.app/getting-started/comparison)
- [Schema Modes](https://xlsmith.vercel.app/core-concepts/schema-modes)
- [Buffered vs Streaming](https://xlsmith.vercel.app/core-concepts/buffered-vs-streaming)
- [Excel Table Mode](https://xlsmith.vercel.app/excel-table-mode/overview)
- [Streaming Overview](https://xlsmith.vercel.app/streaming/overview)
- [Playground and example artifacts](https://xlsmith.vercel.app/playground)

## License

[MIT](./LICENSE) License © 2023-PRESENT [Cyprien THAO](https://github.com/ChronicStone)

[npm-version-src]: https://img.shields.io/npm/v/xlsmith?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/xlsmith
[npm-downloads-src]: https://img.shields.io/npm/dm/xlsmith?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/xlsmith
[bundle-src]: https://img.shields.io/bundlephobia/minzip/xlsmith?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=xlsmith
[license-src]: https://img.shields.io/github/license/ChronicStone/xlsmith.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/ChronicStone/xlsmith/blob/main/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/xlsmith

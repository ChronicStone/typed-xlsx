# Excel Feature Roadmap

## Context

`typed-xlsx` no longer sits on top of SheetJS. It now owns the OOXML serialization and ZIP assembly pipeline directly, which unlocks Excel-native features that were previously hard or impossible to support cleanly.

The next wave of features should preserve the current DX strengths:

- type-safe schema builders
- reusable report definitions
- strong compile-time validation
- buffered and stream support
- minimal API surface complexity

Type-safety is the main product constraint.

## Current public surface

As of this roadmap, the library already supports:

- typed path accessors and callback accessors
- typed `transform` inference from accessor return values
- dynamic column groups with typed runtime context
- reducer-based summaries compatible with buffered and stream mode
- multi-value expansion into sub-rows
- static and row-based cell styling
- width / auto-width support
- buffered workbook builder
- stream workbook builder
- multi-table layout on buffered sheets
- sheet view options like freeze panes and RTL

Relevant implementation files:

- `packages/typed-xlsx/src/vnext/schema/builder.ts`
- `packages/typed-xlsx/src/vnext/planner/rows.ts`
- `packages/typed-xlsx/src/vnext/workbook/buffered.ts`
- `packages/typed-xlsx/src/vnext/workbook/stream.ts`
- `packages/typed-xlsx/src/vnext/ooxml/cells.ts`
- `packages/typed-xlsx/src/vnext/ooxml/worksheet.ts`
- `packages/typed-xlsx/src/vnext/ooxml/package.ts`

## Key architectural observation

The current engine is still centered around primitive cell values.

Today, planned and serialized cells are effectively limited to:

- `string`
- `number`
- `boolean`
- `Date`
- `null` / `undefined`

That means the current internals do not yet model:

- formula cells
- table metadata parts
- worksheet auto-filter metadata
- typed column-to-column references
- structured references for Excel tables

Because of that, the implementation order matters a lot. The safest path is to first introduce a richer internal cell model, then build formula support and metadata features on top of it.

## Ownership model

Keep a strict distinction between schema-level semantics and builder-level rendering semantics.

### Schema-level responsibilities

Schemas should remain reusable and render-target agnostic by default.

Schema-level concerns:

- column identity
- row extraction
- transforms
- styling and formatting
- formula-derived columns
- report summaries
- dynamic groups

### Builder-level responsibilities

Builder/table options should control rendering modes and Excel-native table features.

Builder-level concerns:

- native Excel table mode
- worksheet auto-filters
- Excel table totals row
- table naming and table style
- later: charts and other worksheet/table attachments

### Important distinction

There are two different footer concepts and they should stay separate.

1. `summary`
   - library-owned report footer system
   - works without native Excel tables
   - can support multiple rows
   - can be reducer-based or formula-based

2. `totalsRow`
   - Excel-owned native table footer row
   - only exists for native Excel tables
   - typically one row
   - should be configured on the table builder level

Example direction:

```ts
table({
  rows,
  schema,
  excelTable: {
    totalsRow: {
      label: { value: "TOTAL" },
      amount: { function: "sum" },
    },
  },
});
```

## Recommended milestone order

Prefer one branch per shippable milestone, not one branch per abstract phase.

### 1. Formula cell core

Branch idea: `feat/formula-cell-core`

Goal:

- introduce a richer internal cell model
- support formula cell serialization in OOXML
- keep public API unchanged at first if needed

Why first:

- formula summaries depend on it
- formula columns depend on it
- native table totals will eventually benefit from it
- charts will benefit from stable reference modeling later

Expected work:

- planner changes
- stream row expansion changes
- cell serialization changes
- tests for literal vs formula cell output

### 2. Worksheet auto-filter for current reports

Branch idea: `feat/worksheet-autofilter`

Goal:

- support auto-filters on current rendered tables without requiring native Excel tables

Why second:

- small user-facing win
- validates rendered range tracking
- useful for both normal reports and future native tables

Likely API:

```ts
workbook.sheet("Orders").table({
  id: "orders",
  rows,
  schema,
  autoFilter: true,
});
```

### 3. Formula-based report summaries

Branch idea: `feat/formula-summaries`

Goal:

- add schema-level formula summaries for normal report tables
- keep reducer summaries untouched

Why third:

- introduces reference-aware formulas in a constrained surface
- very useful without needing native Excel tables yet

Direction:

```ts
summary: (s) => [
  s.formula(({ column }) => column.cells().sum(), {
    style: { numFmt: "$#,##0.00" },
  }),
];
```

### 4. Formula-based columns

Branch idea: `feat/formula-columns`

Goal:

- allow a column to derive from predecessor columns through typed formula expressions

Why fourth:

- most important type-safety feature
- needs formula infrastructure first

Direction:

```ts
const schema = createExcelSchema<Order>()
  .column("qty", { accessor: "qty" })
  .column("unitPrice", { accessor: "unitPrice" })
  .column("lineTotal", {
    formula: ({ row }) => row.ref("qty").mul(row.ref("unitPrice")),
    style: { numFmt: "$#,##0.00" },
  })
  .build();
```

Type-safety rule:

- only allow references to predecessor columns, not forward references

### 5. Native Excel table core

Branch idea: `feat/excel-table-core`

Goal:

- support real Excel table parts and worksheet integration
- keep current report tables supported as-is

Why fifth:

- significantly more OOXML work
- easier once formulas and range tracking exist

Direction:

```ts
workbook.sheet("Orders").table({
  id: "orders",
  rows,
  schema,
  excelTable: {
    name: "OrdersTable",
    style: "TableStyleMedium2",
    autoFilter: true,
  },
});
```

### 6. Excel table totals row

Branch idea: `feat/excel-table-totals`

Goal:

- add builder-level `excelTable.totalsRow`
- type it against schema column ids

Why sixth:

- totals row is tied to native Excel table rendering, not generic schema semantics

Direction:

```ts
workbook.sheet("Orders").table({
  id: "orders",
  rows,
  schema,
  excelTable: {
    name: "OrdersTable",
    totalsRow: {
      customer: { value: "TOTAL" },
      qty: { function: "sum" },
      lineTotal: { function: "sum" },
    },
  },
});
```

### 7. Charts foundation

Branch idea: `feat/charts-foundation`

Goal:

- add chart parts only after table/range/formula references are stable

Why last:

- charts benefit from stable named ranges, native tables, or robust range modeling

## Type-safety principles

### 1. Distinguish row access from rendered-column references

These are different concepts.

- `accessor: "customer.name"` reads from source row data
- `row.ref("qty")` refers to another rendered column in the same row

Do not blur these into one API.

### 2. Prefer typed expression objects over raw formula strings

Avoid making the primary API stringly typed.

Prefer:

```ts
formula: ({ row }) => row.ref("qty").mul(row.ref("unitPrice"));
```

Over:

```ts
formula: () => "B2*C2";
```

Expression objects are easier to validate, safer to refactor, and compatible with future structured references.

### 3. Only allow predecessor references in formula columns

For the first version of typed formula columns, only allow references to previously defined columns. This keeps evaluation and typing deterministic.

### 4. Keep reducer summaries and formula summaries side by side

Do not replace the current summary system.

Both should exist:

- reducer summaries for stream-safe library-owned aggregation
- formula summaries for Excel-native recalculation and transparency

## End-state API examples

### Formula report column + formula summary

```ts
const schema = createExcelSchema<Order>()
  .column("customer", { accessor: "customer" })
  .column("qty", { accessor: "qty" })
  .column("unitPrice", {
    accessor: "unitPrice",
    style: { numFmt: "$#,##0.00" },
  })
  .column("lineTotal", {
    formula: ({ row }) => row.ref("qty").mul(row.ref("unitPrice")),
    style: { numFmt: "$#,##0.00" },
    summary: (s) => [
      s.formula(({ column }) => column.cells().sum(), {
        style: { numFmt: "$#,##0.00", font: { bold: true } },
      }),
    ],
  })
  .build();
```

### Native Excel table with totals row

```ts
workbook.sheet("Orders").table({
  id: "orders",
  rows,
  schema,
  excelTable: {
    name: "OrdersTable",
    style: "TableStyleMedium2",
    autoFilter: true,
    totalsRow: {
      customer: { value: "TOTAL" },
      lineTotal: { function: "sum" },
    },
  },
});
```

### Dynamic group-aware aggregation later

```ts
const schema = createExcelSchema<SalesRow>()
  .column("name", { accessor: "name" })
  .group("months", (b, months: string[]) => {
    for (const month of months) {
      b.column(`sales:${month}`, {
        header: month,
        accessor: (row) => row.salesByMonth[month] ?? 0,
      });
    }
  })
  .column("total", {
    formula: ({ row }) => row.sumGroup("months"),
  })
  .build();
```

This should be considered a later extension, not part of the first formula-column release.

## Testing expectations per milestone

Each milestone should include:

- compile-time type-safety tests
- buffered runtime tests
- stream runtime tests
- docs updates when public API changes

For formula work specifically, aim to cover:

- invalid references rejected at compile time
- forward references rejected at compile time
- correct `<f>` serialization in worksheet XML
- range/reference correctness under multi-table layout or streaming finalization

## Immediate next step

Start with `feat/formula-cell-core`.

Concrete first tasks:

1. introduce an internal cell union that can represent literal and formula cells
2. thread that union through buffered planning and stream expansion
3. teach OOXML cell serialization to emit formulas
4. keep current public behavior unchanged for existing APIs
5. add tests before exposing user-facing formula APIs

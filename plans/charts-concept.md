# Charts: type-safe concept

Status: implemented on branch `feat/charts-poc` (worktree `typed-xlsx-charts-poc`). The final API replaced `matchOn` with marks that line up on their own `x` column; the user docs are in `apps/docs/content/09.charts`. The sections below are the original draft.

## Goal

Native Excel charts that are as type-safe as the rest of the schema DX: if a chart
cannot render correctly from the table it is attached to, the compiler says so.

## Decision summary

1. **Foundation:** the schema type keeps a map `{ columnId: final cell value type }`
   instead of only an id union. Without it, "series must be numeric" cannot be typed.
2. **Surface:** a reusable chart definition (`createChart(schema)`) attached to a table
   through a `charts` option. Charts are not declared on the schema itself.
3. **Cross-table charts:** one flat chain (`.sheet().table().table().sheet()…`) collects
   every table's selected columns, keyed by sheet then table. A sheet-level
   `.chart(id, ({ refs }) => …)` reads `refs.table(id)` on the current sheet and
   `refs.sheet(name).table(id)` elsewhere, like formulas read earlier columns. A series
   from another table must name a `matchOn` column, checked at write time.
4. **Later:** charts that bring their own aggregated rows.

## 1. Foundation: column value map

Today the builder tracks `TColumnId` (ids only) plus `TBooleanColumnId`
(`packages/core/src/schema/builder.ts`). Value types are lost:

- `transform` returns `CellValue`, so a number turned into `"1 200 €"` still looks numeric.
- `FormulaValue` is `string | number | boolean | expr`, so formula columns have no value type.
- Measured: `refs.column("region").mul(2)` on a text column compiles today.

Proposal: the builder accumulates `TColumns extends Record<string, unknown>` where each
entry is the **final** cell value type:

| Column kind                | Value type recorded                                                             |
| -------------------------- | ------------------------------------------------------------------------------- |
| path or callback accessor  | accessor value                                                                  |
| accessor + `transform`     | transform return type (transform must become generic, not `CellValue`)          |
| accessor + `defaultValue`  | accessor value `\|` default literal (`"N/A"` makes it non-numeric)              |
| array accessor (expansion) | element type, and the id is flagged as expanding                                |
| formula                    | type carried by the returned operand (`add/sub/mul/div/round` produce `number`) |
| dynamic block              | value type of its cells, keyed by block id                                      |

`TBooleanColumnId` becomes derivable from the map. Formula refs get typed operands, so
arithmetic only exists on numeric columns (a stricter formula DSL as a side effect).

Compatibility: `SchemaBuilder` is not exported; `SchemaDefinition`, `SchemaColumnId` and
friends are. Add the map as a trailing generic with a default derived from `TColumnId`,
so existing public type annotations keep compiling. The stricter formula operands can
break user formulas that compile today: ship behind the next major, or keep formula
operands lenient until then and use the map only for charts.

## 2. Surface

```ts
const trend = createChart(sales).line({
  category: "month",
  series: ["revenue", "margin"],
  title: ({ ctx }) => `Revenue (${ctx.currency})`,
});

workbook.sheet("Sales").table("sales", {
  schema: sales,
  rows,
  context,
  select: { exclude: ["cost"] },
  charts: [trend],
});
```

A chart records the columns it needs **and their value types** (not the schema it came
from). The table offers only the columns its `select` keeps. A chart attaches when every
needed column is offered with a compatible type, so one chart can be reused across
schemas that share columns.

Chart kinds and their typed options:

| Kind          | Options                                          | Type rules                                                        |
| ------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| `bar`, `line` | `category`, `series`, `stacked?`                 | series: non-empty list of numeric, non-expanding columns          |
| `pie`         | `category`, `value`                              | exactly one numeric value                                         |
| `scatter`     | `x`, `y`                                         | `x` numeric                                                       |
| `timeline`    | `date`, `series`                                 | `date` must be a `Date` column                                    |
| `combo`       | `category`, `bars`, `lines`, `secondaryAxis?`    | secondary axis only holds series drawn as lines                   |
| `perRow`      | `seriesName`, `values: { dynamic }`, `maxSeries` | block must be numeric; one series per row, capped (Excel max 255) |

`title` and labels accept `LazyText` with the schema's typed `ctx`.

## 3. Compile errors the user gets

All measured in the model with `tsc --strict`:

| Mistake                                          | Error                                                       |
| ------------------------------------------------ | ----------------------------------------------------------- |
| typo `"revenu"`                                  | not assignable … Did you mean `"revenue"`?                  |
| text column as series                            | `"region"` not assignable to numeric ids                    |
| transformed to text                              | `"revenueLabel"` not assignable to numeric ids              |
| numeric with `defaultValue: "N/A"`               | `"note"` not assignable to numeric ids                      |
| array accessor (sub-rows) as series              | `"lines"` not assignable to numeric ids                     |
| pie with a list                                  | `string[]` not assignable                                   |
| scatter with text `x`                            | `"month"` not assignable                                    |
| date axis on a text column                       | `"month"` not assignable to `"day"`                         |
| empty series                                     | `[]` not assignable to `NonEmpty<…>`                        |
| bar series on secondary axis                     | `"revenue"` not assignable to `"avgPrice"`                  |
| `perRow` over a text block                       | `"flags"` not assignable to `"months"`                      |
| chart needs a column the table excludes          | `✗ chart needs "cost", which this table does not render`    |
| chart needs a dynamic block the table excludes   | `✗ chart needs "@months", which this table does not render` |
| chart from another schema needs a missing column | `✗ chart needs "target", which this table does not render`  |
| math on a text column in a formula               | `Property 'mul' does not exist on type 'Operand<string>'`   |
| title reads an unknown ctx key                   | `Property 'locale' does not exist on type 'Ctx'`            |

The table-level messages use a guard type that adds a required `✗ …` property when a
chart does not fit, so the readable reason is the second line of the diagnostic instead
of a type dump.

## 3b. Cross-table charts (flat chain)

Type-safety in this library comes from chaining, so cross-table charts go through one
flat chain. `.sheet()` is callable on a sheet builder and carries what was declared so far.

Table ids are only unique within a sheet (nothing checks them today), and duplicate sheet
names are silently renamed (`Monthly (2)`, `packages/core/src/ooxml/sheet-names.ts`). So a
table is addressed by sheet + table.

```ts
await createWorkbook()
  .sheet("2026")
  .table("sales", { schema: monthlySchema, rows, context })
  .table("targets", { schema: targetSchema, rows: targetRows })
  .chart("actualVsTarget", ({ refs }) => ({
    type: "line",
    category: refs.table("sales").column("month"), // this sheet: table id alone
    series: [
      refs.table("sales").column("revenue", { name: "Actual" }),
      refs.table("targets").column("target", { name: "Target", matchOn: "month" }),
    ],
  }))
  .sheet("2025")
  .table("sales", { schema: monthlySchema, rows: lastYearRows, context }) // same id, other sheet
  .sheet("Dashboard")
  .chart("yearOverYear", ({ refs }) => ({
    type: "bar",
    category: refs.sheet("2026").table("sales").column("month"), // other sheet: sheet + table
    series: [
      refs.sheet("2026").table("sales").column("revenue", { name: "2026" }),
      refs.sheet("2025").table("sales").column("revenue", { name: "2025", matchOn: "month" }),
    ],
  }))
  .writeToFile("./sales.xlsx");
```

- `refs.sheet()` only offers sheets declared earlier; `refs.table()` only offers tables
  of that sheet declared earlier; `.column()` only offers columns its `select` keeps.
- The chart callback exists for the same reason as `formula: ({ refs }) => …`: it is how
  typed refs reach the user.
- A series from a table other than the category's must give `matchOn`, a column of the
  same value type as the category. Excel draws series by row position, so at write time
  the library compares the category values with each `matchOn` column row by row and
  throws on the first mismatch.
- `workbook.sheet(name).table(...)` in separate statements keeps working; only charts
  across tables need the unbroken chain.
- Open: the stream builder awaits each table and commits batches, so the chain does not
  fit it as is.

Measured in the model (`tsc --strict`), each failing for the intended reason:

| Mistake                                        | Error                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| duplicate table id on one sheet                | `✗ table "sales" already exists on this sheet`                                         |
| duplicate sheet name                           | `✗ sheet "2026" already exists`                                                        |
| table id alone for a table on another sheet    | `"sales"` not assignable to `never` (message to improve)                               |
| sheet declared later in the chain              | `"Targets"` not assignable to `"2026" \| "2025" \| "Dashboard"`                        |
| same id on two sheets, no `matchOn`            | `✗ series from "2025/sales" needs matchOn: the column that lines up with the category` |
| `matchOn` on a number column, category is text | `✗ series from "targets" matches on a column whose type differs from the category`     |
| text column as series                          | `✗ series from "targets" is not numeric`                                               |
| column excluded by that table's `select`       | `"cost"` not assignable to `"month" \| "revenue" \| "orders"`                          |

## 4. What stays a runtime rule

- A group or dynamic block hidden by a context `condition`: its series disappear at
  runtime. Pick one: drop the series, or throw with the chart id.
- Row counts: series from two tables with different lengths (sheet-level charts).
- `perRow` above `maxSeries` rows.
- Summary rows and totals rows are excluded from ranges by default; an explicit
  `includeSummary` could plot totals.

## 5. Existing code to build on

- Drawing writer: `packages/core/src/ooxml/drawing.ts` (pictures via `oneCellAnchor`).
  Charts add a `graphicFrame` anchor plus a chart part and relationships.
- Layout offsets: `PositionedTable` in `packages/core/src/workbook/internal/layout.ts`
  gives row and column offsets for "right of" or "below the table" placement.
- Block references reuse the `SparklineSource` shape (`packages/core/src/sparkline/types.ts`).
- Streaming: expected to work because the drawing is written when the sheet closes.
  Not verified in `workbook/stream.ts`.

## Evidence

Standalone model, no library code, checked with the repo's `tsc`:

- 9 allowed charts compile; all 16 mistakes above fail, each for the intended reason.
- Type-check cost, model vs current library on the same generated schema:

| Columns | Model instantiations | Model check | Current lib instantiations  | Current lib check |
| ------- | -------------------- | ----------- | --------------------------- | ----------------- |
| 20      | 33k                  | 0.28s       | —                           | —                 |
| 80      | 54k                  | 0.29s       | 108k (incl. library source) | 0.40s             |
| 160     | 104k                 | 0.38s       | 120k (incl. library source) | 0.38s             |

The model adds roughly 350–600 instantiations per column vs about 150 for the current
builder. Indicative only: the real builder has many more `.column()` overloads, so the
map must be re-measured on the real builder before committing.

## Open questions

- Ship the stricter formula operands now (breaking) or in the next major?
- Context-hidden series: drop silently or throw?
- First slice: charts over exported rows (this doc) vs charts over computed totals.

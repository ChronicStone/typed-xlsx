# Excel Feature Roadmap

`typed-xlsx` owns its OOXML serialization and ZIP assembly (no SheetJS). This file tracks which Excel-native features have shipped and which are still open. Type-safety is the main product constraint: new features must keep compile-time errors for bad column ids, bad references and missing context.

## Shipped

These are in the public exports of `packages/core/src/index.ts`; see the docs site for usage.

- Typed path and callback accessors, `transform`, dynamic column groups with typed context
- Reducer summaries (buffered and stream) and formula summaries
- Formula columns with typed references to earlier columns (`refs.column(...)`, `fx`), including `refs.group(...)` for dynamic groups
- Sub-row expansion, static and row-based cell styling, widths and auto-width
- Buffered and stream workbook builders, multi-table layout on buffered sheets
- Sheet view options (freeze panes, RTL), worksheet auto-filter
- Native Excel tables with a totals row and structured references (`[@Qty]`)
- Conditional styles (formula-based rules)
- Themes (`SpreadsheetTheme`)
- Charts (bar, line, area, scatter, pie, combo) and pivot tables
- Sparklines, images, hyperlinks, data validation, locked cells and sheet protection

## Still open

- Conditional formatting visuals: data bars, color scales and icon sets (none are in `src/` yet).
- Table-scoped structured references in excel-table mode, for example `table.column("amount").data()` for a whole column and `table.column("amount").totals()` for the totals-row cell. Constraints: keep table ids and column ids type-checked, keep report formulas on the existing `refs` API, expose these only in excel-table mode.
- A build-time check that column selection has not removed a column or group that a formula or conditional style still references, and docs that say which guarantees are compile-time only and which are checked when the table is planned.
- A formula-aware total across a dynamic group (for example a `sumGroup`-style helper). Today a formula can reference a group with `refs.group(...)`; there is no dedicated sum helper.

An open note about formulas in grouped Excel tables is in `plans/excel-table-group-formulas-pause.md`.

## Design rules

Keep these when adding features.

1. Schema-level concerns (column identity, report vs excel-table mode, accessors, transforms, styles, formula columns, summaries, dynamic groups) stay on the schema. Builder-level concerns (auto-filter, totals row visibility, conditional formatting, table name and style, charts) stay on the table options.
2. `summary` (library-owned report footer, any number of rows, reducer or formula based) and `totalsRow` (Excel-owned native table footer, excel-table mode only) are different features. Do not merge them.
3. Row access (`accessor: "customer.name"`) and rendered-column references (`refs.column("qty")`) are different concepts. Do not blur them.
4. Prefer typed expression objects over raw formula strings, and allow references only to earlier columns.
5. Keep reducer summaries and formula summaries side by side: reducers are stream-safe, formulas recalculate in Excel.
6. Every feature ships with compile-time type tests, buffered runtime tests, stream runtime tests, and docs.

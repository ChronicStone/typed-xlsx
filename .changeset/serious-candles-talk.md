---
"@chronicstone/typed-xlsx": major
---

typed-xlsx 2.0 turns the post-v1 engine into a much more complete Excel authoring toolkit.

The `1.0` line established the rewritten core architecture: typed schemas, buffered and streaming builders, reducer-based summaries, custom OOXML generation, and a consistent schema-first API. This release builds on that foundation and adds the Excel-native features that were still missing from the early `1.x` surface.

The biggest shift in `2.0` is that the library no longer only produces polished exports. It now models more of Excel itself:

- live formula columns
- report-mode formula summaries
- native Excel tables with totals rows and structured references
- native conditional formatting
- native validation rules
- hyperlinks
- worksheet and workbook protection metadata
- editable workbook workflows with locked, unlocked, and hidden cells

## Major additions

### Typed formula column DSL

Columns can now emit real Excel formulas through a type-safe DSL with predecessor-aware references.

New capabilities include:

- `formula: ({ row, refs, fx }) => ...`
- selector-first predecessor references via `refs.column("columnId")`
- structural selectors via `refs.group("groupId")` and `refs.dynamic("dynamicId")`
- arithmetic operators: `.add()`, `.sub()`, `.mul()`, `.div()`
- comparison operators: `.eq()`, `.neq()`, `.gt()`, `.gte()`, `.lt()`, `.lte()`
- boolean composition for conditions
- `fx` helpers such as `round`, `abs`, `min`, `max`, `if`, `and`, `or`, and `not`
- configurable guarded division via `fx.safeDiv(left, right, fallback?)` and `fx.safeDiv(left, right, { fallback, when })`
- formulas that reference earlier formula columns

This removes a large class of brittle userland string-building and makes formula-driven workbooks much easier to author safely.

It also finalizes the shipped formula model around `refs.*` selectors instead of the older row-bound selector shape, so ordinary predecessor references, grouped aggregates, and dynamic-scope aggregates now use one consistent API.

### Logical-row-aware formula model in report mode

Report mode already supported sub-row expansion through array-returning accessors. `2.0` adds formula APIs that understand that row model explicitly.

New concepts include:

- `refs.column(...)` for current physical-row references
- `row.series(...)` for full logical-row spans across expanded physical rows
- formula `expansion` control with `"auto"`, `"single"`, and `"expand"`

This makes it possible to express both:

- per-line formulas that repeat on every physical row
- logical-row formulas that render once and merge across expanded output rows

### Formula summary cells

Report-mode summaries can now emit native Excel formulas in addition to reducer-computed values.

New capabilities include:

- `summary.formula("sum")`
- `summary.formula(({ column, fx }) => ...)`
- formula-based summary styling
- multiple summary formula rows

This is especially useful when summary rows should remain live if workbook users edit cells after export.

### Row-aware summary formulas

Summary formulas now distinguish between physical worksheet ranges and logical source rows.

New range contexts include:

- `column.cells()` for physical-cell aggregation
- `column.rows()` for logical-row-aware aggregation

This closes an important correctness gap for expanded report layouts where one source row fans out into multiple worksheet rows.

### Native Excel table mode

Schemas can now opt into real Excel table output with `createExcelSchema<T>({ mode: "excel-table" })`.

New behavior includes:

- native `<table>` OOXML generation
- table styles such as `TableStyleMedium2`
- structured formula references instead of A1 references
- default autoFilter behavior in excel-table mode
- totals row support with per-column configuration
- compatibility with both buffered and streaming builders

This makes typed-xlsx a better fit for analyst workflows, pivot-table preparation, Power Query ingestion, and general “editable spreadsheet” use cases where native Excel tables matter.

### Totals row support in excel-table mode

Excel-table schemas now support native totals rows through per-column configuration.

Columns can opt into:

- static labels
- `sum`
- `average`
- `count`
- `countNums`
- `min`
- `max`
- `stdDev`
- `var`

These totals are emitted using the Excel-native table totals row behavior, so they remain filter-aware inside Excel.

### AutoFilter support

Native worksheet autoFilter support is now available.

Behavior differs by mode:

- report mode: opt in with `autoFilter: true`
- excel-table mode: enabled by default, opt out with `autoFilter: false`

For report-mode tables with merged expanded rows, autoFilter is disabled automatically because Excel cannot apply filters over invalid merged ranges.

### Grouped formula scope and group aggregates

Formula support now works much better with grouped schemas and runtime-generated columns.

New capabilities include:

- group-local predecessor scope
- outer-scope references from inside groups
- structural scope selectors via `refs.group(groupId)`
- group formulas such as `fx.sum(refs.group(...))`, `fx.average(refs.group(...))`, `fx.min(refs.group(...))`, `fx.max(refs.group(...))`, and `fx.count(refs.group(...))`

This makes dynamic matrices and context-driven grouped exports far more practical while keeping reference rules safe and explicit.

### Conditional styling with native Excel conditional formatting

`conditionalStyle` now emits native Excel conditional formatting rules instead of resolving everything at export time in JavaScript.

This means workbook styling can remain live after export and continue reacting to:

- formula results
- later user edits
- row-level conditions expressed through the same formula DSL

Summary cells also support conditional styling with a summary-specific condition context.

### Data validation DSL

Columns can now emit native Excel validation rules.

Supported validation kinds include:

- `list([...])`
- `integer()`
- `decimal()`
- `date()`
- `textLength()`
- `custom(({ row, fx }) => ...)`

Additional capabilities include:

- prompts and error alerts
- lazy message/title callbacks
- comparison helpers like `between`, `gte`, `lt`, and others
- predecessor-aware custom formula validation

This enables workflow-safe spreadsheets with dropdowns, edit constraints, and better end-user guidance.

### Hyperlinks

Cells can now carry native Excel hyperlink metadata independently from their rendered value.

Supported forms include:

- static URL strings
- `{ target, tooltip?, style? }` objects
- callback-based hyperlinks that can return a link or `null`

Both external and internal workbook links are supported.

### Worksheet and workbook protection

The workbook builders now support workbook-level and sheet-level protection metadata, along with cell protection flags in styles.

New capabilities include:

- workbook `protection`
- sheet `protection`
- cell `protection.locked`
- cell `protection.hidden`
- protected-sheet permissions such as `selectUnlockedCells`, `sort`, and `autoFilter`

This makes editable planning and review workbooks much easier to model directly in the library.

### Table-wide style defaults

Tables now support `defaults` for shared styling across headers, summaries, and cell protection states.

This includes presets and overrides for:

- headers
- summary rows
- locked cells
- unlocked cells
- hidden cells

These defaults compose with column styles and hyperlink-local overrides, which is especially useful for protected workflow spreadsheets.

### Typed spreadsheet theme engine and schema-wide context

The schema and workbook APIs now use a cleaner model for shared styling and runtime context.

New capabilities include:

- `defineSpreadsheetTheme(...)`
- built-in themes via `spreadsheetThemes.*`
- `theme.extend(...)` and `theme.slot(...)`
- schema-level themes with `.theme(theme)`
- table-level themes with `.table(..., { theme })`
- global schema context via `createExcelSchema<Row, Context>()`
- distinct `group()` and `dynamic()` concepts in the schema tree

This adds a real typed theme engine for spreadsheet styling: reusable semantic slots, layered schema/table theming, and composable defaults that can be shared across headers, summaries, and cell states.

It also replaces the older selection-correlated context model with a simpler schema-wide contract, which makes runtime-driven grouped and dynamic schemas easier to reason about.

### Row-aware formulas and polished examples/docs surface

The release also significantly expands the examples and documentation surface to match the richer API.

Notable additions include:

- showcase workbook examples replacing older legacy samples
- dedicated docs for formulas, excel-table mode, validation, hyperlinks, protection, streaming, and performance
- a new formula row-model doc that explains logical rows, physical rows, `refs.column(...)`, `row.series(...)`, and summary range semantics
- dedicated docs for schema context, structural groups, dynamic columns, spreadsheet themes, cell styles, dynamic styles, and conditional styles
- an explicit v1-to-v2 migration guide covering report mode vs excel-table mode, formula adoption, conditional formatting, validation, hyperlinks, and protection
- expanded README and package README guidance that repositions the library against SheetJS and ExcelJS with clearer migration-oriented comparisons
- a much larger landing-page comparison carousel with concrete SheetJS-to-schema examples for formulas, summaries, grouped headers, dynamic columns, sub-row expansion, excel-table mode, validation, theming, and streaming
- Mermaid support in the docs app for visual explanations of the formula row model

## Constraints and important behavior changes

There are a few important constraints to keep in mind with the new feature set:

- formula scope remains predecessor-based; forward references are rejected
- report-mode summary formulas are report-mode only; excel-table mode should use totals rows instead
- excel-table mode does not support sub-row expansion
- structured references depend on unique effective headers inside excel-table mode
- conditional formatting cannot toggle cell protection flags such as `locked` or `hidden`
- report-mode autoFilter is disabled when merged expanded rows would produce an invalid filter range

## Why this is a major release

This release changes the practical shape of the library.

In `1.x`, typed-xlsx was already a strong typed export builder with buffered and stream paths. In `2.0`, it becomes capable of authoring much more spreadsheet-native behavior without abandoning that same schema-first model.

The end result is one API surface that now covers:

- polished buffered reports
- large streamed exports
- formula-driven financial and operational workbooks
- native Excel tables
- editable protected planning sheets
- validation-driven workflow spreadsheets
- runtime-driven grouped matrix exports

That broader surface, plus the amount of new Excel-native behavior added since `1.0.4`, is why this release is marked as major.

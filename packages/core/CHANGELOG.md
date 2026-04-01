# @chronicstone/typed-xlsx

## 1.0.4

### Patch Changes

- [`1554b7c`](https://github.com/ChronicStone/typed-xlsx/commit/1554b7c4b04b5deea9ff30d157f34f633ccf2b33) Thanks [@ChronicStone](https://github.com/ChronicStone)! - Improve schema typing and inference across accessors, groups, and table selection.
  - tighten accessor typing so path accessors, callback accessors, and derived transform values stay precisely inferred
  - improve group typing so group ids and group context shapes are preserved from the group callback signature
  - make table context requirements depend on the selected groups, including fine-grained `include` and `exclude` inference
  - align runtime behavior and documentation with the updated grouped schema typing model

## 1.0.3

### Patch Changes

- [#25](https://github.com/ChronicStone/typed-xlsx/pull/25) [`13889a2`](https://github.com/ChronicStone/typed-xlsx/commit/13889a27c85fd5a8ef32a90d2c2c00843d1a38d3) Thanks [@ChronicStone](https://github.com/ChronicStone)! - Fix custom number format emission so buffered and streamed workbooks both write the required OOXML `numFmts` definitions for styled currency and percent cells.

  This also aligns the financial report example's average profit margin formatting with its percentage-point values and refreshes the generated example workbooks.

## 1.0.2

### Patch Changes

- [#22](https://github.com/ChronicStone/typed-xlsx/pull/22) [`500c374`](https://github.com/ChronicStone/typed-xlsx/commit/500c37499d547b82a5f0d565bf790106b0829475) Thanks [@ChronicStone](https://github.com/ChronicStone)! - Improve summary ergonomics by supporting the callback builder form with
  `summary.cell(...)`, `summary.label(...)`, and `summary.empty(...)`, while
  updating the docs and examples to teach the new API.

## 1.0.1

### Patch Changes

- [#19](https://github.com/ChronicStone/typed-xlsx/pull/19) [`44cd7ee`](https://github.com/ChronicStone/typed-xlsx/commit/44cd7eeee3e5adda011731b9a1a48c61edcbdc8b) Thanks [@ChronicStone](https://github.com/ChronicStone)! - Improve the public API developer experience by strongly typing `select.include` and
  `select.exclude` against schema column ids, and tighten the docs navigation to use
  single-open accordion behavior in the sidebar.

- [#20](https://github.com/ChronicStone/typed-xlsx/pull/20) [`ee30976`](https://github.com/ChronicStone/typed-xlsx/commit/ee309766ff097bb70c5d26f60963b8730dc80aa6) Thanks [@ChronicStone](https://github.com/ChronicStone)! - Tighten grouped schema typing so `select.include` and `select.exclude` accept group ids as first-class entries, and require matching `context` when grouped schemas are used. This also updates the groups and reference docs to reflect the V1-style group selection model.

## 1.0.0

### Major Changes

- [#17](https://github.com/ChronicStone/typed-xlsx/pull/17) [`32bf450`](https://github.com/ChronicStone/typed-xlsx/commit/32bf4504deec244e2a9f349b253d21c2592c499e) Thanks [@ChronicStone](https://github.com/ChronicStone)! - Promote the new typed-xlsx API as the main package surface and retire the legacy SheetJS-based builder.

  This was a complete ground-up rewrite of the library. The old SheetJS / `xlsx-js-style` stack is gone, along with the architectural ceilings that came with it. Every layer from schema definition to layout planning to OOXML serialization and ZIP packaging was rebuilt from scratch to support type-safe modeling, deterministic output, and genuinely streamable large exports.

  Why this release mattered:
  - the previous `streaming: true` path still depended on an in-memory workbook model and could not scale predictably for large datasets
  - the old summary model depended on the full `rows: T[]` array, which made true streaming impossible
  - `key` was a typed path but could only point at a single field, forcing computed columns into separate transform steps
  - selection and styling leaked awkward implementation details from the previous stack into the public API
  - long-standing issues like `tablesPerRow`, freeze panes, ESM compatibility, and large-dataset behavior were rooted in the old engine and could not be fixed cleanly without replacing it

  Core API and modeling changes:
  - add `createExcelSchema()` as the new primary schema entry point with typed column ids, typed dot-path accessors, and function accessors at the definition site
  - replace `key` with `accessor`, unifying typed path access and computed value access in the same API
  - replace array-wide summary callbacks with reducer-style summaries built around `init`, `step`, and `finalize`
  - replace boolean-map selection with explicit `include` / `exclude` lists
  - adopt a normalized library-owned `CellStyle` model instead of exposing `xlsx-js-style` internals
  - wire schema group context through workbook builders as part of the new typed schema system

  Workbook engine and output changes:
  - add `createWorkbook()` for rebuilt buffered exports on the new engine
  - add `createWorkbookStream()` for real commit-based large exports with incremental sheet writing
  - implement custom OOXML serialization for worksheets, shared strings, styles, relationships, and workbook metadata
  - implement custom ZIP packaging so XLSX assembly is fully controlled in-process
  - support stream-native outputs for files, Node writable streams, web streams, and readable stream conversion
  - add stream tuning options through `memoryProfile` and string-mode controls

  Layout, styling, and feature improvements:
  - support multi-row summaries and sparse summary rows
  - support row expansion for array-valued cells and the merge planning that goes with it
  - support freeze panes and RTL sheets in both buffered and streamed exports
  - fix `tablesPerRow` layout behavior with a dedicated planner instead of post-hoc sheet mutation
  - normalize and deduplicate styles into a controlled `styles.xml` registry
  - add better width planning, row height estimation, and polished worksheet layout behavior

  Tooling, docs, and examples:
  - move the library into a Bun workspace package structure
  - migrate the docs site into the workspace and rewrite the getting-started, schema, workbook, streaming, performance, reference, and migration guides
  - add benchmark tooling for stream workloads
  - add generated example sources and workbook artifacts including the financial report and kitchen sink examples
  - add broad coverage for the planner, OOXML layer, buffered API, streamed API, and large workbook smoke tests

  Fixed issues called out during the rewrite:
  - fix large dataset performance and memory pressure by introducing a genuinely bounded stream path
  - fix broken `tablesPerRow` layout behavior
  - fix TypeScript ESM compatibility problems in the public package
  - add support for freezing rows and columns

  Migration notes:
  - replace `ExcelSchemaBuilder.create<T>()` with `createExcelSchema<T>()`
  - replace `ExcelBuilder.create()` with `createWorkbook()` and use `createWorkbookStream()` for commit-based exports
  - replace `key` with `accessor`
  - replace summary functions that consumed `rows: T[]` with reducer-style summaries
  - move column selection to `include` / `exclude`
  - update styling objects to the new normalized `CellStyle` shape, including `fill.color` instead of `fill.fgColor`

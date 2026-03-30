# @chronicstone/typed-xlsx

## 1.0.1

### Patch Changes

- [#19](https://github.com/ChronicStone/typed-xlsx/pull/19) [`44cd7ee`](https://github.com/ChronicStone/typed-xlsx/commit/44cd7eeee3e5adda011731b9a1a48c61edcbdc8b) Thanks [@ChronicStone](https://github.com/ChronicStone)! - Improve the public API developer experience by strongly typing `select.include` and
  `select.exclude` against schema column ids, and tighten the docs navigation to use
  single-open accordion behavior in the sidebar.

- [#20](https://github.com/ChronicStone/typed-xlsx/pull/20) [`ee30976`](https://github.com/ChronicStone/typed-xlsx/commit/ee309766ff097bb70c5d26f60963b8730dc80aa6) Thanks [@ChronicStone](https://github.com/ChronicStone)! - Tighten grouped schema typing so `select.include` and `select.exclude` accept group ids as first-class entries, and require matching `context` when grouped schemas are used. This also updates the groups and reference docs to reflect the V1-style group selection model.

## 1.0.0

### Major Changes

- [#17](https://github.com/ChronicStone/typed-xlsx/pull/17) [`32bf450`](https://github.com/ChronicStone/typed-xlsx/commit/32bf4504deec244e2a9f349b253d21c2592c499e) Thanks [@ChronicStone](https://github.com/ChronicStone)! - Promote the new typed-xlsx API as the main package surface and retire the legacy SheetJS-based builder.

  Highlights:
  - add `createExcelSchema()` with `id + accessor` columns, typed path accessors, and accessor callbacks
  - add `createWorkbook()` for polished buffered exports
  - add `createWorkbookStream()` for commit-based large exports with stream-native outputs
  - replace array-wide summary callbacks with reducer-based summaries using `init`, `step`, and `finalize`
  - adopt a normalized `CellStyle` model instead of leaking `xlsx-js-style` types into the public API
  - support multi-row summaries, freeze panes, RTL sheets, row expansion, merges, and fixed `tablesPerRow` layout behavior
  - add stream output helpers for files, Node writable streams, web streams, and readable stream conversion
  - add stream tuning options with `memoryProfile` and `strings`
  - remove the legacy SheetJS / `xlsx-js-style` implementation and clean up old example and documentation paths

  Migration notes:
  - replace `key` with `accessor`
  - replace summary functions that consumed `rows: T[]` with reducer-style summaries
  - move column selection to `include` / `exclude`
  - update styling objects to the new normalized `CellStyle` shape

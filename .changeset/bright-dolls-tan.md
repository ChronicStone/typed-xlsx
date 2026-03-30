---
"@chronicstone/typed-xlsx": major
---

Promote the new typed-xlsx API as the main package surface and retire the legacy SheetJS-based builder.

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

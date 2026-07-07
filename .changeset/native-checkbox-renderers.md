---
"typed-xlsx": major
---

Promote checkbox renderer columns to native Excel checkbox cells.

Checkbox columns now write boolean `TRUE` / `FALSE` cells with Excel cell-control metadata instead of portable glyph-formatted `1` / `0` values. Workbooks include the required feature-property-bag parts in both buffered and streaming output, and checkbox formula references are typed as booleans so formulas compare against `true` / `false`.

This replaces the previous glyph-label customization options on checkbox columns. Use sheet protection with per-cell `style.protection.locked` when some checkbox cells should be editable and others should stay locked.

Renderer callbacks also gained more complete context support:

- badge variant labels may be callbacks with access to the row, value, and schema context
- hyperlink tooltips can be lazy text callbacks
- table titles and renderer styles resolve with schema context in buffered and streaming workbooks

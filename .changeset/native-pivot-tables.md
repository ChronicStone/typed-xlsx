---
"typed-xlsx": minor
---

Add native Excel pivot tables and pivot charts. `refs.table(id).pivot({ rows, columns, values, filters })` describes a pivot over a table declared earlier in the workbook chain, `.pivot(id, …)` places it, and `refs.pivot(id).bar()` (or `line`, `area`, `pie`, `doughnut`) draws a pivot chart that Excel keeps in sync. Fields and aggregations are checked against the source table's columns: only numeric columns can be summed or averaged. Excel refreshes pivots on open, and the library also writes their totals so files read correctly before that. Streamed tables support pivots declared before their first commit.

Values can be shown as a share of a total with `show: "percentOfTotal" | "percentOfRow" | "percentOfColumn"`. Date columns can be grouped by year, quarter or month with `{ field, by }`, and rows can nest several units such as `by: ["year", "quarter", "month"]`. Only date columns that cannot be blank can be grouped, since Excel drops the grouping when a date is missing.

Pivots follow spreadsheet themes. A pivot uses its `style` (a built-in Excel pivot style), else its `theme`, else the theme of its source table, else the classic theme tables use, so a pivot looks like the tables around it by default. Themes gain six pivot slots, `pivotBody`, `pivotFrame`, `pivotHeader`, `pivotSubheading`, `pivotTotal` and `pivotStripe`, bound by default to the table slots of the same theme, plus a `stripeFill` token. A themed pivot is written as a custom pivot style, so it stays styled when readers refresh it. `banded` adds banded rows or columns. Pivots now keep their written column widths when Excel refreshes them.

---
"typed-xlsx": minor
---

Add native Excel pivot tables and pivot charts. `refs.table(id).pivot({ rows, columns, values, filters })` describes a pivot over a table declared earlier in the workbook chain, `.pivot(id, …)` places it, and `refs.pivot(id).bar()` (or `line`, `area`, `pie`, `doughnut`) draws a pivot chart that Excel keeps in sync. Fields and aggregations are checked against the source table's columns: only numeric columns can be summed or averaged. Excel refreshes pivots on open, and the library also writes their totals so files read correctly before that. Streamed tables support pivots declared before their first commit.

Values can be shown as a share of a total with `show: "percentOfTotal" | "percentOfRow" | "percentOfColumn"`. Date columns can be grouped by year, quarter or month with `{ field, by }`, and rows can nest several units such as `by: ["year", "quarter", "month"]`. Only date columns that cannot be blank can be grouped, since Excel drops the grouping when a date is missing.

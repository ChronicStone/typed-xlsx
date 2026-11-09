---
"typed-xlsx": minor
---

Add native Excel charts. Charts are lists of marks (bar, line, area, scatter, pie, doughnut) built from tables declared earlier in the workbook chain with `refs.table(id)` or `refs.sheet(name).table(id)`, or from streamed table handles with `sheet.chart(id, spec)`. Marks from different tables line up on their own x column, combos can use a secondary axis, and dynamic columns can be plotted as series or as categories.

Schemas now record the value type of every column (after `transform`, `defaultValue`, and for formula results), exposed as `SchemaColumnValues<typeof schema>`. Charts use it to accept only numeric columns as values.

---
"typed-xlsx": patch
---

Keep text such as `_x0041_` as written. Excel and other readers decoded it as a character code. The leading underscore is now written as `_x005F_` in cells, formulas, sheet and table names, table column names, totals labels and pivot labels. A formula or chart that references a sheet, table or column named with such text still finds it.

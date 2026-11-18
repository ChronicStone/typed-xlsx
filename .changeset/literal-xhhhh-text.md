---
"typed-xlsx": patch
---

Keep text such as `_x0041_` as written. Excel and other readers decoded it as a character code. The leading underscore is now written as `_x005F_` in cells, formulas, table column names, totals labels and pivot items, so a formula that references a column named `Code_x0041_` still finds it.

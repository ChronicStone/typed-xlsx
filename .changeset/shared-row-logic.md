---
"typed-xlsx": patch
---

In native Excel tables, the calculated column formula stored in the table part now matches the formula written in the cells for scope aggregates over groups and dynamic columns (it used a column range where the cells listed each column). The buffered and stream builders now share one copy of the row, formula and cell reference code.

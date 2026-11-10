---
"typed-xlsx": patch
---

A formula that references a column when no column is declared before it now says so ("No column is declared before this formula…") instead of reporting `never`, and no longer adds a second error about `FormulaOperand<never…>`.

---
"typed-xlsx": patch
---

Columns declared inside `.group()` keep their value type in formulas. They were typed as booleans, so `refs.column("qty").gt(0)` on a grouped number column did not compile.

---
"typed-xlsx": patch
---

Formula columns in excel-table schemas now receive `ctx`. Before, reading it inside `formula` threw because it was undefined.

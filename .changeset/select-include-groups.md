---
"typed-xlsx": patch
---

`select: { include: [...] }` now keeps every column of an included group or dynamic block, including nested groups. Before, it produced a table with no columns.

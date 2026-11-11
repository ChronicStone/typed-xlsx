---
"typed-xlsx": patch
---

Tables with no rows no longer throw for row-aware summaries (sums are 0, averages are empty), and a SUM or COUNT over a dynamic block that generated no columns is now 0. AVERAGE, MIN and MAX over an empty block throw an error that names the formula column and the block. A pivot over a table with no rows now throws a clear error instead of reading the summary row as data.

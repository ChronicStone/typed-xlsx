---
"typed-xlsx": patch
---

Sheets with stacked tables no longer write overlapping column definitions, which made Excel repair the file. Each worksheet column now has one definition with the widest width of the tables that use it.

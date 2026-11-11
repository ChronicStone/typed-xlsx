---
"typed-xlsx": patch
---

Streamed exports no longer mix rows between tables whose sheet names look alike or between exports started at the same time, and they no longer leave temp files behind. Each workbook now writes its spool files into its own private folder, which is deleted when the export ends, fails, or is disposed.

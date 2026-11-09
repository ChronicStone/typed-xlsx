---
"typed-xlsx": patch
---

Streamed workbooks read through `toReadableStream()` or `toNodeReadable()` now fail with the finalization error instead of ending as an empty file. Worksheets now write `<drawing>` before `<tableParts>`, as the spreadsheet schema requires when a sheet holds both images and a native Excel table.

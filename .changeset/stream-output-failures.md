---
"typed-xlsx": patch
---

A streamed export that fails now aborts its destination with the error instead of ending it as if it had succeeded, and `writeToFile` keeps the previous file when the export fails. `pipeToNode` rejects when the destination is destroyed, readable streams wait for the reader and stop when it cancels, and committing rows after the workbook is finalized throws.

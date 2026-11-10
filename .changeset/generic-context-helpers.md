---
"typed-xlsx": patch
---

Helpers generic over a schema's row and context type compile again: a function that forwards `context` to `.table()`, or an app's own sheet interface typed with a generic context. `WorkbookTableStream<Row>` without its column parameters accepts the handle of any table with that row type.

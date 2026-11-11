---
"typed-xlsx": minor
---

Control characters in text no longer make the file invalid, and padded text keeps its spaces. NaN, Infinity, invalid or out-of-range dates, Decimal and other objects now throw an error naming the cell instead of writing a broken or empty cell, `bigint` is written as a number or text, a row value shaped like a formula is no longer written as a formula, and `javascript:`, `vbscript:` and `data:` hyperlinks are rejected.

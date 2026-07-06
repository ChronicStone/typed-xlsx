---
"typed-xlsx": minor
---

Add renderer-style columns for native sparklines, hyperlinks, and images.

Image columns support embedded PNG/JPEG bytes for portable workbooks and URL-backed Excel `IMAGE()` formulas for lightweight remote previews. Embedded media is written through worksheet drawings, deduplicated across the workbook when identical bytes are reused, and documented with portability and file-size guidance.

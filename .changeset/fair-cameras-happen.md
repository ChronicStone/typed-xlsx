---
"@chronicstone/typed-xlsx": patch
---

Fix custom number format emission so buffered and streamed workbooks both write the required OOXML `numFmts` definitions for styled currency and percent cells.

This also aligns the financial report example's average profit margin formatting with its percentage-point values and refreshes the generated example workbooks.

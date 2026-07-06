---
"typed-xlsx": minor
---

Add renderer-style badge and checkbox columns.

Badge columns map status-like values to styled cell labels through `variants`, while checkbox columns render boolean values as portable checked and unchecked glyphs. Both renderers work in buffered and streaming exports and support report-mode sub-row expansion.

Checkbox columns store formula-friendly `1`/`0` values under their display format, so later formula columns can reference them directly.

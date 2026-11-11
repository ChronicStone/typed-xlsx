---
"typed-xlsx": patch
---

Values stored next to excel-table formulas now follow Excel for rounding (half away from zero), comparisons across text, numbers and booleans, and sums and averages over ranges that contain text or blanks. When Excel would show an error or the result is not certain, no value is stored and Excel computes it on open.

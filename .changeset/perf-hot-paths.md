---
"typed-xlsx": patch
---

Buffered report exports ran every summary reducer twice per row, and both builders rebuilt each formula column and resolved each body cell style for every row. Reducers now run once per row, and formula columns and body styles are resolved once per table and column run. A 7-column buffered export with two formula columns and a summary now takes about 0.55 s for 50,000 rows (was about 0.95 s) and about 2.3 s for 200,000 rows (was about 3.5 s); the file is byte-identical.

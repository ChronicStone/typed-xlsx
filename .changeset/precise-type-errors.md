---
"typed-xlsx": major
---

Type errors now point at the exact mistake and say what would fit. No runtime behaviour changes, but the types are stricter: code that compiled on 4.x can report new errors. See the [v4 → v5 guide](https://typed-xlsx.vercel.app/migration/v4-to-v5) for each case and its fix.

- `.column()` has a single signature instead of 14 overloads, so a mistake is reported on the key at fault instead of "No overload matches this call". An unknown option lists the options of that column kind, a field typo lists the fields and suggests the closest one, and a column kind checks what its accessor holds (a checkbox needs a boolean field).
- `.table()` reports unknown options with the options of the schema kind, and `select` lists the column ids.
- Charts: a non-numeric `y` says which columns are numeric, an unknown mark or chart option is reported (a chart callback returning `titel` used to compile).
- Pivots: aggregating a text column says it can only be counted, date grouping names the date columns, and unknown options are reported.
- Report schemas no longer accept Excel table options such as `totalsRow`: `build()` now returns the schema with its kind.

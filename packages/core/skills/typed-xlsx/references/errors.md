# Reading type errors

typed-xlsx reports a mistake on the key that is wrong, and the message says what would fit. Most messages read as `Type 'X' is not assignable to type '"<explanation>"'`: the explanation inside the quotes is the part to read.

## Messages and fixes

| Message (inside the quotes)                                                             | Cause                                                               | Fix                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `… Did you mean '"firstName"'?` on `accessor`                                           | a path that doesn't exist; the full list of paths is in the message | use the suggested path                                                    |
| `'customer' doesn't hold a cell value (…). Fields that do: …`                           | the path points at an object                                        | point at a field inside it (`customer.name`), or use an accessor function |
| `'tags' doesn't hold a single cell value` (excel-table)                                 | an array in an excel-table schema                                   | join it (`row.tags.join(", ")`) or use a report schema                    |
| `The accessor function must return a cell value`                                        | the function returns an object or array of objects                  | return a primitive, `Date`, null, or an array of those                    |
| `The accessor function receives the row: …`                                             | the parameter was typed as something else                           | write `(row) => …` without a type                                         |
| `'hedaer' is not an option of columns. Options: …`                                      | an unknown or misspelled option                                     | pick from the listed options                                              |
| `'format' is not an option of checkbox columns`                                         | the option doesn't fit this column kind                             | remove it, or change `type`                                               |
| `'summary' is not an option of columns` (excel-table)                                   | summaries are report-only                                           | use `totalsRow`                                                           |
| `'qty' doesn't hold a boolean. Fields that do: active`                                  | a checkbox on a non-boolean field                                   | use a boolean field or an accessor returning a boolean                    |
| `Argument of type '"qtyy"' is not assignable to parameter of type '"qty"'` in a formula | `refs.column` with an unknown or later column                       | reference a column declared before the formula                            |
| `'region' is not a numeric column. Numeric columns: …` in a chart                       | `y` on a text column (or a transform that returns text)             | plot a numeric column                                                     |
| `'month' is not numeric, so it can only be counted` in a pivot                          | `sum`/`average` on text                                             | use `"count"`, or a numeric column                                        |
| `'region' is not a date column. Date columns: …`                                        | date grouping on a non-date column                                  | group a `Date` column                                                     |
| `'shippedAt' can be blank`                                                              | date grouping on a nullable column                                  | give the column a `defaultValue`, or filter nulls out                     |
| `'titel' is not a table option` / `chart option` / `pivot option`                       | unknown option                                                      | pick from the listed options                                              |
| `Property 'context' is missing` on `.table()`                                           | the schema declares a context                                       | pass `context`                                                            |
| `'"revenu"' … Did you mean '"revenue"'?` in `select`                                    | an id that isn't declared                                           | use a declared column, group or dynamic id                                |

## When the error is not on a key

- **On the whole `.column()` call or a long union**: often a value whose type is wider than needed, such as a `string` variable used as an accessor. Use a literal, or an accessor function.
- **On `transform`'s `value`**: the accessor's type flows into `transform`. Check the accessor first.
- **In a dynamic block**: generated column ids are plain strings built at runtime, so `select` and `refs` can't name them one by one. Refer to the block id instead.
- **Rows don't match**: `rows` must be an array of the schema's row type. Map your data to that type first.

## Errors at write time

These are thrown when the file is written, not by the type checker. They name the table and column.

- a formula references a column excluded by `select`
- an array accessor or a sub-row formula in an excel-table schema
- a chart or pivot over a table with sub-rows
- chart marks whose x values differ row by row
- a sparkline source column excluded by `select`
- a stream workbook finalized twice

# Define Column

In `typed-xlsx`, defining a column is a straightforward process that sets the foundation for the structure of your Excel report. Let's go through the syntax and the properties you can define for a column.

## Column Syntax

To define a column, use the `column` method provided by `ExcelSchemaBuilder`:

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'

// Instantiate a schema with a single column
const schema = ExcelSchemaBuilder.create<{ firstName: string }>()
  .column('First Name', { key: 'firstName' })
```

## Column Properties

Each column in `typed-xlsx` can be configured with a variety of properties to fine-tune its behavior and presentation:

### `label`
- **Description:** The `label` property specifies the column's header text in the Excel file.
- **Type:** `string`
- **Required:** No
- **Default:** The column key

## `key`
- **Description:** The `key` property is a path to the value in the data object.
- **Type:** `string`
- **Required:** Yes
- **Example:**

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const schema = ExcelSchemaBuilder.create<{ name: string, email: string, frameworks: string[] }>()
  .column('Name', { key: 'name' })
  .column('Email', { key: 'email' })
  .column('Frameworks', { key: 'frameworks' })
  .build()
```

If a cell value is an array of BaseCellValue, `typed-xlsx` will automatically create sub-rows for each item in the array and merge extra cells on the rest of the row, like this :

![Nested row merge](/images/examples/col-sub-rows.png)

## `transform`
- **Description:** The `transform` property allows you to specify how to process the data before printing it in the cell.
- **Type:** `string | ((data: T) => CellValue)`
- **Required:** Depends on the type associated to key
- **Example:**

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
ExcelSchemaBuilder.create<{ isActive: boolean, name: { first: string, last: string } }>()
  .withTransformers({ booleanToString: (value: boolean) => value ? 'Yes' : 'No' })
// Using a shared transformer
  .column('Active', { key: 'isActive', transform: 'booleanToString' })

// Using a custom transformer function
  .column('Full Name', {
    key: 'name',
    transform: name => `${name.first} ${name.last}`
  })
```

If the key points to a non-primitive value, which can't be serialized into a cell value, transformer will be necessary, and required by typescript :

```ts twoslash
// @errors: 2345
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---

ExcelSchemaBuilder.create<{ name: { first: string, last: string } }>()
  .column('Full Name', {
    key: 'name',
  })
```

## `default`
- **Description:** The `default` property sets a fallback value for the cell if the original value is `undefined` | `null`.
- **Type:** `CellValue`
- **Required:** No

## `format`
- **Description:** The `format` property specifies the cell format, such as for currency or dates.
- **Type:** `string | ((data: T) => string)`
- **Required:** No
- **Example:**

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
ExcelSchemaBuilder.create<{ date: Date, amount: number, currency: 'EUR' | 'USD' }>()
  .column('Date', { key: 'date', format: 'd mmm yyyy' })
  .column('Salary', {
    key: 'amount',
    format: row =>
        `"${row.currency === 'EUR' ? '€' : '$'}"#,##0.00_);\\("${row.currency === 'EUR' ? '€' : '$'}"#,##0.00\\)`,
  })
  .build()
```

![Column formats](/images/examples/col-format-1.png)

## `cellStyle`
- **Description:** Define the style for the cell, either as a static `CellStyle` object or a function for dynamic styling. See [xlsx-js-style](https://github.com/gitbrent/xlsx-js-style?tab=readme-ov-file#cell-style-properties) for more information on `CellStyle`.
- **Type:** `CellStyle | ((data: T, rowIndex: number, subRowIndex: number) => CellStyle)`
- **Required:** No
- **Example:**

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---

ExcelSchemaBuilder.create<{ status: string }>()
  .column('Status', {
    key: 'status',
    cellStyle: { fill: { fgColor: { rgb: 'FFFF00' } } }
  })
```

## `headerStyle`
- **Description:** Define the style for the header cell of the column. See [xlsx-js-style](https://github.com/gitbrent/xlsx-js-style?tab=readme-ov-file#cell-style-properties) for more information on `CellStyle`.
- **Type:** `CellStyle`
- **Required:** No
- **Example:**

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---

ExcelSchemaBuilder.create<{ status: string }>()
  .column('Status', {
    key: 'status',
    headerStyle: { fill: { fgColor: { rgb: 'FFFF00' } } }
  })
```

## `summary`
- **Description:** Summaries provide aggregate information at the end of the table.
- **Required:** No
- **Type:**
```ts twoslash
import type { CellStyle } from 'xlsx-js-style'
import type { BaseCellValue } from '@chronicstone/typed-xlsx'
// ---cut-before---
type Summary<T> = Array<{
  value: (data: T[]) => BaseCellValue
  format?: string | ((data: T[]) => string)
  cellStyle?: CellStyle | ((data: T[]) => CellStyle)
}>
```
- **Example:**

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
const getCurrenyFormat = (currency: 'EUR' | 'USD') => `"${currency === 'EUR' ? '€' : '$'}"#,##0.00_);\\("${currency === 'EUR' ? '€' : '$'}"#,##0.00\\)`
// ---cut-before---
ExcelSchemaBuilder.create<{ date: Date, amount: number }>()
  .column('Date', { key: 'date', format: 'd mmm yyyy' })
  .column('Amount', {
    key: 'amount',
    format: getCurrenyFormat('EUR'),
    summary: [
      {
        value: data => data.reduce((acc, row) => acc + row.amount, 0),
        format: getCurrenyFormat('EUR'),
      },
    ],
  })
```

![Column summary](/images/examples/col-sum-1.png)

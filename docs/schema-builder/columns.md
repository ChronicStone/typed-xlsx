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

## Label (optional)

The `label` property specifies the column's header text in the Excel file.

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---

ExcelSchemaBuilder.create<{ firstName: string, lastName: string }>()
  .column('First Name', { key: 'firstName', label: 'First Name' })
```

## Key (required)

The `key` property is a path to the value in the data object. It can also be a nested path, supporting deep access to the value.

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
ExcelSchemaBuilder.create<{ personal: { firstName: string, lastName: string } }>()
  .column('First Name', { key: 'personal.firstName' }) // For nested objects
```

If the key points to an array, `typed-xlsx` automatically handles sub-rows and merging.

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
ExcelSchemaBuilder.create<{ aliases: string[] }>()
  .column('Aliases', { key: 'aliases' })
```

## Transform (optional)

The `transform` property allows you to specify how to process the data before it's output to the cell.

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

## Default (optional)

The `default` property sets a fallback value for the cell if the original value is `undefined`.

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
ExcelSchemaBuilder.create<{ middleName: string }>()
  .column('Middle Name', { key: 'middleName', default: 'N/A' })
```

##Format (optional)

The `format` property specifies the cell format, such as for currency or dates.

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
ExcelSchemaBuilder.create<{ salary: number }>()
  .column('Salary', { key: 'salary', format: '$#,##0.00;[Red]-$#,##0.00' })
```

## CellStyle (optional)

Define the style for the cell, either as a static `CellStyle` object or a function for dynamic styling.

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---

ExcelSchemaBuilder.create<{ status: string }>()
  .column('Status', {
    key: 'status',
    cellStyle: { fill: { fgColor: { rgb: 'FFFF00' } } }
  // ^?
  })
```

## Summary (optional)

Summaries provide aggregate information at the end of the table.

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
ExcelSchemaBuilder.create<{ value: number }>()
  .column('Total', {
    key: 'value',
    summary: [{
      value: rows => rows.reduce((sum, row) => sum + row.value, 0)
    }]
  })
```

By setting these properties, you can tailor each column to fit the specific needs of your report, ensuring both the data integrity and the aesthetic quality of the final output.

# Create File Builder

To construct an Excel file with `typed-xlsx`, start by creating an instance of the file builder using `ExcelBuilder`. This class facilitates the construction of Excel files through a method chaining approach that allows you to configure properties and behaviors sequentially.

## Importing ExcelBuilder

First, ensure that `ExcelBuilder` is imported from the `typed-xlsx` package:

```ts twoslash
import { ExcelBuilder } from '@chronicstone/typed-xlsx'
```

## Creating an ExcelBuilder Instance

To start building an Excel file, create a new instance of ExcelBuilder by calling create(). This method initializes a new Excel file builder instance:

```ts twoslash
import { ExcelBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const excelFile = ExcelBuilder.create()
```

## Method Chaining

ExcelBuilder utilizes method chaining to streamline the configuration of your Excel file, to preserve type-safety and ensure consistency.

```ts twoslash
// @noErrors
import { ExcelBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const excelFile = ExcelBuilder.create()
  .sheet('Sheet1')
  .addTable({ data, schema, })
  .build({ output: 'buffer' })
```

## Multiple Sheets

In typed-xlsx, you can define multiple sheets in a single workbook. You just need to chain the method calls for each sheet you want to add:

```ts twoslash
// @noErrors
import { ExcelBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const excelFile = ExcelBuilder.create()
  .sheet('Sheet1')
  .addTable({ data, schema, })
  .sheet('Sheet2')
  .addTable({ data, schema, })
  .build({ output: 'buffer' })
```

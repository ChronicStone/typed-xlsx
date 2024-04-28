# Build Excel File

After defining the sheets and tables, the final step is to build the Excel file using the `build()` method. This method allows you to specify various parameters to customize the output. Here's a detailed explanation of each parameter:

## Build Method

To build the Excel file, call the `build()` method on the ExcelBuilder instance :

```ts twoslash
// @noErrors
import { ExcelBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const excelFile = ExcelBuilder.create()
  .sheet('Sheet1')
  .addTable({ data, schema, })
  .build({ output: 'buffer' })
```

## Parameters

### `output`
- **Description:** Specifies the format of the output.
- **Type:** `'buffer' | 'workbook' | 'base64' | 'file'`
- **Required:** Yes
- **Example:**
  ```ts twoslash
  // @noErrors
  import { ExcelBuilder } from '@chronicstone/typed-xlsx'
  // ---cut-before---
  const buffer = ExcelBuilder.create()
  //    ^?
    .sheet('Sheet1')
    .addTable({ data, schema, })
    .build({ output: 'buffer' })

  const workbook = ExcelBuilder.create()
    //    ^?
    .sheet('Sheet1')
    .addTable({ data, schema, })
    .build({ output: 'workbook' })

  const base64 = ExcelBuilder.create()
    //    ^?
    .sheet('Sheet1')
    .addTable({ data, schema, })
    .build({ output: 'base64' })

  const file = ExcelBuilder.create()
    //    ^?
    .sheet('Sheet1')
    .addTable({ data, schema, })
    .build({ output: 'file' })
  ```

### `rtl`
- **Description:** Specifies whether the Excel file should be rendered in right-to-left (RTL) mode.
- **Type:** `boolean`
- **Required:** No
- **Default:** `false`
- **Example:**

```ts twoslash
// @noErrors
import { ExcelBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const excelFile = ExcelBuilder.create()
  .sheet('Sheet1')
  .addTable({ data, schema, })
  .build({ output: 'buffer', rtl: true })
```

### `extraLength`
- **Description:** Specifies the extra length each cell should be rendered with.
- **Type:** `number`
- **Required:** No
- **Default:** `10`
- **Example:**

```ts twoslash
// @noErrors
import { ExcelBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const excelFile = ExcelBuilder.create()
  .sheet('Sheet1')
  .addTable({ data, schema, })
  .build({ output: 'buffer', extraLength: 5 })
```

### `rowHeight`
- **Description:** Specifies the height of each row in the Excel file.
- **Type:** `number`
- **Required:** No
- **Default:** `30`
- **Example:**

```ts twoslash
// @noErrors
import { ExcelBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const excelFile = ExcelBuilder.create()
  .sheet('Sheet1')
  .addTable({ data, schema, })
  .build({ output: 'buffer', rowHeight: 30 })
  ```

### `bordered`
- **Description:** Specifies whether the Excel file should have borders.
- **Type:** `boolean`
- **Required:** No
- **Default:** `true`
- **Example:**

```ts twoslash
// @noErrors
import { ExcelBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const excelFile = ExcelBuilder.create()
  .sheet('Sheet1')
  .addTable({ data, schema, })
  .build({ output: 'buffer', bordered: false })

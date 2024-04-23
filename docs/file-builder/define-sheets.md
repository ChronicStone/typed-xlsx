# Define Sheets

In `typed-xlsx`, sheets in an Excel workbook are defined using the `.sheet()` method on an `ExcelBuilder` instance. This method allows you to configure individual sheets with specific settings that control the layout and organization of tables within the sheet.

## Method Usage

To add a sheet to your Excel workbook, call the `.sheet()` method with the name of the sheet as the first argument. This name will appear as the tab name in the Excel file:

```ts twoslash
import { ExcelBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const workbook = ExcelBuilder.create()
  .sheet('Sales Data')
  ```

  ## Optional Parameters

The `.sheet()` method accepts a second optional parameter, an object that allows you to specify additional settings for how tables are laid out within the sheet:

- **tableSeparatorWidth** (`number`): Defines the width of the separator between tables when multiple tables are placed on a single sheet. This is measured in Excel's column width units.
- **tablesPerRow** (`number`): Specifies the number of tables to display in a single row. This is useful for organizing multiple tables side by side within the same sheet.

### Example with Optional Parameters

Here’s how to use these optional parameters to customize the layout of tables in a sheet:

```ts twoslash
import { ExcelBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const workbook = ExcelBuilder.create()
  .sheet('Financial Overview', {
    tableSeparatorWidth: 2, // Adds a gap equivalent to 2 columns between tables
    tablesPerRow: 2 // Places two tables per row
  })
```

In this example, the sheet named "Financial Overview" is configured to place two tables per row, separated by a width equivalent to two standard Excel columns.
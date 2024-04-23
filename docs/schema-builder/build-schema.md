# Build Schema

To finalize your schema definition in `typed-xlsx`, simply call the `.build()` method after defining all your columns. This method compiles the schema and prepares it for use in generating Excel reports.

## Example

Here's how you complete a schema setup:

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'

const schema = ExcelSchemaBuilder.create<{ firstName: string, lastName: string }>()
  .column('firstName', { key: 'firstName' })
  .column('lastName', { key: 'lastName' })
  .build() // Finalize the schema
```

The .build() method finalizes the schema configuration and ensures it is ready for use with ExcelBuilder to generate Excel files. It's essential to call .build() after all columns are added to lock in the configuration and prevent further modifications.
# Create Schema

Creating a well-defined schema is crucial for generating consistent and type-safe Excel reports. `ExcelSchemaBuilder` is a class provided by `typed-xlsx` that enables you to construct such schemas with ease.

## What is ExcelSchemaBuilder?

`ExcelSchemaBuilder` is a builder class designed to create a type-safe schema that represents the structure of the tables you plan to export to an Excel file.

## Instantiating a Schema

To begin defining a schema, instantiate an `ExcelSchemaBuilder` object using the `create` method. You need to provide a type parameter that describes the shape of the data you'll be working with.

Here's how to instantiate a schema for a table with `firstName` and `lastName` fields:

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// @noErrors
const schema = ExcelSchemaBuilder.create<object>()
```

## Method Chaining

`ExcelSchemaBuilder` utilizes method chaining to define each column of your schema. This approach is necessary to provide type-safety and ensure that your schema is well-defined and consistent.

Here's an example of what not to do:

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const schema = ExcelSchemaBuilder.create<{ firstName: string, lastName: string }>()
schema.column('firstName', { key: 'firstName' })
// DUPLICATE COLUMN KEY, BUT NO TYPESCRIPT ERROR
schema.column('firstName', { key: 'firstName' })
```

Instead, chain the method calls like this:

```ts twoslash
// @errors: 2345
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const schema = ExcelSchemaBuilder.create<{ firstName: string, lastName: string }>()
  .column('firstName', { key: 'firstName' })
  // WILL THROW ERROR, KEY ALREADY EXISTS
  .column('firstName', { key: 'firstName' })
```

# Shared transformers
Global transformers are functions that can be registered when creating a schema builder. They can then be used to transform values with the `transform` property of a column, simply by referencing the function name.

```ts twoslash
// @noErrors
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const schema = ExcelSchemaBuilder.create<{ firstName: string, lastName: string, countries: string[] }>()
  .withTransformers({
    uppercase: (value: string) => value.toUpperCase(),
    lowercase: (value: string) => value.toLowerCase(),
    listArray: (value: string[]) => value.join(', '),
    listArrayUppercase: (value: string[]) => value.map(v => v.toUpperCase()).join(', '),
  })
  .column('firstName', { key: 'firstName', transform: 'uppercase' })
  .column('lastName', { key: 'lastName', transform: 'lowercase' })
  .column('countries', { key: 'countries', transform: '' })
//                                                     ^|
```

## Reusable Transformers

You can also define reusable transformers that can be used across multiple schemas :

```ts twoslash
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'

const transformers = {
  uppercase: (value: string) => value.toUpperCase(),
  lowercase: (value: string) => value.toLowerCase(),
  listArray: (value: string[]) => value.join(', '),
} as const

const schema = ExcelSchemaBuilder.create<{ firstName: string, lastName: string, countries: string[] }>()
  .withTransformers(transformers)
  .column('firstName', { key: 'firstName', transform: 'uppercase' })
  .column('lastName', { key: 'lastName', transform: 'lowercase' })
  .column('countries', { key: 'countries', transform: 'listArray' })
```

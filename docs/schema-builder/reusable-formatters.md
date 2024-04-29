## Reusable formatters

Reusable formatters are excel cell formats that can be registered when creating a schema builder, and used as presets in the `format` property of a column.

```ts twoslash
// @noErrors
import { ExcelSchemaBuilder } from '@chronicstone/typed-xlsx'
// ---cut-before---
const schema = ExcelSchemaBuilder.create<{ name: string, date: Date, balance: number, currency: 'EUR' | 'USD' }>()
  .withFormatters({
    date: 'd mmm yyyy',
    currency: (params: { currency: 'EUR' | 'USD' }) => `${params.currency === 'EUR' ? '€' : '$'}#,##0.00`,
  })
  .column('name', { key: 'name' })
  .column('date', { key: 'date', format: { preset: 'date' } })
  .column('balance', {
    key: 'balance',
    format: {
      preset: 'currency',
      params: { currency: '' }
//                         ^|
    }
  })

  .build()
```

As shown in the example above, formatters preset can either be static strings, or accept an object argument that can be used to pass parameters to the formatter function. Presets can be applied statically for all rows on a column, or controlled individually for each row

When defining a dynamic format preset, you need to strongly type the params argument so that it can be enforced when the preset is used on columns.

## Share formatters across schemas

You can define formatters externally and then use them on any table schema you want :

```ts twoslash
// @noErrors
import { ExcelSchemaBuilder, FormattersMap } from '@chronicstone/typed-xlsx'

const formatters = {
  date: 'd mmm yyyy',
  currency: (params: { currency: string }) => `${params.currency}#,##0.00`,
} satisfies FormattersMap

const schema = ExcelSchemaBuilder.create<{ name: string, date: Date, balance: number, currency: 'EUR' | 'USD' }>()
  .withFormatters(formatters)
  .column('name', { key: 'name' })
  .column('date', { key: 'date', format: { preset: 'date' } })
  .column('balance', {
    key: 'balance',
    format: {
      preset: 'currency',
      params: { currency: '$' }
    }
  })
  .build()
```

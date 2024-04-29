import fs from 'node:fs'
import { describe, it } from 'vitest'
import { faker } from '@faker-js/faker'
import type { FormattersMap } from '../src'
import { ExcelBuilder, ExcelSchemaBuilder } from '../src'

describe('should generate the play excel file', () => {
  it('exported', () => {
    interface User { id: string, name: string, birthDate: Date, balance: number }
    // Group definition within the schema
    const schema = ExcelSchemaBuilder.create<User>()
      .withFormatters({
        date: 'd mmm yyyy',
        currency: (params: { currency: string }) => `${params.currency}#,##0.00`,
        other: (params: { other: string }) => `${params.other}#,##0.00`,
      })
      .column('id', { key: 'id' })
      .column('name', {
        key: 'name',
        cellStyle: { fill: { fgColor: { rgb: 'FFFF00' } } },
        headerStyle: { fill: { fgColor: { rgb: '00FF00' } } },
      })
      .column('birthDate', { key: 'birthDate', format: { preset: 'date' } })
      .column('birthDate2', { key: 'birthDate', format: 'd mmm yyyy' })
      .column('balanceUsd', { key: 'balance', format: { preset: 'currency', params: { currency: '$' } } })
      .column('balanceEur', { key: 'balance', format: { preset: 'currency', params: { currency: '€' } } })
      .build()

    const users: User[] = Array.from({ length: 100000 }, (_, i) => ({
      id: i.toString(),
      name: 'John',
      balance: +faker.finance.amount({ min: 0, max: 1000000, dec: 2 }),
      birthDate: faker.date.past(),

    }))

    const file = ExcelBuilder.create()
      .sheet('Sheet1', { tablesPerRow: 2 })
      .addTable({ data: users, schema, title: 'Table 1' })
      .build({ output: 'buffer' })

    fs.writeFileSync('./examples/playground.xlsx', file)
  })
})

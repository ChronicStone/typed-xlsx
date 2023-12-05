import fs from 'node:fs'
import { describe, it } from 'vitest'
import { faker } from '@faker-js/faker'
import { ExcelBuilder, ExcelSchemaBuilder } from '../src'

interface Consumption {
  identifier: string
  account: string
  product: string
  productVersion: string
  month: string
  year: string
  units: number
}

describe('should generate consumption example', () => {
  it('works', () => {
    const consumptions: Consumption[] = Array.from({ length: 100 }, () => ({
      identifier: faker.string.uuid(),
      account: faker.string.uuid(),
      product: faker.commerce.productName(),
      productVersion: faker.system.semver(),
      month: faker.date.month(),
      year: faker.date.past().getFullYear().toString(),
      units: Math.floor(Math.random() * 100),
    }))
    const schema = ExcelSchemaBuilder
      .create<Consumption>()
      .column('identifier', {
        key: 'identifier',
        label: '#',
        cellStyle: () => ({ font: { bold: true } }),
      })
      .column('account', {
        key: 'account',
        label: 'Account',
      })
      .column('product', {
        key: 'product',
        label: 'Product',
      })
      .column('productVersion', {
        key: 'productVersion',
        label: 'Version',
      })
      .column('month', {
        key: 'month',
        label: 'Month',
      })
      .column('year', {
        key: 'year',
        label: 'Year',
      })
      .column('units', {
        key: 'units',
        label: 'Units',
      })
      .build()
    const excel = ExcelBuilder.create()
      .sheet('consumption', {
        data: consumptions,
        schema,
      })
      .build({ output: 'buffer' })
    fs.writeFileSync('consumption.xlsx', excel)
  })
})

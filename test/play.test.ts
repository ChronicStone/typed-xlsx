import fs from 'node:fs'
import { describe, it } from 'vitest'
import { ExcelBuilder, ExcelSchemaBuilder } from '../src'

describe('should generate the play excel file', () => {
  it('exported', () => {
    interface User { id: string, name: string }

    // Group definition within the schema
    const schema = ExcelSchemaBuilder.create<User>()
      .column('id', { key: 'id' })
      .column('name', { key: 'name' })
      .build()

    console.info('Schema built')
    console.time('Generate data')
    const users: User[] = Array.from({ length: 400000 }, (_, i) => ({
      id: i.toString(),
      name: 'John',

    }))
    console.timeEnd('Generate data')

    console.time('build')
    const file = ExcelBuilder.create()
      .sheet('Sheet1', { tablesPerRow: 2 })
      .addTable({ data: users, schema, title: 'Table 1' })
      .build({ output: 'buffer' })
    console.timeEnd('build')

    fs.writeFileSync('./examples/playground.xlsx', file)
  })
})

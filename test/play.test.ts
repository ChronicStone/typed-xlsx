import fs from 'node:fs'
import { describe, it } from 'vitest'
import { ExcelBuilder, ExcelSchemaBuilder } from '../src'

describe('should generate the play excel file', () => {
  it('exported', () => {
    interface User { id: string, name: string }

    // Group definition within the schema
    const schema = ExcelSchemaBuilder.create<User>()
      .column('id', { key: 'id' })
      .column('name', {
        key: 'name',
        cellStyle: { fill: { fgColor: { rgb: 'FFFF00' } } },
        headerStyle: { fill: { fgColor: { rgb: '00FF00' } } },
      })
      .build()

    const users: User[] = Array.from({ length: 100000 }, (_, i) => ({
      id: i.toString(),
      name: 'John',

    }))

    const file = ExcelBuilder.create()
      .sheet('Sheet1', { tablesPerRow: 2 })
      .addTable({ data: users, schema, title: 'Table 1' })
      .build({ output: 'buffer' })

    fs.writeFileSync('./examples/playground.xlsx', file)
  })
})

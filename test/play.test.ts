import fs from 'node:fs'
import { describe, it } from 'vitest'
import { ExcelBuilder, ExcelSchemaBuilder } from '../src'

describe('should generate the play excel file', () => {
  it('exported', () => {
    interface Organization { id: string, name: string }
    interface User { id: string, name: string, organizations: Organization[] }

    // Group definition within the schema
    const schema = ExcelSchemaBuilder.create<User>()
      .column('id', { key: 'id' })
      .column('name', { key: 'name' })

      .build()

    const users: User[] = [{ id: '1', name: 'John', organizations: [{ id: '1', name: 'Org 1' }] }, { id: '2', name: 'Jane', organizations: [{ id: '1', name: 'Org 1' }, { id: '2', name: 'Org 2' }] }, { id: '3', name: 'Bob', organizations: [{ id: '1', name: 'Org 1' }, { id: '2', name: 'Org 2' }, { id: '3', name: 'Org 3' }] }]

    const file = ExcelBuilder.create()
      .sheet('Sheet1', { tablesPerRow: 2 })
      .addTable({ data: users, schema, title: 'Table 1' })
      .addTable({ data: users, schema, title: 'Table 2' })
      .addTable({ data: users, schema, title: 'Table 3' })
      .addTable({ data: users, schema, title: 'Table 4' })
      .build({ output: 'buffer' })

    fs.writeFileSync('./examples/playground.xlsx', file)
  })
})

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
      .group('group:org', (builder, context: Organization[]) => {
        for (const org of context) {
          builder
            .column(`orga-${org.id}`, {
              label: `User in ${org.name}`,
              key: 'organizations',
              transform: orgs => orgs.some(o => o.id === org.id) ? 'YES' : 'NO',
              cellStyle: data => ({
                font: {
                  color: { rgb: data.organizations.some(o => o.id === org.id) ? '61eb34' : 'd10808' },
                },
              }),
            })
        }
      })
      .build()

    const organizations: Organization[] = [{ id: '1', name: 'Org 1' }, { id: '2', name: 'Org 2' }, { id: '3', name: 'Org 3' }]
    const users: User[] = [{ id: '1', name: 'John', organizations: [{ id: '1', name: 'Org 1' }] }, { id: '2', name: 'Jane', organizations: [{ id: '1', name: 'Org 1' }, { id: '2', name: 'Org 2' }] }, { id: '3', name: 'Bob', organizations: [{ id: '1', name: 'Org 1' }, { id: '2', name: 'Org 2' }, { id: '3', name: 'Org 3' }] }]

    const file = ExcelBuilder.create()
      .sheet('Sheet1')
      .addTable({
        data: users,
        schema,
        context: {
          'group:org': organizations,
        },
      })
      .build({ output: 'buffer' })

    fs.writeFileSync('play.xlsx', file)
  })
})

import fs from 'node:fs'
import { Buffer } from 'node:buffer'
import { describe, it } from 'vitest'
import { faker } from '@faker-js/faker'
import type { TransformersMap } from '../src/types'
import { ExcelBuilder, ExcelSchemaBuilder } from '../src'

interface Organization {
  id: number
  name: string
}

interface User {
  id: number
  firstName: string
  lastName: string
  email: string
  roles: string[]
  organizations: Organization[]
  results: {
    general: { overall: number }
    technical: { overall: number }
    interview?: { overall: number }
  }
  createdAt: Date
  balance: number
}

const transformers = {
  boolean: (accessor: boolean) => accessor ? 'Yes' : 'No',
  list: (accessor: string[]) => accessor.join(', '),
  arrayLength: (accessor: any[] | string) => accessor.length,
  date: (accessor: Date) => accessor.toLocaleDateString(),
} satisfies TransformersMap

describe('should generate the example excel', () => {
  it('exported', async () => {
    const organizations: Organization[] = Array.from({ length: 10 }, (_, id) => ({
      id,
      name: faker.company.name(),
    }))

    const users: User[] = Array.from({ length: 100 }, (_, id) => ({
      id,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      roles: ['admin', 'user', 'manager', 'guest'].filter(() => Math.random() > 0.5),
      organizations: organizations.filter(() => Math.random() > 0.5),
      results: {
        general: { overall: Math.floor(Math.random() * 10) },
        technical: { overall: Math.floor(Math.random() * 10) },
        ...(Math.random() > 0.5 ? { interview: { overall: Math.floor(Math.random() * 10) } } : {}),
      },
      balance: +faker.finance.amount({ min: 0, max: 1000000, dec: 2 }),
      createdAt: faker.date.past(),
    }))
    const assessmentExport = ExcelSchemaBuilder
      .create<User>()
      .withTransformers(transformers)
      .column('id', {
        accessor: 'id',
        summary: [{ value: () => 'TOTAL BEFORE VAT' }, { value: () => 'TOTAL' }],
      })
      .column('lastName', { accessor: 'lastName', transform: (_, i) => i === 0 ? [] : i === 1 ? ['Cyp', 'THAO'] : ['OTHER'] })
      .column('email', { accessor: 'email' })
      .column('roles', {
        accessor: 'roles',
        transform: 'list',
        cellStyle: data => ({ font: { color: { argb: data.roles.includes('admin') ? 'd10808' : undefined } } }),
      })
      .column('balance', {
        accessor: 'balance',
        format: '"$"#,##0.00_);\\("$"#,##0.00\\)',
        summary: [
          {
            value: data => data.reduce((acc, user) => acc + user.balance, 0),
            format: '"$"#,##0.00_);\\("$"#,##0.00\\)',
          },
          {
            value: data => data.reduce((acc, user) => acc + user.balance, 0) * 1.2,
            format: '"$"#,##0.00_);\\("$"#,##0.00\\)',
          },
        ],
      })
      .column('nbOrgs', { accessor: 'organizations', transform: 'arrayLength' })
      .column('orgs', { accessor: 'organizations', transform: org => org.map(org => org.name).join(', ') })
      .column('generalScore', {
        accessor: 'results.general.overall',
        format: '# / 10',
        summary: [{
          value: data => data.reduce((acc, user) => acc + user.results.general.overall, 0) / data.length,
          format: '# / 10',
        }],
      })
      .column('technicalScore', {
        accessor: 'results.technical.overall',
        summary: [{
          value: data => data.reduce((acc, user) => acc + user.results.technical.overall, 0) / data.length,
        }],
      })
      .column('interviewScore', { accessor: 'results.interview.overall', default: 'N/A' })
      .column('createdAt', { accessor: 'createdAt', format: 'd mmm yyyy' })
      .group('group:org', (builder, context: Organization[]) => {
        for (const org of context) {
          builder
            .column(`orga-${org.id}`, {
              label: `User in ${org.name}`,
              accessor: 'organizations',
              transform: orgs => orgs.some(o => o.id === org.id) ? 'YES' : 'NO',
              cellStyle: data => ({
                font: {
                  color: { argb: data.organizations.some(o => o.id === org.id) ? '61eb34' : 'd10808' },
                },
              }),
            })
        }
      })
      .build()

    const buffer = await ExcelBuilder
      .create()
      .sheet('Users - full')
      .addTable({
        data: users.filter((_, i) => i < 5),
        schema: assessmentExport,
        context: {
          'group:org': organizations,
        },
      })
      .sheet('Users - partial')
      .addTable({
        data: users,
        schema: assessmentExport,
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      })
      .sheet('User - neg partial')
      .addTable({
        data: users,
        schema: assessmentExport,
        select: {
          firstName: false,
          lastName: false,
          email: false,
        },
        context: {
          'group:org': organizations,
        },
      })
      .sheet('Multi-tables-grid', { tablesPerRow: 2 })
      .addTable({
        title: 'Table 1',
        data: users.filter((_, i) => i < 5),
        schema: assessmentExport,
        select: { firstName: true, lastName: true, email: true, createdAt: true },
      })
      .addTable({
        title: 'Table 2',
        data: users.filter((_, i) => i < 5),
        schema: assessmentExport,
        select: { firstName: true, lastName: true, email: true, balance: true },
      })
      .addTable({
        title: 'Table 3',
        data: users.filter((_, i) => i < 5),
        schema: assessmentExport,
        select: { firstName: true, lastName: true, email: true, balance: true },
      })
      .addTable({
        title: 'Table 4',
        data: users.filter((_, i) => i < 5),
        schema: assessmentExport,
        select: { firstName: true, lastName: true, email: true, createdAt: true },
      })
      .build({ output: 'buffer', autoSizeColumns: true })

    fs.writeFileSync('./examples/kitchen-sink.xlsx', new Uint8Array(buffer))
  })
})

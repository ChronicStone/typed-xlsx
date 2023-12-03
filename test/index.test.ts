import fs from 'node:fs'
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
}

const transformers = {
  boolean: (key: boolean) => key ? 'Yes' : 'No',
  list: (key: (string)[]) => key.join(', '),
  arrayLength: (key: any[] | string) => key.length,
  date: (key: Date) => key.toLocaleDateString(),
} satisfies TransformersMap
// Usage example

describe('should', () => {
  it('exported', () => {
    const users: User[] = Array.from({ length: 10 }, (_, id) => ({
      id,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      roles: ['admin', 'user', 'manager', 'guest'].filter(() => Math.random() > 0.5),
      // RANDOM NUMBER OF ORGANIZATIONS
      organizations: Array.from({ length: Math.floor(Math.random() * 5) }, (_, id) => ({
        id,
        name: faker.company.name(),
      })),
      results: {
        general: { overall: Math.floor(Math.random() * 10) },
        technical: { overall: Math.floor(Math.random() * 10) },
        ...(Math.random() > 0.5 ? { interview: { overall: Math.floor(Math.random() * 10) } } : {}),
      },
      createdAt: faker.date.past(),
    }))
    const assessmentExport = ExcelSchemaBuilder
      .create<User>()
      .withTransformers(transformers)
      .column('id', { key: 'id' })
      .column('firstName', { key: 'firstName', cellStyle: () => ({ fill: { fgColor: { rgb: 'E9E9E9' } } }) })
      .column('lastName', { key: 'lastName' })
      .column('email', { key: 'email' })
      .column('roles', { key: 'roles', transform: 'list' })
      .column('nbOrgs', { key: 'organizations', transform: 'arrayLength' })
      .column('orgs', { key: 'organizations', transform: org => org.map(org => org.name).join(', ') })
      .column('generalScore', { key: 'results.general.overall' })
      .column('technicalScore', { key: 'results.technical.overall' })
      .column('interviewScore', { key: 'results.interview.overall', default: 'N/A' })
      .column('createdAt', { key: 'createdAt', transform: 'date' })
      .build()

    const buffer = ExcelBuilder
      .create()
      .sheet('sheet1', { data: users, schema: assessmentExport })
      .sheet('sheet2', { data: users, schema: assessmentExport, select: ['firstName', 'lastName', 'email'] })
      .build()

    fs.writeFileSync('test.xlsx', buffer)
  })
})
